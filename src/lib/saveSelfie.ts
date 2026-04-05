/**
 * saveSelfie.ts
 *
 * Converts a base64 selfie (data URL or raw base64) to a JPEG file,
 * saves it to /public/uploads/selfies/, and returns the public URL.
 *
 * NOTE: Writing to /public is fine for local dev and self-hosted deployments.
 * For Vercel / read-only filesystems, swap writeFile for an S3/Cloudinary upload.
 */

import fs   from "fs";
import path from "path";

/** Directory under /public where selfies are stored */
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "selfies");

/**
 * @param base64Input  Either a full data URL ("data:image/jpeg;base64,…")
 *                     or a raw base64 string.
 * @param staffId      Used in the filename for traceability.
 * @returns            Public URL path, e.g. "/uploads/selfies/attendance_abc_20250318_143022.jpg"
 */
export async function saveSelfie(
  base64Input: string,
  staffId:     string,
): Promise<string> {
  // Strip the data URL header if present
  const base64Data = base64Input.startsWith("data:")
    ? base64Input.replace(/^data:image\/\w+;base64,/, "")
    : base64Input;

  const buffer = Buffer.from(base64Data, "base64");

  // Generate filename: attendance_{staffId}_{YYYYMMDD_HHMMSS}.jpg
  const now       = new Date();
  const datePart  = now.toISOString().slice(0, 10).replace(/-/g, "");   // "20250318"
  const timePart  = now.toTimeString().slice(0, 8).replace(/:/g, "");   // "143022"
  const safeId    = staffId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename  = `attendance_${safeId}_${datePart}_${timePart}.jpg`;

  // Ensure upload directory exists
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  // Write file
  const filePath = path.join(UPLOAD_DIR, filename);
  await fs.promises.writeFile(filePath, buffer);

  return `/uploads/selfies/${filename}`;
}
