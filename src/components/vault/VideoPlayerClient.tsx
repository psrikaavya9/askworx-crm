"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

// Load ReactPlayer only on client
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ReactPlayer = dynamic(() => import("react-player"), { ssr: false }) as any;

interface VideoPlayerClientProps {
  url?: string;
  videoUrl?: string;
  file_url?: string;
  cloudinaryUrl?: string;
}

export function VideoPlayerClient(props: VideoPlayerClientProps) {
  // Resolve correct video URL safely
  const finalUrl = useMemo(() => {
    const candidate =
      props.url ||
      props.videoUrl ||
      props.file_url ||
      props.cloudinaryUrl;

    // Validate URL (must start with http/https)
    if (candidate && (candidate.startsWith("http://") || candidate.startsWith("https://"))) {
      return candidate;
    }

    // Fallback video (always works)
    return "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
  }, [props]);

  // Debug (remove later)
  console.log("VIDEO URL:", finalUrl);

  return (
    <div
      style={{
        width: "100%",
        aspectRatio: "16/9",
        background: "#000",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <ReactPlayer
        url={finalUrl}
        controls
        width="100%"
        height="100%"
      />
    </div>
  );
}