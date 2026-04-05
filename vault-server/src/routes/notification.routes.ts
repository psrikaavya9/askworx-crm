import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import * as ctrl        from "../controllers/notification.controller";

const router = Router();

// All notification routes require authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// GET  /notifications         — paginated list for the authenticated user
// GET  /notifications/count   — unread count (bell-badge)
// PATCH /notifications/read-all — bulk mark-as-read (must be before /:id)
// PATCH /notifications/:id/read — mark a single notification as read
// ---------------------------------------------------------------------------

router.get("/",          ctrl.listNotifications);
router.get("/count",     ctrl.getNotificationCount);
router.patch("/read-all",          ctrl.markAllRead);
router.patch("/:id/read",          ctrl.markRead);

export default router;
