import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import fs from "fs";
import { config } from "../config";
import { StorageUploadResult } from "../types";

// ---------------------------------------------------------------------------
// Initialise Cloudinary once
// ---------------------------------------------------------------------------

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key:    config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
  secure:     true,
});

// ---------------------------------------------------------------------------
// Upload a local file to Cloudinary and return a StorageUploadResult.
// `publicId` must be unique — we build it from folder + UUID.
// ---------------------------------------------------------------------------

export async function uploadFile(
  localPath: string,
  publicId:  string,
  folder:    string,
  resourceType: "raw" | "video" | "image" | "auto" = "auto"
): Promise<StorageUploadResult> {
  const stat = fs.statSync(localPath);

  let result: UploadApiResponse;

  if (resourceType === "video") {
    // Large video: use upload_large (chunked upload)
    result = await cloudinary.uploader.upload_large(localPath, {
      public_id:     publicId,
      folder,
      resource_type: "video",
      chunk_size:    6 * 1024 * 1024,   // 6 MB chunks
      overwrite:     false,
    });
  } else {
    result = await cloudinary.uploader.upload(localPath, {
      public_id:     publicId,
      folder,
      resource_type: resourceType,
      overwrite:     false,
    });
  }

  return {
    url:      result.secure_url,
    key:      result.public_id,
    fileSize: stat.size,
    fileType: result.format
      ? `${resourceType === "video" ? "video" : "application"}/${result.format}`
      : "application/octet-stream",
  };
}

// ---------------------------------------------------------------------------
// Upload a thumbnail image
// ---------------------------------------------------------------------------

export async function uploadThumbnail(
  localPath: string,
  publicId:  string
): Promise<string> {
  const result = await cloudinary.uploader.upload(localPath, {
    public_id:     publicId,
    folder:        "vault/videos/thumbs",
    resource_type: "image",
    overwrite:     false,
    transformation: [
      { width: 640, height: 360, crop: "fill" },
      { quality: "auto:good" },
    ],
  });
  return result.secure_url;
}

// ---------------------------------------------------------------------------
// Delete a file from Cloudinary by its public_id
// ---------------------------------------------------------------------------

export async function deleteFile(
  key:          string,
  resourceType: "raw" | "video" | "image" = "raw"
): Promise<void> {
  await cloudinary.uploader.destroy(key, { resource_type: resourceType });
}

// ---------------------------------------------------------------------------
// Generate a short-lived signed URL for private assets (optional future use)
// ---------------------------------------------------------------------------

export function signedUrl(
  key:        string,
  expiresInSec = 3600
): string {
  return cloudinary.url(key, {
    sign_url:  true,
    type:      "authenticated",
    expires_at: Math.floor(Date.now() / 1000) + expiresInSec,
  });
}
