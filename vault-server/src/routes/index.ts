import { Router } from "express";
import documentRoutes     from "./document.routes";
import videoRoutes        from "./video.routes";
import notificationRoutes from "./notification.routes";
import testRoutes         from "./test.routes"; // TEMP — remove after verification

const router = Router();

router.use("/documents",     documentRoutes);
router.use("/videos",        videoRoutes);
router.use("/notifications", notificationRoutes);
router.use("/test",          testRoutes);       // TEMP — remove after verification

// Health check (no auth required)
router.get("/health", (_req, res) => {
  res.json({
    status:  "ok",
    service: "askworx-vault-server",
    ts:      new Date().toISOString(),
  });
});

export default router;
