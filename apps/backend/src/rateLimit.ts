import { Request, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";

/**
 * Request limits. The counters live in this process's memory, so they hold per backend instance:
 * production runs one instance (2026-10-02), and a second one would double every limit.
 * Sign-in itself is Clerk's (it limits attempts and locks accounts); these protect this backend
 * and, for signed-in routes, the Clerk Backend API quota that every authenticated request uses.
 */
export const LIMITS = {
  windowMs: 60_000,
  /**
   * Every route, per client IP. Generous on purpose: a room of students behind one campus NAT
   * shares a single IP, and a demo full of them must not trip it. It stops scripted floods.
   */
  public: 1000,
  /**
   * Routes that verify a token, per user (or per IP when the token has no readable subject).
   * Polling alone (open thread every 5s, conversation list every 15s, feed head every 30s) is
   * about 18 a minute per tab and tabs share the budget, so this leaves room for real use.
   */
  authenticated: 120,
} as const;

const ipKey = (req: Request) => ipKeyGenerator(req.ip ?? "");

/**
 * The token's subject *without* verifying it, used only to count requests: a forged subject
 * still has to pass isUser / requireUser after this, so all it can do is spend its own budget.
 */
export const authKey = (req: Request): string => {
  const token: unknown = req.body?.token;
  if (typeof token === "string") {
    const payload = jwt.decode(token);
    if (payload && typeof payload === "object" && typeof payload.sub === "string") return `user:${payload.sub}`;
  }
  return `ip:${ipKey(req)}`;
};

const tooMany: RequestHandler = (_req, res) => {
  res.status(429).json({ error: "Too many requests. Wait a minute and try again.", code: "rate_limited" });
};

export const createLimiters = (limits: { windowMs: number; public: number; authenticated: number } = LIMITS) => ({
  publicLimiter: rateLimit({
    windowMs: limits.windowMs,
    limit: limits.public,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: ipKey,
    handler: tooMany,
  }),
  authLimiter: rateLimit({
    windowMs: limits.windowMs,
    limit: limits.authenticated,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: authKey,
    handler: tooMany,
  }),
});
