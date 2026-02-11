import { eq, and, sql, inArray } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  analyticsImports,
  ideas,
  checklistItems,
  notifications,
  type User,
  type UpsertUser,
  type AnalyticsImport,
  type InsertAnalyticsImport,
  type Idea,
  type InsertIdea,
  type ChecklistItem,
  type InsertChecklistItem,
  type Notification,
  type InsertNotification,
} from "@shared/schema";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: UpsertUser): Promise<User>;
  updateUserActivity(userId: string): Promise<void>;
  updateUserTierProgress(userId: string, progress: number, tier?: string): Promise<void>;

  // Analytics Import methods
  createAnalyticsImport(data: InsertAnalyticsImport): Promise<AnalyticsImport>;
  getAnalyticsImport(id: string): Promise<AnalyticsImport | undefined>;
  getAnalyticsImportForUser(id: string, userId: string): Promise<AnalyticsImport | undefined>;
  getAnalyticsImportsByUser(userId: string): Promise<AnalyticsImport[]>;
  hasAnalyticsImports(userId: string): Promise<boolean>;

  // Ideas methods
  createIdea(data: InsertIdea): Promise<Idea>;
  getIdea(id: string): Promise<Idea | undefined>;
  getIdeasByUser(userId: string, status?: string): Promise<Idea[]>;
  getActiveIdeas(userId: string): Promise<Idea[]>;
  updateIdea(id: string, data: Partial<Idea>): Promise<Idea | undefined>;
  deleteIdea(id: string): Promise<void>;
  countCompletedIdeasInTier(userId: string, tier: string): Promise<number>;

  // Checklist methods
  createChecklistItem(data: InsertChecklistItem): Promise<ChecklistItem>;
  getChecklistItem(id: string): Promise<ChecklistItem | undefined>;
  getChecklistItems(ideaId: string): Promise<ChecklistItem[]>;
  updateChecklistItem(id: string, data: Partial<ChecklistItem>): Promise<ChecklistItem | undefined>;
  toggleChecklistItem(id: string): Promise<ChecklistItem | undefined>;
  deleteChecklistItem(id: string): Promise<void>;
  countUncheckedItems(ideaId: string): Promise<number>;

  // Notification methods
  createNotification(data: InsertNotification): Promise<Notification>;
  getNotifications(userId: string, unreadOnly?: boolean): Promise<Notification[]>;
  markNotificationRead(id: string): Promise<void>;

  // Admin methods
  getAllUsers(): Promise<User[]>;
  setUserAdmin(userId: string, isAdmin: boolean): Promise<User | undefined>;
  getAdminStats(): Promise<{
    totalUsers: number;
    totalIdeas: number;
    totalCompletedIdeas: number;
    usersByTier: { tier: string; count: number }[];
  }>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: UpsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUserActivity(userId: string): Promise<void> {
    await db
      .update(users)
      .set({ updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async updateUserTierProgress(userId: string, progress: number, tier?: string): Promise<void> {
    const updateData: Partial<User> = { tierProgress: progress };
    if (tier) {
      updateData.currentTier = tier;
    }
    await db.update(users).set(updateData).where(eq(users.id, userId));
  }

  // Analytics Import methods
  async createAnalyticsImport(data: InsertAnalyticsImport): Promise<AnalyticsImport> {
    const [analyticsImport] = await db.insert(analyticsImports).values(data).returning();
    return analyticsImport;
  }

  async getAnalyticsImport(id: string): Promise<AnalyticsImport | undefined> {
    const [analyticsImport] = await db
      .select()
      .from(analyticsImports)
      .where(eq(analyticsImports.id, id));
    return analyticsImport;
  }

  async getAnalyticsImportForUser(id: string, userId: string): Promise<AnalyticsImport | undefined> {
    const [analyticsImport] = await db
      .select()
      .from(analyticsImports)
      .where(and(eq(analyticsImports.id, id), eq(analyticsImports.userId, userId)));
    return analyticsImport;
  }

  async getAnalyticsImportsByUser(userId: string): Promise<AnalyticsImport[]> {
    return db
      .select()
      .from(analyticsImports)
      .where(eq(analyticsImports.userId, userId))
      .orderBy(sql`${analyticsImports.createdAt} DESC`);
  }

  async hasAnalyticsImports(userId: string): Promise<boolean> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(analyticsImports)
      .where(eq(analyticsImports.userId, userId));
    return (result?.count ?? 0) > 0;
  }

  // Ideas methods
  async createIdea(data: InsertIdea): Promise<Idea> {
    const [idea] = await db.insert(ideas).values(data).returning();
    return idea;
  }

  async getIdea(id: string): Promise<Idea | undefined> {
    const [idea] = await db.select().from(ideas).where(eq(ideas.id, id));
    return idea;
  }

  async getIdeasByUser(userId: string, status?: string): Promise<Idea[]> {
    if (status) {
      return db
        .select()
        .from(ideas)
        .where(and(eq(ideas.userId, userId), eq(ideas.status, status)))
        .orderBy(sql`${ideas.createdAt} DESC`);
    }
    return db
      .select()
      .from(ideas)
      .where(eq(ideas.userId, userId))
      .orderBy(sql`${ideas.createdAt} DESC`);
  }

  async getActiveIdeas(userId: string): Promise<Idea[]> {
    return db
      .select()
      .from(ideas)
      .where(
        and(
          eq(ideas.userId, userId),
          inArray(ideas.status, ["unstarted", "in_progress"])
        )
      )
      .orderBy(ideas.position);
  }

  async updateIdea(id: string, data: Partial<Idea>): Promise<Idea | undefined> {
    const [updatedIdea] = await db
      .update(ideas)
      .set(data)
      .where(eq(ideas.id, id))
      .returning();
    return updatedIdea;
  }

  async deleteIdea(id: string): Promise<void> {
    await db.delete(ideas).where(eq(ideas.id, id));
  }

  async countCompletedIdeasInTier(userId: string, tier: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(ideas)
      .where(
        and(
          eq(ideas.userId, userId),
          eq(ideas.tierCompletedIn, tier),
          eq(ideas.status, "completed")
        )
      );
    return result[0]?.count ?? 0;
  }

  // Checklist methods
  async createChecklistItem(data: InsertChecklistItem): Promise<ChecklistItem> {
    const [item] = await db.insert(checklistItems).values(data).returning();
    return item;
  }

  async getChecklistItem(id: string): Promise<ChecklistItem | undefined> {
    const [item] = await db
      .select()
      .from(checklistItems)
      .where(eq(checklistItems.id, id));
    return item;
  }

  async getChecklistItems(ideaId: string): Promise<ChecklistItem[]> {
    return db
      .select()
      .from(checklistItems)
      .where(eq(checklistItems.ideaId, ideaId))
      .orderBy(checklistItems.position);
  }

  async updateChecklistItem(id: string, data: Partial<ChecklistItem>): Promise<ChecklistItem | undefined> {
    const [updatedItem] = await db
      .update(checklistItems)
      .set(data)
      .where(eq(checklistItems.id, id))
      .returning();
    return updatedItem;
  }

  async toggleChecklistItem(id: string): Promise<ChecklistItem | undefined> {
    const [currentItem] = await db
      .select()
      .from(checklistItems)
      .where(eq(checklistItems.id, id));

    if (!currentItem) return undefined;

    const newIsChecked = !currentItem.isChecked;
    const [updatedItem] = await db
      .update(checklistItems)
      .set({
        isChecked: newIsChecked,
        checkedAt: newIsChecked ? new Date() : null,
      })
      .where(eq(checklistItems.id, id))
      .returning();

    return updatedItem;
  }

  async deleteChecklistItem(id: string): Promise<void> {
    await db.delete(checklistItems).where(eq(checklistItems.id, id));
  }

  async countUncheckedItems(ideaId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(checklistItems)
      .where(
        and(
          eq(checklistItems.ideaId, ideaId),
          eq(checklistItems.isChecked, false)
        )
      );
    return result[0]?.count ?? 0;
  }

  // Notification methods
  async createNotification(data: InsertNotification): Promise<Notification> {
    const [notification] = await db.insert(notifications).values(data).returning();
    return notification;
  }

  async getNotifications(userId: string, unreadOnly?: boolean): Promise<Notification[]> {
    if (unreadOnly) {
      return db
        .select()
        .from(notifications)
        .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
        .orderBy(sql`${notifications.createdAt} DESC`);
    }
    return db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(sql`${notifications.createdAt} DESC`);
  }

  async markNotificationRead(id: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id));
  }

  // Admin methods
  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(sql`${users.createdAt} DESC`);
  }

  async setUserAdmin(userId: string, isAdmin: boolean): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ isAdmin, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async getAdminStats(): Promise<{
    totalUsers: number;
    totalIdeas: number;
    totalCompletedIdeas: number;
    usersByTier: { tier: string; count: number }[];
  }> {
    const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
    const [ideaCount] = await db.select({ count: sql<number>`count(*)` }).from(ideas);
    const [completedCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(ideas)
      .where(eq(ideas.status, "completed"));
    
    const tierCounts = await db
      .select({ 
        tier: users.currentTier, 
        count: sql<number>`count(*)` 
      })
      .from(users)
      .groupBy(users.currentTier);

    return {
      totalUsers: Number(userCount.count),
      totalIdeas: Number(ideaCount.count),
      totalCompletedIdeas: Number(completedCount.count),
      usersByTier: tierCounts.map(t => ({ tier: t.tier, count: Number(t.count) })),
    };
  }
}

export const storage = new DatabaseStorage();
