import { Request, Response, NextFunction } from "express";

// ---------------------------------------------------------------------------
// Global error handler — must be registered LAST in Express middleware chain
// ---------------------------------------------------------------------------

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export function errorHandler(
  err:  AppError,
  req:  Request,
  res:  Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const status  = err.statusCode ?? 500;
  const message = err.message    ?? "Internal server error";

  // Log non-operational (unexpected) errors
  if (!err.isOperational || status >= 500) {
    console.error(`[vault-server] ${req.method} ${req.path} → ${status}:`, err);
  }

  res.status(status).json({
    success: false,
    error:   message,
    ...(process.env.NODE_ENV === "development" && {
      stack: err.stack,
    }),
  });
}

// ---------------------------------------------------------------------------
// 404 handler — registered after all routes
// ---------------------------------------------------------------------------

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error:   `Route ${req.method} ${req.path} not found`,
  });
}

// ---------------------------------------------------------------------------
// createError helper
// ---------------------------------------------------------------------------

export function createError(
  message: string,
  statusCode = 400
): AppError {
  const err = new Error(message) as AppError;
  err.statusCode    = statusCode;
  err.isOperational = true;
  return err;
}
