import { Router } from "express";
import { authenticate }    from "../middleware/auth.middleware";
import { requireManager }  from "../middleware/rbac.middleware";
import {
  uploadDocument as uploadDocMiddleware,
  withUploadErrorHandling,
} from "../middleware/upload.middleware";
import * as ctrl from "../controllers/document.controller";

const router = Router();

// All document routes require a valid JWT
//router.use(authenticate);

// ---------------------------------------------------------------------------
// POST /documents/upload
// Managers and above can upload documents
// ---------------------------------------------------------------------------
router.post(
  "/upload",
  withUploadErrorHandling(uploadDocMiddleware),
  ctrl.uploadDocument
);

// ---------------------------------------------------------------------------
// GET /documents
// All staff can list (access control applied in service)
// ---------------------------------------------------------------------------
router.get("/", ctrl.listDocuments);

// ---------------------------------------------------------------------------
// PUT /documents/version
// Upload a new version of an existing document (manager+)
// ---------------------------------------------------------------------------
router.put(
  "/version",
  requireManager,
  withUploadErrorHandling(uploadDocMiddleware),
  ctrl.newDocumentVersion
);

// ---------------------------------------------------------------------------
// PATCH /documents/status
// Change document status (manager+)
// ---------------------------------------------------------------------------
router.patch("/status", requireManager, ctrl.updateStatus);

// ---------------------------------------------------------------------------
// POST /documents/acknowledge
// Any authenticated staff member can acknowledge a document
// ---------------------------------------------------------------------------
router.post("/acknowledge", ctrl.acknowledgeDocument);

// ---------------------------------------------------------------------------
// GET /documents/:id/ack-status
// Manager+ can see full ack status; staff only see their own (handled in ctrl)
// ---------------------------------------------------------------------------
router.get("/:id/ack-status",  ctrl.getAckStatus);

// ---------------------------------------------------------------------------
// GET /documents/alerts
// Returns expiry alert summaries (manager+)
// Must be registered BEFORE /:id to avoid "alerts" being treated as an id
// ---------------------------------------------------------------------------
router.get("/alerts",  ctrl.getAlerts);

// ---------------------------------------------------------------------------
// GET /documents/:id
// All staff can read (access control applied in service)
// ---------------------------------------------------------------------------
router.get("/:id", ctrl.getDocument);

export default router;
