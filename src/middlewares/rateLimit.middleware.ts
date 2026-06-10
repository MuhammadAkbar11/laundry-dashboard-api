import { NextFunction, Request, Response } from "express";
import rateLimit, { MemoryStore } from "express-rate-limit";
import BaseError from "../helpers/error.helper";
import logger from "../configs/logger.config";
import {
  AUTH_RATE_LIMIT_LOG_NAME,
  AUTH_RATE_LIMIT_MAX,
  AUTH_RATE_LIMIT_MESSAGE,
  AUTH_RATE_LIMIT_WINDOW_MS,
} from "../configs/vars.config";

/**
 * Single shared in-memory store so the same key (email + IP) is tracked
 * across both the member and user login routes. Swap for a distributed
 * store if the API is ever horizontally scaled.
 */
const authRateLimitStore = new MemoryStore();

/**
 * Build the limiter key from the lowercased email and client IP.
 * Falls back to the IP only when no email is supplied (e.g. malformed body).
 */
export function buildAuthRateLimitKey(req: Request): string {
  const rawEmail =
    typeof req.body?.email === "string" ? req.body.email : "";
  const email = rawEmail.toLowerCase().trim();
  const ip =
    (req.clientIp as string | undefined) ||
    req.ip ||
    req.socket?.remoteAddress ||
    "unknown";
  return email ? `${email}|${ip}` : `ip:${ip}`;
}

/**
 * Reset the failed-attempt counter for a given key. Call this from the
 * controller after a successful authentication so legitimate users are
 * not penalised for past typos.
 */
export async function resetAuthRateLimit(key: string): Promise<void> {
  try {
    await authRateLimitStore.resetKey(key);
  } catch (err) {
    logger.warn(
      err,
      `[${AUTH_RATE_LIMIT_LOG_NAME}] failed to reset counter for key`
    );
  }
}

declare global {
  namespace Express {
    interface Request {
      authRateLimitKey?: string;
      resetAuthRateLimit?: () => Promise<void>;
    }
  }
}

/**
 * Reusable rate limit middleware for authentication endpoints.
 * - Tracks by `email + IP` per the issue requirements.
 * - Defaults: 5 attempts per 10 minutes (configurable via vars.config).
 * - On limit reached: logs a security event and propagates a generic
 *   `BaseError` through the global error middleware so the response
 *   shape matches the rest of the API.
 */
export const authRateLimit = rateLimit({
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  limit: AUTH_RATE_LIMIT_MAX,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  store: authRateLimitStore,
  keyGenerator: (req: Request) => buildAuthRateLimitKey(req),
  handler: (req: Request, _res: Response, next: NextFunction) => {
    const key = buildAuthRateLimitKey(req);
    const email = typeof req.body?.email === "string" ? req.body.email : null;
    const ip =
      (req.clientIp as string | undefined) ||
      req.ip ||
      req.socket?.remoteAddress ||
      "unknown";

    logger.warn(
      {
        timestamp: new Date().toISOString(),
        key,
        ip,
        endpoint: req.originalUrl,
        method: req.method,
        email,
      },
      `[${AUTH_RATE_LIMIT_LOG_NAME}] too many login attempts`
    );

    const error = new BaseError(
      "AUTH_RATE_LIMITED",
      429,
      AUTH_RATE_LIMIT_MESSAGE,
      { isOperational: true }
    );
    return next(BaseError.transformError(error));
  },
});

/**
 * Attaches the limiter key + reset helper to the request so controllers
 * can clear the counter after a successful login without re-implementing
 * the key logic.
 */
export function attachAuthRateLimitContext(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const key = buildAuthRateLimitKey(req);
  req.authRateLimitKey = key;
  req.resetAuthRateLimit = () => resetAuthRateLimit(key);
  return next();
}