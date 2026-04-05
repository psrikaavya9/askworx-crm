// ---------------------------------------------------------------------------
// Allowed MIME types for documents and videos
// ---------------------------------------------------------------------------

const ALLOWED_DOC_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
  "video/webm",
];

function maxDocMb()   { return parseInt(process.env.MAX_DOC_SIZE_MB   ?? "20",  10); }
function maxVideoMb() { return parseInt(process.env.MAX_VIDEO_SIZE_MB ?? "500", 10); }

export function validateDocumentFile(mimetype: string, sizeBytes: number): string | null {
  if (!ALLOWED_DOC_TYPES.includes(mimetype)) {
    return `File type "${mimetype}" is not allowed. Allowed: PDF, Word, Excel, PowerPoint, TXT, images.`;
  }
  if (sizeBytes > maxDocMb() * 1024 * 1024) {
    return `File too large. Maximum document size is ${maxDocMb()} MB.`;
  }
  return null;
}

export function validateVideoFile(mimetype: string, sizeBytes: number): string | null {
  if (!ALLOWED_VIDEO_TYPES.includes(mimetype)) {
    return `File type "${mimetype}" is not allowed. Allowed: MP4, MOV, AVI, MKV, WebM.`;
  }
  if (sizeBytes > maxVideoMb() * 1024 * 1024) {
    return `File too large. Maximum video size is ${maxVideoMb()} MB.`;
  }
  return null;
}

/** Strips unsafe characters for use as a Cloudinary public_id. */
export function sanitizeStorageKey(filename: string): string {
  return filename
    .replace(/\.[^/.]+$/, "")           // strip extension
    .replace(/[^a-zA-Z0-9_\-]/g, "_")  // replace unsafe chars
    .slice(0, 100);
}
