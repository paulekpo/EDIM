import { users, type User, type UpsertUser } from "@shared/models/auth";
import { db } from "../../db";
import { eq } from "drizzle-orm";

const ADMIN_EMAILS = ["paul.ekpo9@gmail.com"];

// Interface for auth storage operations
// (IMPORTANT) These user operations are mandatory for Replit Auth.
export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const isAdminEmail = userData.email && ADMIN_EMAILS.includes(userData.email.toLowerCase());
    
    // First check if user exists by ID
    const existingById = userData.id ? await this.getUser(userData.id) : undefined;
    
    // If user exists by ID, update them
    if (existingById) {
      const [user] = await db
        .update(users)
        .set({
          ...userData,
          isAdmin: isAdminEmail ? true : existingById.isAdmin,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userData.id!))
        .returning();
      return user;
    }
    
    // Check if user exists by email (to handle email conflicts)
    if (userData.email) {
      const [existingByEmail] = await db
        .select()
        .from(users)
        .where(eq(users.email, userData.email));
      
      if (existingByEmail) {
        // Update existing user with this email
        const [user] = await db
          .update(users)
          .set({
            firstName: userData.firstName ?? existingByEmail.firstName,
            lastName: userData.lastName ?? existingByEmail.lastName,
            profileImageUrl: userData.profileImageUrl ?? existingByEmail.profileImageUrl,
            isAdmin: isAdminEmail ? true : existingByEmail.isAdmin,
            updatedAt: new Date(),
          })
          .where(eq(users.email, userData.email))
          .returning();
        return user;
      }
    }
    
    // Insert new user
    const [user] = await db
      .insert(users)
      .values({
        ...userData,
        isAdmin: isAdminEmail ? true : false,
      })
      .returning();
    return user;
  }
}

export const authStorage = new AuthStorage();
