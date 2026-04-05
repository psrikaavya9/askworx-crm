import "dotenv/config";
import express, { Application } from "express";
import helmet   from "helmet";
import cors     from "cors";
import morgan   from "morgan";
import rateLimit from "express-rate-limit";

import { config }          from "./config";
import routes              from "./routes";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware";
import { getPool }         from "./db/pool";
import { ensureExpiryColumn }      from "./services/expiry.service";
import { ensureEmployeeIdColumn }  from "./services/document.service";
import { ensureNotificationTable } from "./services/notification.service";
import { startCronJobs }           from "./cron";

// ---------------------------------------------------------------------------
// Create Express app
// ---------------------------------------------------------------------------

const app: Application = express();

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------

app.use(helmet());

// ---------------------------------------------------------------------------
// CORS — tighten ALLOWED_ORIGINS in production
// ---------------------------------------------------------------------------

app.use(cors({
  origin:      process.env.ALLOWED_ORIGINS?.split(",") ?? "*",
  credentials: true,
}));

// ---------------------------------------------------------------------------
// Request logging
// ---------------------------------------------------------------------------

app.use(morgan(config.isDev ? "dev" : "combined"));

// ---------------------------------------------------------------------------
// Body parsers
// ---------------------------------------------------------------------------

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// ---------------------------------------------------------------------------
// Global rate limiter
// ---------------------------------------------------------------------------

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max:      300,              // requests per window per IP
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, error: "Too many requests. Please slow down." },
}));

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.use("/api/v1", routes);

// ---------------------------------------------------------------------------
// 404 + error handlers (must be LAST)
// ---------------------------------------------------------------------------

app.use(notFoundHandler);
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

async function bootstrap(): Promise<void> {
  // Verify DB connection
  try {
    await getPool().query("SELECT 1");
    console.log("[vault-server] ✓ Database connected");
  } catch (err) {
    console.error("[vault-server] ✗ Database connection failed:", err);
    process.exit(1);
  }

  // Core schema migrations
  await ensureExpiryColumn();
  await ensureEmployeeIdColumn();

  // Notification table — non-critical ancillary feature.
  // A failure here must not prevent the server from starting and serving
  // document / video endpoints. Log the error and continue.
  try {
    await ensureNotificationTable();
  } catch (err) {
    console.error(
      "[vault-server] ⚠ Notification table setup failed — reminder cron will be skipped:",
      err
    );
  }

  startCronJobs();

  app.listen(config.port, () => {
    console.log(
      `[vault-server] ✓ Running on http://localhost:${config.port}  (${config.nodeEnv})`
    );
    console.log("[vault-server]   Routes:");
    console.log("    GET  /api/v1/health");
    console.log("    POST /api/v1/documents/upload");
    console.log("    GET  /api/v1/documents");
    console.log("    GET  /api/v1/documents/:id");
    console.log("    PUT  /api/v1/documents/version");
    console.log("    PATCH /api/v1/documents/status");
    console.log("    POST /api/v1/documents/acknowledge");
    console.log("    GET  /api/v1/documents/:id/ack-status");
    console.log("    GET  /api/v1/documents/alerts");
    console.log("    POST /api/v1/videos/upload");
    console.log("    GET  /api/v1/videos");
    console.log("    GET  /api/v1/videos/:id");
    console.log("    POST /api/v1/videos/progress");
    console.log("    GET  /api/v1/videos/:id/progress");
    console.log("    GET  /api/v1/notifications");
    console.log("    GET  /api/v1/notifications/count");
    console.log("    PATCH /api/v1/notifications/read-all");
    console.log("    PATCH /api/v1/notifications/:id/read");
  });
}

bootstrap();

export default app;
