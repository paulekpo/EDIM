import fs from "fs";
import path from "path";
import { pipeline } from "stream/promises";
import { createWriteStream } from "fs";
import { randomUUID } from "crypto";
import express, { Express, Request, Response } from "express";

const UPLOADS_DIR = path.resolve("uploads");

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class LocalStorageService {
  constructor() {}

  async getObjectEntityUploadURL(filename?: string): Promise<string> {
    const fileId = randomUUID();
    const ext = filename ? path.extname(filename) : "";
    // Return a relative URL that the client will PUT to.
    return `/api/uploads/file/${fileId}${ext}`;
  }

  normalizeObjectEntityPath(uploadURL: string): string {
    // extract the ID from the URL
    // URL: /api/uploads/file/<filename>
    const match = uploadURL.match(/\/api\/uploads\/file\/(.+)$/);
    if (match) {
      return `/uploads/${match[1]}`;
    }
    return uploadURL;
  }

  async getObjectEntityFile(objectPath: string) {
    // objectPath: /uploads/<filename>
    // We need to map this to filesystem path
    const filename = path.basename(objectPath);
    const filePath = path.join(UPLOADS_DIR, filename);

    if (!fs.existsSync(filePath)) {
      throw new ObjectNotFoundError();
    }

    return {
      download: async () => {
        const buffer = await fs.promises.readFile(filePath);
        return [buffer];
      },
      getMetadata: async () => {
        const stats = await fs.promises.stat(filePath);
        return [{
          contentType: "application/octet-stream", // Defaulting as we don't store metadata separately
          size: stats.size,
        }];
      },
    };
  }

  async uploadFile(filename: string, req: Request): Promise<void> {
    const filePath = path.join(UPLOADS_DIR, filename);
    const writeStream = createWriteStream(filePath);
    await pipeline(req, writeStream);
  }
}

export const storageService = new LocalStorageService();

export function registerStorageRoutes(app: Express) {
  // Endpoint to get upload URL
  app.post("/api/uploads/request-url", async (req, res) => {
    try {
      const { name } = req.body;
      const uploadURL = await storageService.getObjectEntityUploadURL(name);
      const objectPath = storageService.normalizeObjectEntityPath(uploadURL);
      res.json({
        uploadURL,
        objectPath,
        metadata: req.body,
      });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  // Endpoint to upload file (PUT)
  app.put("/api/uploads/file/:filename", async (req, res) => {
    try {
      const { filename } = req.params;
      await storageService.uploadFile(filename, req);
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // Serve uploaded files statically
  app.use("/uploads", express.static(UPLOADS_DIR));
}
