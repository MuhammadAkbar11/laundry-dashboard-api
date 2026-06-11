import { NextFunction, Request, Response } from "express";

const correlator = require("express-correlation-id");

export const CORRELATION_ID_HEADER = "X-Correlation-ID";

declare global {
  namespace Express {
    interface Request {
      correlationId?: () => string | undefined;
    }
  }
}

/**
 * Correlation ID scope middleware.
 *
 * express-correlation-id reuses an incoming X-Correlation-ID header when
 * present, or generates a new UUID when absent. All middleware and route
 * handlers registered after this middleware can access the ID through
 * req.correlationId() or correlator.getId().
 */
export const correlationIdMiddleware = correlator({
  header: CORRELATION_ID_HEADER,
});

/**
 * Expose correlation ID back to clients so they can quote request IDs
 * when reporting issues to support/admin teams.
 */
export function correlationIdResponseHeaderMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const correlationId = req.correlationId?.();

  if (correlationId) {
    res.setHeader(CORRELATION_ID_HEADER, correlationId);
  }

  return next();
}

/**
 * Utility for code that does not have direct access to Express req.
 * Returns undefined outside a request correlation scope.
 */
export function getCorrelationId(): string | undefined {
  return correlator.getId();
}