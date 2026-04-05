"use client";

import { useState, useEffect, useCallback } from "react";
import { QrCode, RefreshCw, Copy, Check } from "lucide-react";

// Dynamically load the qrcode library only in the browser
async function renderQRToCanvas(
  canvas: HTMLCanvasElement,
  content: string
): Promise<void> {
  const QRCode = (await import("qrcode")).default;
  await QRCode.toCanvas(canvas, content, {
    width: 280,
    margin: 2,
    color: { dark: "#1e1b4b", light: "#ffffff" },
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Seconds remaining until midnight UTC */
function secondsUntilMidnightUTC(): number {
  const now = new Date();
  const midnight = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1
    )
  );
  return Math.max(
    0,
    Math.floor((midnight.getTime() - now.getTime()) / 1000)
  );
}

function formatCountdown(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface QRDisplayCardProps {
  title?: string;
  showCountdown?: boolean;
  size?: number;
}

export function QRDisplayCard({
  title = "Daily Attendance QR",
  showCountdown = true,
  size = 280,
}: QRDisplayCardProps) {
  const [qrContent, setQrContent] = useState<string | null>(null);
  const [officeId, setOfficeId] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ✅ FIX: prevent hydration mismatch
  const [countdown, setCountdown] = useState<number | null>(null);

  const [copied, setCopied] = useState(false);
  const [canvasRef, setCanvasRef] = useState<HTMLCanvasElement | null>(null);

  // ── Fetch QR ─────────────────────────────────────────────
  const fetchToken = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/attendance/qr");
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      setQrContent(data.qrContent);
      setOfficeId(data.officeId ?? "");
      setDate(data.date ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load QR code");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  // ── Render QR ────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef || !qrContent) return;
    renderQRToCanvas(canvasRef, qrContent).catch((err) => {
      console.error("[QRDisplayCard] render error:", err);
    });
  }, [canvasRef, qrContent]);

  // ── Countdown FIX (hydration safe) ───────────────────────
  useEffect(() => {
    if (!showCountdown) return;

    function updateCountdown() {
      const secs = secondsUntilMidnightUTC();
      setCountdown(secs);

      if (secs === 0) fetchToken();
    }

    updateCountdown(); // run once after mount

    const id = setInterval(updateCountdown, 1000);
    return () => clearInterval(id);
  }, [showCountdown, fetchToken]);

  // ── Copy ────────────────────────────────────────────────
  async function handleCopy() {
    if (!qrContent) return;
    await navigator.clipboard.writeText(qrContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col items-center gap-5 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
      {/* Header */}
      <div className="flex flex-col items-center gap-1 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100">
          <QrCode className="h-5 w-5 text-indigo-600" />
        </div>
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>

        {officeId && (
          <p className="text-xs text-gray-500">
            Office:{" "}
            <span className="font-medium text-gray-700">{officeId}</span>
          </p>
        )}

        {date && (
          <p className="text-xs text-gray-500">
            Valid:{" "}
            <span className="font-medium text-gray-700">{date}</span>
          </p>
        )}
      </div>

      {/* QR */}
      <div
        className="relative flex items-center justify-center rounded-xl border border-gray-100 bg-white p-2 shadow-sm"
        style={{ width: size + 16, height: size + 16 }}
      >
        {loading ? (
          <div className="flex flex-col items-center gap-2 text-gray-400">
            <RefreshCw className="h-8 w-8 animate-spin" />
            <span className="text-xs">Generating…</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 text-red-500">
            <p className="text-xs text-center">{error}</p>
            <button
              onClick={fetchToken}
              className="text-xs font-medium underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        ) : (
          <canvas
            ref={(el) => setCanvasRef(el)}
            width={size}
            height={size}
            className="rounded-lg"
          />
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={fetchToken}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </button>

        <button
          onClick={handleCopy}
          disabled={!qrContent}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-green-500" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" /> Copy
            </>
          )}
        </button>
      </div>

      {/* Countdown */}
      {showCountdown && (
        <div className="w-full rounded-lg bg-indigo-50 px-4 py-2.5 text-center">
          <p className="text-[11px] font-medium text-indigo-600">
            Token rotates in{" "}
            <span className="font-mono text-sm font-bold tracking-wide">
              {countdown !== null ? formatCountdown(countdown) : "--:--:--"}
            </span>
          </p>
        </div>
      )}

      <p className="text-[11px] text-gray-400 text-center">
        Staff scan this code using the “QR Check-In” button.
        <br />
        Yesterday&apos;s QR will not work.
      </p>
    </div>
  );
}