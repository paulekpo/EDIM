import express from "express";
import { createServer } from "http";

const app = express();

// Middleware from server/index.ts
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    const logStart = process.hrtime();
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      // Optimization: Only log response body if not in production
      if (capturedJsonResponse && process.env.NODE_ENV !== "production") {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      // console.log(logLine);
    }
    const logEnd = process.hrtime(logStart);
    const logTimeMs = (logEnd[0] * 1000 + logEnd[1] / 1e6).toFixed(3);
    console.log(`[Benchmark] Logging logic took ${logTimeMs}ms`);
  });

  next();
});

app.get("/api/large", (req, res) => {
  // Create a ~1MB object
  const largeObject = {
      data: Array.from({ length: 5000 }, (_, i) => ({
          id: i,
          title: `Item ${i}`,
          description: "x".repeat(200)
      }))
  };
  res.json(largeObject);
});

const server = createServer(app);

server.listen(0, async () => {
    const address = server.address();
    if (typeof address === 'string' || !address) {
        throw new Error("Server address error");
    }
    const port = address.port;
    console.log(`Benchmark server listening on port ${port} in ${process.env.NODE_ENV || 'development'}`);

    try {
        console.log("Running benchmark requests...");
        for (let i = 0; i < 5; i++) {
             await fetch(`http://localhost:${port}/api/large`);
        }
    } finally {
        server.close();
        process.exit(0);
    }
});
