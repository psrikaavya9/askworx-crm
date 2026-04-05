import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import path from "path";
import fs from "fs";
import { config } from "../config";
import { VideoProcessResult } from "../types";

// Point fluent-ffmpeg at the bundled binary
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// Ensure temp dir exists
if (!fs.existsSync(config.uploads.tempDir)) {
  fs.mkdirSync(config.uploads.tempDir, { recursive: true });
}

// ---------------------------------------------------------------------------
// Probe video metadata
// ---------------------------------------------------------------------------

export function probeVideo(
  inputPath: string
): Promise<ffmpeg.FfprobeData> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}

// ---------------------------------------------------------------------------
// Convert video to H.264 / AAC MP4 (web-safe)
// ---------------------------------------------------------------------------

export function convertToMp4(
  inputPath: string,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoCodec("libx264")
      .audioCodec("aac")
      .outputOptions([
        "-crf 23",         // quality (0=lossless, 51=worst; 23 is default)
        "-preset fast",    // encoding speed
        "-movflags +faststart", // moov atom first for streaming
        "-vf scale=trunc(iw/2)*2:trunc(ih/2)*2", // ensure even dimensions
      ])
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err) => reject(new Error(`FFmpeg convert error: ${err.message}`)))
      .run();
  });
}

// ---------------------------------------------------------------------------
// Extract thumbnail at 1-second mark
// ---------------------------------------------------------------------------

export function extractThumbnail(
  inputPath: string,
  outputDir: string,
  filename: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const thumbPath = path.join(outputDir, `${filename}.jpg`);
    ffmpeg(inputPath)
      .screenshots({
        timestamps: ["00:00:01.000"],
        filename:   `${filename}.jpg`,
        folder:     outputDir,
        size:       "640x360",
      })
      .on("end", () => resolve(thumbPath))
      .on("error", (err) =>
        reject(new Error(`FFmpeg thumbnail error: ${err.message}`))
      );
  });
}

// ---------------------------------------------------------------------------
// Full pipeline: probe → convert → thumbnail
// ---------------------------------------------------------------------------

export async function processVideo(
  inputPath: string,
  fileId: string
): Promise<VideoProcessResult> {
  const tempDir    = config.uploads.tempDir;
  const outputPath = path.join(tempDir, `${fileId}_processed.mp4`);

  // 1. Probe
  const probeData = await probeVideo(inputPath);
  const videoStream = probeData.streams.find(
    (s) => s.codec_type === "video"
  );
  const duration = Math.round(probeData.format.duration ?? 0);

  // 2. Convert
  await convertToMp4(inputPath, outputPath);

  // 3. Thumbnail
  const thumbPath = await extractThumbnail(outputPath, tempDir, fileId);

  return {
    processedPath: outputPath,
    thumbnailPath: thumbPath,
    duration,
    metadata: {
      width:   videoStream?.width   ?? 0,
      height:  videoStream?.height  ?? 0,
      codec:   videoStream?.codec_name ?? "unknown",
      bitrate: Math.round(
        parseInt(probeData.format.bit_rate ?? "0", 10) / 1000
      ), // kbps
    },
  };
}

// ---------------------------------------------------------------------------
// Cleanup temp files
// ---------------------------------------------------------------------------

export function cleanupTempFiles(...paths: string[]): void {
  for (const p of paths) {
    try {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch {
      // non-fatal — temp dir will be cleaned on restart
    }
  }
}
