import { Router } from "express";
import { authenticate }   from "../middleware/auth.middleware";
import { requireManager } from "../middleware/rbac.middleware";
import {
  uploadVideo as uploadVideoMiddleware,
  withUploadErrorHandling,
} from "../middleware/upload.middleware";
import * as ctrl from "../controllers/video.controller";

const router = Router();

// Auth temporarily disabled — re-enable by uncommenting both lines below
// router.use(authenticate);

// ---------------------------------------------------------------------------
// POST /videos/upload
// Managers and above can upload videos
// ---------------------------------------------------------------------------
router.post(
  "/upload",
  // requireManager,          // re-enable with authenticate
  withUploadErrorHandling(uploadVideoMiddleware),
  ctrl.uploadVideo
);

// ---------------------------------------------------------------------------
// GET /videos
// All staff can list (access control applied in service)
// ---------------------------------------------------------------------------
router.get("/", ctrl.listVideos);

// ---------------------------------------------------------------------------
// POST /videos/progress
// Any authenticated staff can save their watch progress
// ---------------------------------------------------------------------------
router.post("/progress", ctrl.saveProgress);

// ---------------------------------------------------------------------------
// GET /videos/:id/progress
// Staff → own progress only
// Manager/Admin → all staff logs (or specific via ?staffId=)
// ---------------------------------------------------------------------------
router.get("/:id/progress", ctrl.getProgress);

// ---------------------------------------------------------------------------
// GET /videos/:id
// All staff can read (access control applied in service)
// ---------------------------------------------------------------------------
router.get("/:id", ctrl.getVideo);

export default router;
