import { config } from "../config";

// ---------------------------------------------------------------------------
// File-type & size validators
// ---------------------------------------------------------------------------

/** Validates a document upload. Returns an error string or null. */
export function validateDocumentFile(
  mimetype: string,
  sizeBytes: number
): string | null {
  if (!config.uploads.allowedDocTypes.includes(mimetype)) {
    return `File type "${mimetype}" is not allowed. Allowed types: PDF, Word, Excel, PowerPoint, TXT, images.`;
  }

  const maxBytes = config.uploads.maxDocSizeMb * 1024 * 1024;
  if (sizeBytes > maxBytes) {
    return `File too large. Maximum document size is ${config.uploads.maxDocSizeMb} MB.`;
  }

  return null;
}

/** Validates a video upload. Returns an error string or null. */
export function validateVideoFile(
  mimetype: string,
  sizeBytes: number
): string | null {
  if (!config.uploads.allowedVideoTypes.includes(mimetype)) {
    return `File type "${mimetype}" is not allowed. Allowed types: MP4, MOV, AVI, MKV, WebM.`;
  }

  const maxBytes = config.uploads.maxVideoSizeMb * 1024 * 1024;
  if (sizeBytes > maxBytes) {
    return `File too large. Maximum video size is ${config.uploads.maxVideoSizeMb} MB.`;
  }

  return null;
}

/** Derives a safe storage folder from a MIME type. */
export function storageFolderFromMime(mime: string): string {
  if (mime.startsWith("video/"))  return "vault/videos/raw";
  if (mime.startsWith("image/"))  return "vault/docs/images";
  return "vault/docs";
}

/** Strips dangerous characters for use in a Cloudinary public_id. */
export function sanitizeStorageKey(filename: string): string {
  return filename
    .replace(/\.[^/.]+$/, "")          // strip extension
    .replace(/[^a-zA-Z0-9_\-]/g, "_") // replace non-safe chars
    .slice(0, 100);
}
