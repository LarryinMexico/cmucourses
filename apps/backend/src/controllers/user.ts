import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { clerkClient } from "@clerk/clerk-sdk-node";

/** How long a "has a CMU email" answer from Clerk is reused, and how many users are remembered. */
export const CMU_EMAIL_CACHE_TTL_MS = 5 * 60_000;
const CMU_EMAIL_CACHE_MAX = 5000;
const cmuEmailCache = new Map<string, { hasCmuEmail: boolean; expires: number }>();

export const resetCmuEmailCache = () => cmuEmailCache.clear();

/**
 * Whether the Clerk user has a CMU address. Every authenticated request in prod asks this, and
 * Clerk's Backend API allows 1000 requests per 10s for the whole app, so the answer is cached per
 * user for a few minutes. A Clerk failure is not cached.
 */
const hasCmuEmail = async (sub: string): Promise<boolean> => {
  const now = Date.now();
  const cached = cmuEmailCache.get(sub);
  if (cached && cached.expires > now) return cached.hasCmuEmail;

  const user = await clerkClient.users.getUser(sub);
  const result = user.emailAddresses.some(({ emailAddress }) => /@(andrew\.)?cmu\.edu$/i.test(emailAddress));

  cmuEmailCache.delete(sub);
  if (cmuEmailCache.size >= CMU_EMAIL_CACHE_MAX) {
    const oldest = cmuEmailCache.keys().next().value;
    if (oldest !== undefined) cmuEmailCache.delete(oldest);
  }
  cmuEmailCache.set(sub, { hasCmuEmail: result, expires: now + CMU_EMAIL_CACHE_TTL_MS });
  return result;
};

/**
 * Why a token was refused. `code` is what the frontend branches on; `message` is shown as is.
 * Everything here is a 401: the caller must sign in again (or, for `not_cmu`, with another account).
 */
export type AuthErrorCode =
  | "missing"
  | "expired"
  | "not_before"
  | "invalid"
  | "wrong_host"
  | "not_cmu"
  | "auth_service_error";

export class AuthError extends Error {
  constructor(
    readonly code: AuthErrorCode,
    message: string
  ) {
    super(message);
  }
}

const MISSING_TOKEN = "You are not signed in. Sign in and try again.";

const verifyJwt = (token: string): JwtPayload => {
  try {
    const payload = jwt.verify(token, process.env.CLERK_PEM_KEY || "", { algorithms: ["RS256"] });
    if (!payload || typeof payload === "string") throw new AuthError("invalid", "Your sign-in is not valid.");
    return payload;
  } catch (e) {
    if (e instanceof AuthError) throw e;
    // jsonwebtoken checks exp and nbf itself and throws these subclasses of JsonWebTokenError.
    if (e instanceof jwt.TokenExpiredError) throw new AuthError("expired", "Your session has expired. Sign in again.");
    if (e instanceof jwt.NotBeforeError) {
      throw new AuthError("not_before", "Your sign-in is not valid yet. Check your device clock and try again.");
    }
    throw new AuthError("invalid", "Your sign-in is not valid. Sign in again.");
  }
};

export const verifyUserToken = async (token: unknown): Promise<JwtPayload> => {
  if (typeof token !== "string" || token === "") throw new AuthError("missing", MISSING_TOKEN);

  const payload = verifyJwt(token);

  const BACKEND_ENV = process.env.BACKEND_ENV || "dev";
  const CLERK_LOGIN_HOST = process.env.CLERK_LOGIN_HOST || "http://localhost:3010";
  if (BACKEND_ENV === "prod" && payload.azp && payload.azp !== CLERK_LOGIN_HOST) {
    throw new AuthError("wrong_host", "This sign-in was issued for another site. Sign in again here.");
  }

  const requireCmuAccount =
    process.env.REQUIRE_CMU_EMAIL === "true" || (BACKEND_ENV === "prod" && process.env.REQUIRE_CMU_EMAIL !== "false");
  if (requireCmuAccount) {
    if (!payload.sub) throw new AuthError("invalid", "Your sign-in is not valid. Sign in again.");
    let cmu: boolean;
    try {
      cmu = await hasCmuEmail(payload.sub);
    } catch (e) {
      console.error(e);
      throw new AuthError("auth_service_error", "Could not check your account. Try again in a moment.");
    }
    if (!cmu) throw new AuthError("not_cmu", "A CMU email account is required. Sign in with your Andrew account.");
  }

  return payload;
};

/** The 401 body for a refused token: `{ error, code }`. */
export const authErrorBody = (e: unknown): { error: string; code: AuthErrorCode } =>
  e instanceof AuthError
    ? { error: e.message, code: e.code }
    : { error: "Your sign-in is not valid.", code: "invalid" };

export type IsUserReqBody<T> = T & { token: string };

export function isUser<P, ResBody, ReqBody, ReqQuery, Locals extends Record<string, unknown>>(
  req: Request<P, ResBody, IsUserReqBody<ReqBody>, ReqQuery, Locals>,
  res: Response<ResBody, Locals>,
  next: NextFunction
) {
  if (process.env.AUTH_ENABLED !== "true") return next();

  verifyUserToken(req.body?.token)
    .then(() => next())
    .catch((e) => {
      console.log(e);
      res.status(401).json(authErrorBody(e) as ResBody);
    });
}

export type UserLocals = { userId: string };

/**
 * Like isUser, but for routes that act on the caller's own data: it always verifies the token,
 * even when AUTH_ENABLED is off, and exposes the Clerk user id as res.locals.userId.
 */
export function requireUser<P, ResBody, ReqBody, ReqQuery>(
  req: Request<P, ResBody, IsUserReqBody<ReqBody>, ReqQuery, UserLocals>,
  res: Response<ResBody, UserLocals>,
  next: NextFunction
) {
  verifyUserToken(req.body?.token)
    .then((payload) => {
      if (!payload.sub) throw new AuthError("invalid", "Your sign-in is not valid. Sign in again.");
      res.locals.userId = payload.sub;
      next();
    })
    .catch((e) => {
      console.log(e);
      res.status(401).json(authErrorBody(e) as ResBody);
    });
}
