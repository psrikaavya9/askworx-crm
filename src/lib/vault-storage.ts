import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import { Readable } from "stream";

// Initialize Cloudinary once at module load
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

export interface StorageUploadResult {
  url:      string;
  key:      string;
  fileSize: number;
  fileType: string;
}

// ---------------------------------------------------------------------------
// Upload a Buffer directly to Cloudinary (no temp files)
// ---------------------------------------------------------------------------

export async function uploadBuffer(
  buffer:       Buffer,
  publicId:     string,
  folder:       string,
  resourceType: "raw" | "video" | "image" | "auto" = "auto",
  fileSize      = 0
): Promise<StorageUploadResult> {
  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id:     publicId,
        folder,
        resource_type: resourceType,
        overwrite:     false,
      },
      (err, res) => {
        if (err || !res) return reject(err ?? new Error("Cloudinary upload failed"));
        resolve(res);
      }
    );
    Readable.from(buffer).pipe(stream);
  });

  return {
    url:      result.secure_url,
    key:      result.public_id,
    fileSize: fileSize || result.bytes || 0,
    fileType: result.format
      ? `${resourceType === "video" ? "video" : "application"}/${result.format}`
      : "application/octet-stream",
  };
}

// ---------------------------------------------------------------------------
// Upload thumbnail Buffer
// ---------------------------------------------------------------------------

export async function uploadThumbnailBuffer(
  buffer:   Buffer,
  publicId: string
): Promise<string> {
  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id:     publicId,
        folder:        "vault/videos/thumbs",
        resource_type: "image",
        overwrite:     false,
        transformation: [
          { width: 640, height: 360, crop: "fill" },
          { quality: "auto:good" },
        ],
      },
      (err, res) => {
        if (err || !res) return reject(err ?? new Error("Thumbnail upload failed"));
        resolve(res);
      }
    );
    Readable.from(buffer).pipe(stream);
  });

  return result.secure_url;
}

// ---------------------------------------------------------------------------
// Delete a file from Cloudinary by public_id
// ---------------------------------------------------------------------------

export async function deleteFile(
  key:          string,
  resourceType: "raw" | "video" | "image" = "raw"
): Promise<void> {
  await cloudinary.uploader.destroy(key, { resource_type: resourceType });
}
