import "dotenv/config";

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  port: parseInt(optional("PORT", "4001"), 10),
  nodeEnv: optional("NODE_ENV", "development"),
  isDev: optional("NODE_ENV", "development") === "development",

  db: {
    url: required("DATABASE_URL"),
  },

  jwt: {
    secret: required("JWT_SECRET"),
    expiresIn: optional("JWT_EXPIRES_IN", "7d"),
  },

  cloudinary: {
    cloudName: required("CLOUDINARY_CLOUD_NAME"),
    apiKey:    required("CLOUDINARY_API_KEY"),
    apiSecret: required("CLOUDINARY_API_SECRET"),
  },

  uploads: {
    maxDocSizeMb:   parseInt(optional("MAX_DOC_SIZE_MB",   "20"),  10),
    maxVideoSizeMb: parseInt(optional("MAX_VIDEO_SIZE_MB", "500"), 10),
    tempDir: optional("FFMPEG_TEMP_DIR", "/tmp/vault-ffmpeg"),

    // Allowed MIME types
    allowedDocTypes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain",
      "image/png",
      "image/jpeg",
      "image/webp",
    ],
    allowedVideoTypes: [
      "video/mp4",
      "video/quicktime",
      "video/x-msvideo",
      "video/x-matroska",
      "video/webm",
    ],
  },
} as const;
