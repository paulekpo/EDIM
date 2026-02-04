import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { sql } from "drizzle-orm";
import {
  insertAnalyticsImportSchema,
  insertIdeaSchema,
  insertChecklistItemSchema,
  insertNotificationSchema,
  ideas,
  users,
} from "@shared/schema";
import { z } from "zod";
import OpenAI from "openai";
import { generateIdeas, checkDuplicates, type AnalyticsData } from "./services/aiService";
import { registerObjectStorageRoutes, ObjectStorageService } from "./replit_integrations/object_storage";

const DEMO_USER_ID = "demo-user-123";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

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

async function ensureDemoUser() {
  try {
    const user = await storage.getUser(DEMO_USER_ID);
    if (!user) {
      await db.insert(users).values({
        id: DEMO_USER_ID,
        username: "demo_user",
        password: "demo_pass",
        currentTier: "amateur",
        tierProgress: 0,
      }).onConflictDoNothing();
    }
  } catch (error) {
    console.error("Error ensuring demo user:", error);
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Ensure demo user exists on startup
  await ensureDemoUser();

  // Register object storage routes for file uploads
  registerObjectStorageRoutes(app);

  const objectStorageService = new ObjectStorageService();

  // ============ Analytics Endpoints ============

  // POST /api/analytics/upload - Process uploaded screenshot for OCR
  app.post("/api/analytics/upload", async (req, res) => {
    try {
      const { objectPath } = req.body;

      if (!objectPath) {
        return res.status(400).json({ error: "Object path is required. Upload image first via /api/uploads/request-url" });
      }

      // Get the image from object storage
      const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
      const [imageBuffer] = await objectFile.download();
      const imageBase64 = imageBuffer.toString("base64");
      const [metadata] = await objectFile.getMetadata();
      const contentType = metadata.contentType || "image/png";

      const response = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this TikTok analytics screenshot and extract the following data in JSON format:
{
  "trafficSources": {
    "forYouPage": number (percentage),
    "following": number (percentage),
    "search": number (percentage),
    "sound": number (percentage),
    "hashtag": number (percentage),
    "other": number (percentage)
  },
  "searchQueries": string[] (top search terms if visible),
  "views": number (total views if visible),
  "likes": number (if visible),
  "comments": number (if visible),
  "shares": number (if visible)
}
Return only valid JSON, no markdown.`,
              },
              {
                type: "image_url",
                image_url: { url: `data:${contentType};base64,${imageBase64}` },
              },
            ],
          },
        ],
        max_completion_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content || "{}";
      let parsedData;
      try {
        parsedData = JSON.parse(content);
      } catch {
        parsedData = { trafficSources: {}, searchQueries: [] };
      }

      const analyticsImport = await storage.createAnalyticsImport({
        userId: DEMO_USER_ID,
        trafficSources: parsedData.trafficSources || {},
        searchQueries: parsedData.searchQueries || [],
        rawImageUrl: imageBase64.substring(0, 100),
      });

      await storage.updateUserActivity(DEMO_USER_ID);

      res.status(201).json(analyticsImport);
    } catch (error) {
      console.error("Analytics upload error:", error);
      res.status(500).json({ error: "Failed to process analytics image" });
    }
  });

  // POST /api/analytics/manual - Manual analytics entry
  app.post("/api/analytics/manual", async (req, res) => {
    try {
      const validatedData = insertAnalyticsImportSchema.parse({
        userId: DEMO_USER_ID,
        ...req.body,
      });

      const analyticsImport = await storage.createAnalyticsImport(validatedData);
      await storage.updateUserActivity(DEMO_USER_ID);

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
  app.get("/api/analytics/exists", async (req, res) => {
    try {
      const hasAnalytics = await storage.hasAnalyticsImports(DEMO_USER_ID);
      res.json({ hasAnalytics });
    } catch (error) {
      console.error("Check analytics error:", error);
      res.status(500).json({ error: "Failed to check analytics" });
    }
  });

  // GET /api/analytics/:id - Get analytics import
  app.get("/api/analytics/:id", async (req, res) => {
    try {
      const analyticsImport = await storage.getAnalyticsImport(req.params.id);
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
  app.post("/api/ideas/generate", async (req, res) => {
    try {
      const { analyticsImportId } = req.body;

      let analyticsDataForAI: AnalyticsData = {
        trafficSources: {
          "For You Page": 60,
          "Following": 20,
          "Search": 15,
          "Other": 5,
        },
        searchQueries: [],
      };

      if (analyticsImportId) {
        const importData = await storage.getAnalyticsImport(analyticsImportId);
        if (importData) {
          analyticsDataForAI = {
            trafficSources: (importData.trafficSources as Record<string, number>) || analyticsDataForAI.trafficSources,
            searchQueries: (importData.searchQueries as string[]) || [],
          };
        }
      }

      const existingIdeas = await storage.getIdeasByUser(DEMO_USER_ID);
      const previousTitles = existingIdeas.map((idea) => idea.title);

      const generatedIdeas = await generateIdeas(analyticsDataForAI, previousTitles);
      
      const uniqueIdeas = checkDuplicates(generatedIdeas, previousTitles);

      const createdIdeas = await Promise.all(
        uniqueIdeas.map(async (idea, index) => {
          const newIdea = await storage.createIdea({
            userId: DEMO_USER_ID,
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

      await storage.updateUserActivity(DEMO_USER_ID);

      res.status(201).json(createdIdeas);
    } catch (error) {
      console.error("Generate ideas error:", error);
      res.status(500).json({ error: "Failed to generate ideas" });
    }
  });

  // GET /api/ideas - Get all active ideas for user
  app.get("/api/ideas", async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const activeIdeas = status
        ? await storage.getIdeasByUser(DEMO_USER_ID, status)
        : await storage.getActiveIdeas(DEMO_USER_ID);

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
  app.get("/api/ideas/:id", async (req, res) => {
    try {
      const idea = await storage.getIdea(req.params.id);
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
  app.patch("/api/ideas/:id", async (req, res) => {
    try {
      const idea = await storage.getIdea(req.params.id);
      if (!idea) {
        return res.status(404).json({ error: "Idea not found" });
      }

      const updatedIdea = await storage.updateIdea(req.params.id, req.body);
      await storage.updateUserActivity(DEMO_USER_ID);

      res.json(updatedIdea);
    } catch (error) {
      console.error("Update idea error:", error);
      res.status(500).json({ error: "Failed to update idea" });
    }
  });

  // DELETE /api/ideas/:id - Delete idea
  app.delete("/api/ideas/:id", async (req, res) => {
    try {
      const idea = await storage.getIdea(req.params.id);
      if (!idea) {
        return res.status(404).json({ error: "Idea not found" });
      }

      await storage.deleteIdea(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete idea error:", error);
      res.status(500).json({ error: "Failed to delete idea" });
    }
  });

  // ============ Checklist Endpoints ============

  // POST /api/ideas/:ideaId/checklist - Add new checklist item
  app.post("/api/ideas/:ideaId/checklist", async (req, res) => {
    try {
      const idea = await storage.getIdea(req.params.ideaId);
      if (!idea) {
        return res.status(404).json({ error: "Idea not found" });
      }

      const existingItems = await storage.getChecklistItems(req.params.ideaId);
      const position = existingItems.length;

      const item = await storage.createChecklistItem({
        ideaId: req.params.ideaId,
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
  app.patch("/api/checklist/:id", async (req, res) => {
    try {
      const updateData: { text?: string; isChecked?: boolean } = {};
      if (req.body.text !== undefined) {
        updateData.text = req.body.text;
      }
      if (req.body.isChecked !== undefined) {
        updateData.isChecked = req.body.isChecked;
      }
      const updatedItem = await storage.updateChecklistItem(req.params.id, updateData);
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
  app.patch("/api/checklist/:id/toggle", async (req, res) => {
    try {
      const updatedItem = await storage.toggleChecklistItem(req.params.id);
      if (!updatedItem) {
        return res.status(404).json({ error: "Checklist item not found" });
      }

      const uncheckedCount = await storage.countUncheckedItems(updatedItem.ideaId);
      
      if (uncheckedCount === 0) {
        const idea = await storage.getIdea(updatedItem.ideaId);
        if (!idea || idea.status === "completed") {
          return res.json({ ...updatedItem, ideaCompleted: false });
        }

        const user = await storage.getUser(DEMO_USER_ID);
        if (!user) {
          return res.json({ ...updatedItem, ideaCompleted: false });
        }

        const currentTier = user.currentTier || "amateur";
        const completedInTier = await storage.countCompletedIdeasInTier(DEMO_USER_ID, currentTier);

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
            await storage.updateUserTierProgress(DEMO_USER_ID, 0, newTier);

            await storage.createNotification({
              userId: DEMO_USER_ID,
              type: "tier_up",
              title: "Tier Up!",
              message: `Congratulations! You've reached ${newTier} tier!`,
            });
          } else {
            await storage.updateUserTierProgress(DEMO_USER_ID, 100);
          }
        } else {
          await storage.updateUserTierProgress(DEMO_USER_ID, progress);
        }

        await storage.createNotification({
          userId: DEMO_USER_ID,
          type: "idea_completed",
          title: "Idea Completed!",
          message: `You completed "${idea.title}"`,
        });

        await storage.updateUserActivity(DEMO_USER_ID);

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
  app.delete("/api/checklist/:id", async (req, res) => {
    try {
      await storage.deleteChecklistItem(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete checklist item error:", error);
      res.status(500).json({ error: "Failed to delete checklist item" });
    }
  });

  // ============ Progress Endpoints ============

  // GET /api/progress - Get user tier progress
  app.get("/api/progress", async (req, res) => {
    try {
      const user = await storage.getUser(DEMO_USER_ID);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const currentTier = user.currentTier || "amateur";
      const completedInTier = await storage.countCompletedIdeasInTier(DEMO_USER_ID, currentTier);
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
  app.post("/api/ideas/:id/complete", async (req, res) => {
    try {
      const idea = await storage.getIdea(req.params.id);
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

      const uncheckedCount = await storage.countUncheckedItems(req.params.id);
      if (uncheckedCount > 0) {
        return res.status(400).json({
          error: "Cannot complete idea with unchecked items",
          uncheckedCount,
        });
      }

      const user = await storage.getUser(DEMO_USER_ID);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const currentTier = user.currentTier || "amateur";
      const completedInTier = await storage.countCompletedIdeasInTier(DEMO_USER_ID, currentTier);

      await storage.updateIdea(req.params.id, {
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
          await storage.updateUserTierProgress(DEMO_USER_ID, 0, newTier);

          await storage.createNotification({
            userId: DEMO_USER_ID,
            type: "tier_up",
            title: "Tier Up!",
            message: `Congratulations! You've reached ${newTier} tier!`,
          });
        } else {
          await storage.updateUserTierProgress(DEMO_USER_ID, 100);
        }
      } else {
        await storage.updateUserTierProgress(DEMO_USER_ID, progress);
      }

      await storage.createNotification({
        userId: DEMO_USER_ID,
        type: "idea_completed",
        title: "Idea Completed!",
        message: `You completed "${idea.title}"`,
      });

      await storage.updateUserActivity(DEMO_USER_ID);

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
  app.get("/api/notifications", async (req, res) => {
    try {
      const unreadOnly = req.query.unread === "true";
      const notificationsList = await storage.getNotifications(DEMO_USER_ID, unreadOnly);
      res.json(notificationsList);
    } catch (error) {
      console.error("Get notifications error:", error);
      res.status(500).json({ error: "Failed to get notifications" });
    }
  });

  // PATCH /api/notifications/:id/read - Mark as read
  app.patch("/api/notifications/:id/read", async (req, res) => {
    try {
      await storage.markNotificationRead(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Mark notification read error:", error);
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  return httpServer;
}
