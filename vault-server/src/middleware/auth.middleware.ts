import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { AuthRequest, JwtPayload } from "../types";
import { sendUnauthorized } from "../utils/response.util";

// ---------------------------------------------------------------------------
// JWT authentication middleware
// Reads: Authorization: Bearer <token>
// Sets:  req.user = decoded payload
// ---------------------------------------------------------------------------

export function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    sendUnauthorized(res, "Missing or malformed Authorization header");
    return;
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
    req.user = payload;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      sendUnauthorized(res, "Token has expired");
    } else {
      sendUnauthorized(res, "Invalid token");
    }
  }
}
