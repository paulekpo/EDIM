import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAnalyticsImportSchema } from "@shared/schema";
import { z } from "zod";
import { generateIdeas, checkDuplicates, analyzeScreenshot, type AnalyticsData } from "./services/aiService";
import { registerStorageRoutes, storageService } from "./services/storageService";
import { setupAuth, hashPassword } from "./auth";
import passport from "passport";
import rateLimit from "express-rate-limit";

function getUserId(req: any): string {
  // req.user is the User object from deserializeUser
  return req.user?.id;
}

function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: "Unauthorized" });
}

// Rate limiter for authenticated routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: "Too many requests, please try again later." },
});

// Stricter rate limiter for sensitive actions (login, register)
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 login/register requests per hour
  message: { error: "Too many login/register attempts, please try again later." },
});

// Admin middleware - checks if user is authenticated and is an admin
async function isAdmin(req: Request, res: Response, next: NextFunction) {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  const user = await storage.getUser(userId);
  if (!user || !user.isAdmin) {
    return res.status(403).json({ error: "Admin access required" });
  }
  
  next();
}

const DEFAULT_CHECKLIST_ITEMS = [
  "Write script/outline",
  "Film content",
  "Edit video",
  "Post and engage with comments",
];

const TIER_THRESHOLDS: Record<string, number> = {
  amateur: 5,
  professional: 10,
  expert: 15,
};

const TIER_ORDER = ["amateur", "professional", "expert"];

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup authentication BEFORE other routes
  setupAuth(app);

  // Register local storage routes
  registerStorageRoutes(app);

  // Auth Routes
  app.post("/api/register", authLimiter, async (req, res, next) => {
    try {
      const existingUser = await storage.getUserByEmail(req.body.username);
      if (existingUser) {
        return res.status(400).json({ error: "User already exists" });
      }

      const hashedPassword = await hashPassword(req.body.password);
      const user = await storage.createUser({
        email: req.body.username,
        password: hashedPassword,
        firstName: "",
        lastName: "",
        profileImageUrl: "",
        currentTier: "amateur",
        tierProgress: 0,
        isAdmin: false
      });

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(user);
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/login", authLimiter, passport.authenticate("local"), (req, res) => {
    res.json(req.user);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/auth/user", (req, res) => {
    if (req.isAuthenticated()) {
      res.json(req.user);
    } else {
      res.status(401).json({ error: "Not authenticated" });
    }
  });

  // ============ Analytics Endpoints ============

  // POST /api/analytics/upload - Process uploaded screenshot for OCR
  app.post("/api/analytics/upload", isAuthenticated, apiLimiter, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { objectPath } = req.body;

      if (!objectPath) {
        return res.status(400).json({ error: "Object path is required. Upload image first via /api/uploads/request-url" });
      }

      // Get the image from storage service
      const objectFile = await storageService.getObjectEntityFile(objectPath);
      const [imageBuffer] = await objectFile.download();
      const imageBase64 = imageBuffer.toString("base64");

      const analyticsData = await analyzeScreenshot(imageBase64);

      const analyticsImport = await storage.createAnalyticsImport({
        userId,
        trafficSources: analyticsData.trafficSources,
        searchQueries: analyticsData.searchQueries,
        rawImageUrl: imageBase64.substring(0, 100),
      });

      await storage.updateUserActivity(userId);

      res.status(201).json(analyticsImport);
    } catch (error) {
      console.error("Analytics upload error:", error);
      res.status(500).json({ error: "Failed to process analytics image" });
    }
  });

  // POST /api/analytics/manual - Manual analytics entry
  app.post("/api/analytics/manual", isAuthenticated, apiLimiter, async (req, res) => {
    try {
      const userId = getUserId(req);
      const validatedData = insertAnalyticsImportSchema.parse({
        userId,
        ...req.body,
      });

      const analyticsImport = await storage.createAnalyticsImport(validatedData);
      await storage.updateUserActivity(userId);

      res.status(201).json(analyticsImport);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Manual analytics error:", error);
      res.status(500).json({ error: "Failed to save analytics" });
    }
  });

  // GET /api/analytics/exists - Check if any analytics imports exist
  app.get("/api/analytics/exists", isAuthenticated, apiLimiter, async (req, res) => {
    try {
      const userId = getUserId(req);
      const hasAnalytics = await storage.hasAnalyticsImports(userId);
      res.json({ hasAnalytics });
    } catch (error) {
      console.error("Check analytics error:", error);
      res.status(500).json({ error: "Failed to check analytics" });
    }
  });

  // GET /api/analytics/:id - Get analytics import (authenticated with user ownership check)
  app.get("/api/analytics/:id", isAuthenticated, apiLimiter, async (req, res) => {
    try {
      const userId = getUserId(req);
      const analyticsImport = await storage.getAnalyticsImportForUser(req.params.id as string, userId);
      if (!analyticsImport) {
        return res.status(404).json({ error: "Analytics import not found" });
      }
      res.json(analyticsImport);
    } catch (error) {
      console.error("Get analytics error:", error);
      res.status(500).json({ error: "Failed to get analytics" });
    }
  });

  // ============ Ideas Endpoints ============

  // POST /api/ideas/generate - Generate ideas from analytics
  app.post("/api/ideas/generate", isAuthenticated, apiLimiter, async (req, res) => {
    try {
      const userId = getUserId(req);
      let { analyticsImportId } = req.body;

      let analyticsDataForAI: AnalyticsData = {
        trafficSources: {
          "For You Page": 60,
          "Following": 20,
          "Search": 15,
          "Other": 5,
        },
        searchQueries: [],
      };

      // If no specific analytics ID provided, use the most recent one
      if (!analyticsImportId) {
        const userImports = await storage.getAnalyticsImportsByUser(userId);
        if (userImports.length > 0) {
          analyticsImportId = userImports[0].id;
        }
      }

      if (analyticsImportId) {
        // Use secure method that verifies user ownership
        const importData = await storage.getAnalyticsImportForUser(analyticsImportId, userId);
        if (importData) {
          analyticsDataForAI = {
            trafficSources: (importData.trafficSources as Record<string, number>) || analyticsDataForAI.trafficSources,
            searchQueries: (importData.searchQueries as string[]) || [],
          };
        }
      }

      const existingIdeas = await storage.getIdeasByUser(userId);
      const previousTitles = existingIdeas.map((idea) => idea.title);

      const generatedIdeas = await generateIdeas(analyticsDataForAI, previousTitles);
      
      const uniqueIdeas = checkDuplicates(generatedIdeas, previousTitles);

      const createdIdeas = await Promise.all(
        uniqueIdeas.map(async (idea, index) => {
          const newIdea = await storage.createIdea({
            userId,
            analyticsImportId: analyticsImportId || null,
            title: idea.title,
            rationale: idea.rationale,
            status: "unstarted",
            position: index,
          });

          const checklistItems = idea.checklist.length === 4 
            ? idea.checklist 
            : DEFAULT_CHECKLIST_ITEMS;

          await Promise.all(
            checklistItems.map((text, pos) =>
              storage.createChecklistItem({
                ideaId: newIdea.id,
                text,
                isChecked: false,
                isDefault: true,
                position: pos,
              })
            )
          );

          return newIdea;
        })
      );

      await storage.updateUserActivity(userId);

      res.status(201).json(createdIdeas);
    } catch (error) {
      console.error("Generate ideas error:", error);
      res.status(500).json({ error: "Failed to generate ideas" });
    }
  });

  // GET /api/ideas - Get all active ideas for user
  app.get("/api/ideas", isAuthenticated, apiLimiter, async (req, res) => {
    try {
      const userId = getUserId(req);
      const status = req.query.status as string | undefined;
      const activeIdeas = status
        ? await storage.getIdeasByUser(userId, status)
        : await storage.getActiveIdeas(userId);

      const ideasWithChecklist = await Promise.all(
        activeIdeas.map(async (idea) => {
          const checklistItems = await storage.getChecklistItems(idea.id);
          let analyticsData = null;
          
          if (idea.analyticsImportId) {
            const analyticsImport = await storage.getAnalyticsImport(idea.analyticsImportId);
            if (analyticsImport) {
              analyticsData = {
                searchQueries: analyticsImport.searchQueries || [],
                trafficSources: analyticsImport.trafficSources || {},
              };
            }
          }
          
          return {
            ...idea,
            checklistItems,
            analyticsData,
          };
        })
      );

      res.json(ideasWithChecklist);
    } catch (error) {
      console.error("Get ideas error:", error);
      res.status(500).json({ error: "Failed to get ideas" });
    }
  });

  // GET /api/ideas/:id - Get single idea with checklist
  app.get("/api/ideas/:id", apiLimiter, async (req, res) => {
    try {
      const idea = await storage.getIdea(req.params.id as string);
      if (!idea) {
        return res.status(404).json({ error: "Idea not found" });
      }

      const checklistItems = await storage.getChecklistItems(idea.id);
      let analyticsData = null;
      
      if (idea.analyticsImportId) {
        const analyticsImport = await storage.getAnalyticsImport(idea.analyticsImportId);
        if (analyticsImport) {
          analyticsData = {
            searchQueries: analyticsImport.searchQueries || [],
            trafficSources: analyticsImport.trafficSources || {},
          };
        }
      }
      
      res.json({ ...idea, checklistItems, analyticsData });
    } catch (error) {
      console.error("Get idea error:", error);
      res.status(500).json({ error: "Failed to get idea" });
    }
  });

  // PATCH /api/ideas/:id - Update idea
  app.patch("/api/ideas/:id", isAuthenticated, apiLimiter, async (req, res) => {
    try {
      const userId = getUserId(req);
      const idea = await storage.getIdea(req.params.id as string);
      if (!idea) {
        return res.status(404).json({ error: "Idea not found" });
      }

      const updatedIdea = await storage.updateIdea(req.params.id as string, req.body);
      await storage.updateUserActivity(userId);

      res.json(updatedIdea);
    } catch (error) {
      console.error("Update idea error:", error);
      res.status(500).json({ error: "Failed to update idea" });
    }
  });

  // DELETE /api/ideas/:id - Delete idea
  app.delete("/api/ideas/:id", apiLimiter, async (req, res) => {
    try {
      const idea = await storage.getIdea(req.params.id as string);
      if (!idea) {
        return res.status(404).json({ error: "Idea not found" });
      }

      await storage.deleteIdea(req.params.id as string);
      res.status(204).send();
    } catch (error) {
      console.error("Delete idea error:", error);
      res.status(500).json({ error: "Failed to delete idea" });
    }
  });

  // ============ Checklist Endpoints ============

  // POST /api/ideas/:ideaId/checklist - Add new checklist item
  app.post("/api/ideas/:ideaId/checklist", apiLimiter, async (req, res) => {
    try {
      const idea = await storage.getIdea(req.params.ideaId as string);
      if (!idea) {
        return res.status(404).json({ error: "Idea not found" });
      }

      const existingItems = await storage.getChecklistItems(req.params.ideaId as string);
      const position = existingItems.length;

      const item = await storage.createChecklistItem({
        ideaId: req.params.ideaId as string,
        text: req.body.text,
        isChecked: false,
        isDefault: false,
        position,
      });

      res.status(201).json(item);
    } catch (error) {
      console.error("Create checklist item error:", error);
      res.status(500).json({ error: "Failed to create checklist item" });
    }
  });

  // PATCH /api/checklist/:id - Update item text and/or checked state
  app.patch("/api/checklist/:id", apiLimiter, async (req, res) => {
    try {
      const updateData: { text?: string; isChecked?: boolean } = {};
      if (req.body.text !== undefined) {
        updateData.text = req.body.text;
      }
      if (req.body.isChecked !== undefined) {
        updateData.isChecked = req.body.isChecked;
      }
      const updatedItem = await storage.updateChecklistItem(req.params.id as string, updateData);
      if (!updatedItem) {
        return res.status(404).json({ error: "Checklist item not found" });
      }
      res.json(updatedItem);
    } catch (error) {
      console.error("Update checklist item error:", error);
      res.status(500).json({ error: "Failed to update checklist item" });
    }
  });

  // PATCH /api/checklist/:id/toggle - Toggle checkbox
  app.patch("/api/checklist/:id/toggle", isAuthenticated, apiLimiter, async (req, res) => {
    try {
      const userId = getUserId(req);
      const updatedItem = await storage.toggleChecklistItem(req.params.id as string);
      if (!updatedItem) {
        return res.status(404).json({ error: "Checklist item not found" });
      }

      const uncheckedCount = await storage.countUncheckedItems(updatedItem.ideaId);
      
      if (uncheckedCount === 0) {
        const idea = await storage.getIdea(updatedItem.ideaId);
        if (!idea || idea.status === "completed") {
          return res.json({ ...updatedItem, ideaCompleted: false });
        }

        const user = await storage.getUser(userId);
        if (!user) {
          return res.json({ ...updatedItem, ideaCompleted: false });
        }

        const currentTier = user.currentTier || "amateur";
        const completedInTier = await storage.countCompletedIdeasInTier(userId, currentTier);

        await storage.updateIdea(updatedItem.ideaId, {
          status: "completed",
          completedAt: new Date(),
          tierCompletedIn: currentTier,
          completionNumber: completedInTier + 1,
        });

        const newCompletedCount = completedInTier + 1;
        const threshold = TIER_THRESHOLDS[currentTier] || 5;
        const progress = Math.min(100, Math.round((newCompletedCount / threshold) * 100));

        let tierUp = false;
        let newTier = currentTier;

        if (newCompletedCount >= threshold) {
          const tierIndex = TIER_ORDER.indexOf(currentTier);
          if (tierIndex < TIER_ORDER.length - 1) {
            newTier = TIER_ORDER[tierIndex + 1];
            tierUp = true;
            await storage.updateUserTierProgress(userId, 0, newTier);

            await storage.createNotification({
              userId,
              type: "tier_up",
              title: "Tier Up!",
              message: `Congratulations! You've reached ${newTier} tier!`,
            });
          } else {
            await storage.updateUserTierProgress(userId, 100);
          }
        } else {
          await storage.updateUserTierProgress(userId, progress);
        }

        await storage.createNotification({
          userId,
          type: "idea_completed",
          title: "Idea Completed!",
          message: `You completed "${idea.title}"`,
        });

        await storage.updateUserActivity(userId);

        return res.json({
          ...updatedItem,
          ideaCompleted: true,
          tierUp,
          newTier,
          progress,
          completedInTier: newCompletedCount,
        });
      }

      res.json({ ...updatedItem, ideaCompleted: false });
    } catch (error) {
      console.error("Toggle checklist item error:", error);
      res.status(500).json({ error: "Failed to toggle checklist item" });
    }
  });

  // DELETE /api/checklist/:id - Delete item
  app.delete("/api/checklist/:id", apiLimiter, async (req, res) => {
    try {
      await storage.deleteChecklistItem(req.params.id as string);
      res.status(204).send();
    } catch (error) {
      console.error("Delete checklist item error:", error);
      res.status(500).json({ error: "Failed to delete checklist item" });
    }
  });

  // ============ Progress Endpoints ============

  // GET /api/progress - Get user tier progress
  app.get("/api/progress", isAuthenticated, apiLimiter, async (req, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const currentTier = user.currentTier || "amateur";
      const completedInTier = await storage.countCompletedIdeasInTier(userId, currentTier);
      const threshold = TIER_THRESHOLDS[currentTier] || 5;
      const tierIndex = TIER_ORDER.indexOf(currentTier);
      const nextTier = tierIndex < TIER_ORDER.length - 1 ? TIER_ORDER[tierIndex + 1] : null;

      res.json({
        currentTier,
        tierProgress: user.tierProgress,
        completedInTier,
        threshold,
        nextTier,
        isMaxTier: !nextTier,
      });
    } catch (error) {
      console.error("Get progress error:", error);
      res.status(500).json({ error: "Failed to get progress" });
    }
  });

  // POST /api/ideas/:id/complete - Trigger auto-complete check (idempotent)
  app.post("/api/ideas/:id/complete", isAuthenticated, apiLimiter, async (req, res) => {
    try {
      const userId = getUserId(req);
      const idea = await storage.getIdea(req.params.id as string);
      if (!idea) {
        return res.status(404).json({ error: "Idea not found" });
      }

      // Idempotent: if already completed, return success without double-counting
      if (idea.status === "completed") {
        return res.json({
          success: true,
          alreadyCompleted: true,
          tierUp: false,
          newTier: idea.tierCompletedIn,
          progress: 0,
          completedInTier: 0,
        });
      }

      const uncheckedCount = await storage.countUncheckedItems(req.params.id as string);
      if (uncheckedCount > 0) {
        return res.status(400).json({
          error: "Cannot complete idea with unchecked items",
          uncheckedCount,
        });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const currentTier = user.currentTier || "amateur";
      const completedInTier = await storage.countCompletedIdeasInTier(userId, currentTier);

      await storage.updateIdea(req.params.id as string, {
        status: "completed",
        completedAt: new Date(),
        tierCompletedIn: currentTier,
        completionNumber: completedInTier + 1,
      });

      const newCompletedCount = completedInTier + 1;
      const threshold = TIER_THRESHOLDS[currentTier] || 5;
      const progress = Math.min(100, Math.round((newCompletedCount / threshold) * 100));

      let tierUp = false;
      let newTier = currentTier;

      if (newCompletedCount >= threshold) {
        const tierIndex = TIER_ORDER.indexOf(currentTier);
        if (tierIndex < TIER_ORDER.length - 1) {
          newTier = TIER_ORDER[tierIndex + 1];
          tierUp = true;
          await storage.updateUserTierProgress(userId, 0, newTier);

          await storage.createNotification({
            userId,
            type: "tier_up",
            title: "Tier Up!",
            message: `Congratulations! You've reached ${newTier} tier!`,
          });
        } else {
          await storage.updateUserTierProgress(userId, 100);
        }
      } else {
        await storage.updateUserTierProgress(userId, progress);
      }

      await storage.createNotification({
        userId,
        type: "idea_completed",
        title: "Idea Completed!",
        message: `You completed "${idea.title}"`,
      });

      await storage.updateUserActivity(userId);

      res.json({
        success: true,
        tierUp,
        newTier,
        progress,
        completedInTier: newCompletedCount,
      });
    } catch (error) {
      console.error("Complete idea error:", error);
      res.status(500).json({ error: "Failed to complete idea" });
    }
  });

  // ============ Notification Endpoints ============

  // GET /api/notifications - Get user notifications
  app.get("/api/notifications", isAuthenticated, apiLimiter, async (req, res) => {
    try {
      const userId = getUserId(req);
      const unreadOnly = req.query.unread === "true";
      const notificationsList = await storage.getNotifications(userId, unreadOnly);
      res.json(notificationsList);
    } catch (error) {
      console.error("Get notifications error:", error);
      res.status(500).json({ error: "Failed to get notifications" });
    }
  });

  // PATCH /api/notifications/:id/read - Mark as read
  app.patch("/api/notifications/:id/read", apiLimiter, async (req, res) => {
    try {
      await storage.markNotificationRead(req.params.id as string);
      res.json({ success: true });
    } catch (error) {
      console.error("Mark notification read error:", error);
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  // ============ Admin Endpoints ============

  // GET /api/admin/stats - Get admin dashboard statistics
  app.get("/api/admin/stats", isAuthenticated, isAdmin, apiLimiter, async (req, res) => {
    try {
      const stats = await storage.getAdminStats();
      res.json(stats);
    } catch (error) {
      console.error("Get admin stats error:", error);
      res.status(500).json({ error: "Failed to get admin stats" });
    }
  });

  // GET /api/admin/users - Get all users
  app.get("/api/admin/users", isAuthenticated, isAdmin, apiLimiter, async (req, res) => {
    try {
      const usersList = await storage.getAllUsers();
      res.json(usersList);
    } catch (error) {
      console.error("Get all users error:", error);
      res.status(500).json({ error: "Failed to get users" });
    }
  });

  // PATCH /api/admin/users/:id/admin - Toggle admin status
  app.patch("/api/admin/users/:id/admin", isAuthenticated, isAdmin, apiLimiter, async (req, res) => {
    try {
      const { isAdmin: makeAdmin } = req.body;
      if (typeof makeAdmin !== "boolean") {
        return res.status(400).json({ error: "isAdmin must be a boolean" });
      }
      const user = await storage.setUserAdmin(req.params.id as string, makeAdmin);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Toggle admin error:", error);
      res.status(500).json({ error: "Failed to update admin status" });
    }
  });

  // GET /api/admin/check - Check if current user is admin
  app.get("/api/admin/check", isAuthenticated, apiLimiter, async (req, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);
      res.json({ isAdmin: user?.isAdmin ?? false });
    } catch (error) {
      res.json({ isAdmin: false });
    }
  });

  return httpServer;
}
