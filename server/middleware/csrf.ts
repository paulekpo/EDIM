import { Request, Response, NextFunction } from "express";
import { randomBytes } from "crypto";

// Extend session interface
declare module "express-session" {
  interface SessionData {
    csrfToken: string;
  }
}

const CSRF_COOKIE_NAME = "X-CSRF-Token";
const CSRF_HEADER_NAME = "X-CSRF-Token";

export function csrfMiddleware(req: Request, res: Response, next: NextFunction) {
  // 1. Generate CSRF token if not present in session
  if (!req.session.csrfToken) {
    req.session.csrfToken = randomBytes(16).toString("hex");
  }

  const token = req.session.csrfToken;

  // 2. Set the cookie so the client can read it
  // httpOnly must be false so JS can read it
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  });

  // 3. Verify on state-changing methods
  const method = req.method.toUpperCase();
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const headerToken = req.get(CSRF_HEADER_NAME);

    // We check against the session token, which is the source of truth.
    // The cookie is just the transport mechanism for the client to know the token.
    if (!headerToken || headerToken !== token) {
      return res.status(403).json({ error: "Invalid or missing CSRF token" });
    }
  }

  next();
}
