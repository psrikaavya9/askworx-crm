import { Response, NextFunction } from "express";
import { z } from "zod";
import { AuthRequest, DocumentCategory, DocumentStatus, VaultAccessLevel, JwtPayload } from "../types";
import * as docService from "../services/document.service";
import { getDocumentAlerts } from "../services/expiry.service";
import {
  sendCreated, sendSuccess, sendPaginated, sendNoContent, sendError,
} from "../utils/response.util";
import { requireAdmin, requireManager } from "../middleware/rbac.middleware";

// ---------------------------------------------------------------------------
// Dev-mode fallback user — used when authenticate middleware is bypassed.
// Replace with real auth before going to production.
// ---------------------------------------------------------------------------
const DEV_USER: JwtPayload = {
  sub:   "dev-admin",
  email: "dev@askworx.com",
  role:  "ADMIN",
  iat:   0,
  exp:   9_999_999_999,
};

const getUser = (req: AuthRequest): JwtPayload => req.user ?? DEV_USER;

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const UploadDocSchema = z.object({
  title:       z.string().min(1).max(255),
  description: z.string().optional(),
  category:    z.enum(["POLICY","CONTRACT","HANDBOOK","FORM","SOP","COMPLIANCE","OTHER"]),
  accessLevel: z.enum(["ALL","MANAGER_ONLY","HR_ONLY","CUSTOM"]).optional(),
  allowedRoles: z.array(z.string()).optional(),
  allowedStaff: z.array(z.string()).optional(),
  tags:         z.array(z.string()).optional(),
  requiresAck:  z.coerce.boolean().optional(),
  expiresAt:    z.string().datetime({ offset: true }).optional(),
  metadata:     z.record(z.unknown()).optional(),
});

const NewVersionSchema = z.object({
  parentId:    z.string().uuid(),
  title:       z.string().min(1).max(255).optional(),
  description: z.string().optional(),
});

const StatusSchema = z.object({
  id:     z.string().uuid(),
  status: z.enum(["ACTIVE","ARCHIVED","EXPIRED"]),
});

const AckSchema = z.object({
  documentId: z.string().uuid(),
  signature:  z.string().optional(),
  notes:      z.string().optional(),
});

// ---------------------------------------------------------------------------
// POST /documents/upload
// ---------------------------------------------------------------------------

export async function uploadDocument(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.file) {
      sendError(res, "No file uploaded. Use multipart/form-data with field 'file'.", 400);
      return;
    }

    const body = UploadDocSchema.safeParse(req.body);
    if (!body.success) {
      sendError(res, body.error.errors.map((e) => e.message).join("; "), 422);
      return;
    }

    const doc = await docService.uploadDocument({
      ...body.data,
      localPath:    req.file.path,
      originalName: req.file.originalname,
      mimetype:     req.file.mimetype,
      fileSize:     req.file.size,
      uploadedBy:   getUser(req).sub,
    });

    sendCreated(res, doc);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /documents
// ---------------------------------------------------------------------------

export async function listDocuments(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const page         = Math.max(1, parseInt((req.query.page  as string) || "1",  10) || 1);
    const limit        = Math.max(1, parseInt((req.query.limit as string) || "20", 10) || 20);
    const category     = req.query.category     as DocumentCategory | undefined;
    const status       = req.query.status       as DocumentStatus   | undefined;
    const search       = req.query.search       as string           | undefined;
    const warningLevel = req.query.warningLevel as "none" | "low" | "medium" | "high" | undefined;
    const scope        = req.query.scope        as "mine" | "company" | undefined;

    const { rows, total } = await docService.listDocuments({
      category, status, search, warningLevel, scope, page, limit,
      user: getUser(req),
    });

    sendPaginated(res, rows, total, page, limit);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /documents/:id
// ---------------------------------------------------------------------------

export async function getDocument(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const doc = await docService.getDocumentById(req.params.id, getUser(req));
    sendSuccess(res, doc);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// PUT /documents/version  (upload a new version of an existing document)
// ---------------------------------------------------------------------------

export async function newDocumentVersion(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.file) {
      sendError(res, "No file uploaded.", 400);
      return;
    }

    const body = NewVersionSchema.safeParse(req.body);
    if (!body.success) {
      sendError(res, body.error.errors.map((e) => e.message).join("; "), 422);
      return;
    }

    const doc = await docService.createNewVersion({
      parentId:     body.data.parentId,
      title:        body.data.title,
      description:  body.data.description,
      localPath:    req.file.path,
      originalName: req.file.originalname,
      mimetype:     req.file.mimetype,
      fileSize:     req.file.size,
      uploadedBy:   getUser(req).sub,
    });

    sendCreated(res, doc);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// PATCH /documents/status
// ---------------------------------------------------------------------------

export async function updateStatus(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = StatusSchema.safeParse(req.body);
    if (!body.success) {
      sendError(res, body.error.errors.map((e) => e.message).join("; "), 422);
      return;
    }

    const doc = await docService.updateDocumentStatus(
      body.data.id,
      body.data.status as DocumentStatus
    );
    sendSuccess(res, doc);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// POST /documents/acknowledge
// ---------------------------------------------------------------------------

export async function acknowledgeDocument(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = AckSchema.safeParse(req.body);
    if (!body.success) {
      sendError(res, body.error.errors.map((e) => e.message).join("; "), 422);
      return;
    }

    const ack = await docService.acknowledgeDocument({
      documentId: body.data.documentId,
      staffId:    getUser(req).sub,
      ipAddress:  req.ip,
      userAgent:  req.headers["user-agent"],
      signature:  body.data.signature,
      notes:      body.data.notes,
    });

    sendSuccess(res, ack);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /documents/:id/ack-status
// ---------------------------------------------------------------------------

export async function getAckStatus(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await docService.getAckStatus(req.params.id);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /documents/alerts
// Returns expiring-soon / critical / expired document summaries
// ---------------------------------------------------------------------------

export async function getAlerts(
  _req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const alerts = await getDocumentAlerts();
    sendSuccess(res, alerts);
  } catch (err) {
    next(err);
  }
}
