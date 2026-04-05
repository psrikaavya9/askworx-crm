"use client";

import { useSearchParams } from "next/navigation";

export default function VideoPlayerClient() {
  const searchParams = useSearchParams();
  const url = searchParams.get("url") ?? undefined;
  const finalUrl =
    (url && url.startsWith("http"))
      ? url.replace("http://", "https://")
      : "https://www.w3schools.com/html/mov_bbb.mp4";

  console.log("FINAL VIDEO URL:", finalUrl);

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
      <video
        src={finalUrl}
        controls
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}