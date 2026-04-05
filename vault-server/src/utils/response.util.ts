import { Response } from "express";

// ---------------------------------------------------------------------------
// Standardised JSON response helpers
// ---------------------------------------------------------------------------

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?:   T;
  error?:  string;
  meta?:   Record<string, unknown>;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  meta?: Record<string, unknown>,
  status = 200
): void {
  const body: ApiResponse<T> = { success: true, data };
  if (meta) body.meta = meta;
  res.status(status).json(body);
}

export function sendCreated<T>(res: Response, data: T): void {
  sendSuccess(res, data, undefined, 201);
}

export function sendNoContent(res: Response): void {
  res.status(204).end();
}

export function sendError(
  res: Response,
  message: string,
  status = 400
): void {
  const body: ApiResponse = { success: false, error: message };
  res.status(status).json(body);
}

export function sendNotFound(res: Response, resource = "Resource"): void {
  sendError(res, `${resource} not found`, 404);
}

export function sendUnauthorized(res: Response, message = "Unauthorized"): void {
  sendError(res, message, 401);
}

export function sendForbidden(res: Response, message = "Forbidden"): void {
  sendError(res, message, 403);
}

export function sendPaginated<T>(
  res:     Response,
  data:    T[],
  total:   number,
  page:    number,
  limit:   number
): void {
  sendSuccess(res, data, {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}
