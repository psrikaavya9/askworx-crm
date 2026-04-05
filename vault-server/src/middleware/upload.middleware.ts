import multer, { FileFilterCallback } from "multer";
import path from "path";
import fs from "fs";
import { Request } from "express";
import { config } from "../config";

// ---------------------------------------------------------------------------
// Ensure temp directory exists
// ---------------------------------------------------------------------------

const TEMP_DIR = config.uploads.tempDir;
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// ---------------------------------------------------------------------------
// Disk storage — files are written to tempDir, then picked up by the service
// for upload to Cloudinary, then deleted.
// ---------------------------------------------------------------------------

const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, TEMP_DIR),
  filename:    (_req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const base = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${base}${ext}`);
  },
});

// ---------------------------------------------------------------------------
// File filter factories
// ---------------------------------------------------------------------------

function makeDocFilter() {
  return (
    _req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback
  ): void => {
    if (config.uploads.allowedDocTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Unsupported document type: ${file.mimetype}. ` +
          `Allowed: PDF, Word, Excel, PowerPoint, TXT, images.`
        )
      );
    }
  };
}

function makeVideoFilter() {
  return (
    _req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback
  ): void => {
    if (config.uploads.allowedVideoTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Unsupported video type: ${file.mimetype}. ` +
          `Allowed: MP4, MOV, AVI, MKV, WebM.`
        )
      );
    }
  };
}

// ---------------------------------------------------------------------------
// Exported multer instances
// ---------------------------------------------------------------------------

export const uploadDocument = multer({
  storage:    diskStorage,
  fileFilter: makeDocFilter(),
  limits: {
    fileSize: config.uploads.maxDocSizeMb * 1024 * 1024,
    files:    1,
  },
}).single("file");

export const uploadVideo = multer({
  storage:    diskStorage,
  fileFilter: makeVideoFilter(),
  limits: {
    fileSize: config.uploads.maxVideoSizeMb * 1024 * 1024,
    files:    1,
  },
}).single("file");

// ---------------------------------------------------------------------------
// Multer error handler — wraps multer middleware so errors are caught cleanly
// ---------------------------------------------------------------------------

import { Response, NextFunction } from "express";

type MulterHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => void;

export function withUploadErrorHandling(handler: MulterHandler): MulterHandler {
  return (req, res, next) => {
    handler(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          res.status(413).json({
            success: false,
            error:   "File too large. Check size limits.",
          });
          return;
        }
        res.status(400).json({ success: false, error: err.message });
        return;
      }
      if (err instanceof Error) {
        res.status(400).json({ success: false, error: err.message });
        return;
      }
      next();
    });
  };
}
