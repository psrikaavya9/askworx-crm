"use client";

import { useState, useRef, useCallback, useId } from "react";
import {
  MapPin,
  Camera,
  X,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Navigation,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { useApiClient } from "@/lib/api-client";
import { useRouter } from "next/navigation";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_PHOTOS   = 5;
const MAX_PHOTO_MB = 5;

const OUTCOME_OPTIONS = [
  { value: "Interested",      label: "Interested" },
  { value: "Follow-up",       label: "Follow-up Required" },
  { value: "Not Interested",  label: "Not Interested" },
  { value: "Deal Discussed",  label: "Deal Discussed" },
];

const GPS_TIMEOUT_MS = 12_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GpsStatus = "idle" | "acquiring" | "acquired" | "denied" | "unavailable" | "timeout";

interface GpsCoords {
  lat:      number;
  lng:      number;
  accuracy: number; // metres
}

interface PhotoPreview {
  id:      string;
  name:    string;
  dataUrl: string; // base-64 data URL stored as photo reference
  sizeKb:  number;
}

interface FormState {
  purpose:     string;
  outcome:     string;
  notes:       string;
  duration:    string; // minutes, optional
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LogVisitModalProps {
  clientId:   string;
  /** Called after a successful submission so the parent can refresh its data. */
  onSuccess?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LogVisitModal({ clientId, onSuccess }: LogVisitModalProps) {
  const router     = useRouter();
  const api        = useApiClient();
  const fileInputId = useId();

  // ── modal open state ───────────────────────────────────────────────────────
  const [open, setOpen] = useState(false);

  // ── GPS ───────────────────────────────────────────────────────────────────
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>("idle");
  const [gps, setGps]             = useState<GpsCoords | null>(null);
  const gpsWatchRef               = useRef<number | null>(null);

  // ── Photos ────────────────────────────────────────────────────────────────
  const [photos, setPhotos]           = useState<PhotoPreview[]>([]);
  const [photoError, setPhotoError]   = useState("");

  // ── Form ──────────────────────────────────────────────────────────────────
  const [form, setForm] = useState<FormState>({
    purpose:  "",
    outcome:  "",
    notes:    "",
    duration: "",
  });
  const [errors, setErrors]     = useState<Partial<FormState>>({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting]   = useState(false);
  const [submitted, setSubmitted]     = useState(false);

  // ── Helpers ───────────────────────────────────────────────────────────────

  function setField(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validate(): boolean {
    const next: Partial<FormState> = {};
    if (!form.purpose.trim()) next.purpose = "Purpose is required";
    if (!form.outcome)        next.outcome = "Outcome is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  // ── GPS acquisition ───────────────────────────────────────────────────────

  const acquireGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus("unavailable");
      return;
    }

    setGpsStatus("acquiring");

    const timeout = window.setTimeout(() => {
      setGpsStatus("timeout");
    }, GPS_TIMEOUT_MS);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timeout);
        setGps({
          lat:      pos.coords.latitude,
          lng:      pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
        });
        setGpsStatus("acquired");
      },
      (err) => {
        clearTimeout(timeout);
        setGpsStatus(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable");
      },
      { enableHighAccuracy: true, timeout: GPS_TIMEOUT_MS, maximumAge: 0 },
    );
  }, []);

  // ── Open / close ──────────────────────────────────────────────────────────

  function handleOpen() {
    setOpen(true);
    setSubmitted(false);
    setSubmitError("");
    setErrors({});
    setPhotoError("");
    setPhotos([]);
    setForm({ purpose: "", outcome: "", notes: "", duration: "" });
    acquireGps();
  }

  function handleClose() {
    if (submitting) return; // prevent closing mid-flight
    setOpen(false);
    setGpsStatus("idle");
    setGps(null);
    if (gpsWatchRef.current !== null) {
      navigator.geolocation.clearWatch(gpsWatchRef.current);
      gpsWatchRef.current = null;
    }
  }

  // ── Photo handling ────────────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPhotoError("");
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) {
      setPhotoError(`Maximum ${MAX_PHOTOS} photos allowed`);
      e.target.value = "";
      return;
    }

    const accepted = files.slice(0, remaining);

    accepted.forEach((file) => {
      if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
        setPhotoError(`"${file.name}" exceeds ${MAX_PHOTO_MB} MB limit`);
        return;
      }
      if (!file.type.startsWith("image/")) {
        setPhotoError(`"${file.name}" is not an image`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (ev) => {
        setPhotos((prev) => {
          if (prev.length >= MAX_PHOTOS) return prev;
          return [
            ...prev,
            {
              id:      crypto.randomUUID(),
              name:    file.name,
              dataUrl: ev.target!.result as string,
              sizeKb:  Math.round(file.size / 1024),
            },
          ];
        });
      };
      reader.readAsDataURL(file);
    });

    // Reset so the same file can be re-added if removed
    e.target.value = "";
  }

  function removePhoto(id: string) {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    setPhotoError("");
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setSubmitError("");

    try {
      await api.post("/api/interactions", {
        clientId,
        type:    "VISIT",
        date:    new Date().toISOString(),
        purpose: form.purpose.trim(),
        outcome: form.outcome,
        notes:   form.notes.trim() || undefined,
        duration: form.duration ? parseInt(form.duration, 10) : undefined,
        gpsLat:  gps?.lat,
        gpsLng:  gps?.lng,
        photos:  photos.length > 0 ? photos.map((p) => p.dataUrl) : undefined,
      });

      setSubmitted(true);
      onSuccess?.();
      router.refresh();

      // Auto-close after brief success pause
      setTimeout(handleClose, 1_800);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to log visit");
    } finally {
      setSubmitting(false);
    }
  }

  // ── GPS status strip ──────────────────────────────────────────────────────

  function GpsStrip() {
    if (gpsStatus === "idle") return null;

    const configs = {
      acquiring: {
        bg:   "bg-blue-50 border-blue-200",
        icon: <Loader2 className="h-4 w-4 animate-spin text-blue-500" />,
        text: "Acquiring GPS location…",
        sub:  null,
        textColor: "text-blue-700",
      },
      acquired: {
        bg:   "bg-green-50 border-green-200",
        icon: <CheckCircle2 className="h-4 w-4 text-green-500" />,
        text: "GPS location captured",
        sub:  gps
          ? `${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)} · ±${gps.accuracy}m`
          : null,
        textColor: "text-green-700",
      },
      denied: {
        bg:   "bg-amber-50 border-amber-200",
        icon: <AlertCircle className="h-4 w-4 text-amber-500" />,
        text: "Location access denied",
        sub:  "Visit will be logged without GPS coordinates",
        textColor: "text-amber-700",
      },
      unavailable: {
        bg:   "bg-amber-50 border-amber-200",
        icon: <AlertCircle className="h-4 w-4 text-amber-500" />,
        text: "GPS unavailable on this device",
        sub:  "Visit will be logged without GPS coordinates",
        textColor: "text-amber-700",
      },
      timeout: {
        bg:   "bg-amber-50 border-amber-200",
        icon: <AlertCircle className="h-4 w-4 text-amber-500" />,
        text: "GPS timed out",
        sub:  "Visit will be logged without GPS coordinates",
        textColor: "text-amber-700",
      },
    } as const;

    const cfg = configs[gpsStatus as keyof typeof configs];
    if (!cfg) return null;

    return (
      <div className={cn("flex items-start gap-3 rounded-lg border px-3.5 py-3", cfg.bg)}>
        <span className="mt-0.5 shrink-0">{cfg.icon}</span>
        <div className="min-w-0">
          <p className={cn("text-sm font-medium", cfg.textColor)}>{cfg.text}</p>
          {cfg.sub && (
            <p className={cn("mt-0.5 text-xs truncate", cfg.textColor, "opacity-80")}>
              {cfg.sub}
            </p>
          )}
        </div>
        {(gpsStatus === "denied" || gpsStatus === "unavailable" || gpsStatus === "timeout") && (
          <button
            type="button"
            onClick={acquireGps}
            className="ml-auto shrink-0 text-xs text-amber-600 underline underline-offset-2 hover:text-amber-800"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  // ── Success screen ────────────────────────────────────────────────────────

  function SuccessScreen() {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </span>
        <div>
          <p className="text-base font-semibold text-gray-900">Visit Logged</p>
          <p className="mt-1 text-sm text-gray-500">
            The visit has been recorded and is pending review.
          </p>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Trigger button */}
      <Button
        variant="primary"
        icon={<Navigation className="h-4 w-4" />}
        onClick={handleOpen}
      >
        Log Visit
      </Button>

      {/* Modal */}
      <Modal
        open={open}
        onClose={handleClose}
        title="Log Visit"
        description="Record details of your client visit"
        size="md"
      >
        {submitted ? (
          <SuccessScreen />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* GPS strip */}
            <GpsStrip />

            {/* Global submit error */}
            {submitError && (
              <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                <p className="text-sm text-red-700">{submitError}</p>
              </div>
            )}

            {/* Purpose */}
            <Input
              label="Purpose"
              required
              placeholder="e.g. Product demo, Contract discussion"
              value={form.purpose}
              onChange={(e) => setField("purpose", e.target.value)}
              error={errors.purpose}
            />

            {/* Outcome */}
            <Select
              label="Outcome"
              required
              placeholder="Select outcome…"
              options={OUTCOME_OPTIONS}
              value={form.outcome}
              onChange={(e) => setField("outcome", e.target.value)}
              error={errors.outcome}
            />

            {/* Duration + Notes row */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-1">
                <Input
                  label="Duration (min)"
                  type="number"
                  min="1"
                  max="480"
                  placeholder="30"
                  value={form.duration}
                  onChange={(e) => setField("duration", e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <Textarea
                  label="Notes"
                  placeholder="Any additional context, follow-up actions…"
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setField("notes", e.target.value)}
                />
              </div>
            </div>

            {/* Photo upload */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">
                Photos
                <span className="ml-1.5 text-xs font-normal text-gray-400">
                  (up to {MAX_PHOTOS}, max {MAX_PHOTO_MB} MB each)
                </span>
              </label>

              {/* Previews */}
              {photos.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {photos.map((photo) => (
                    <div
                      key={photo.id}
                      className="group relative h-20 w-20 overflow-hidden rounded-lg border border-gray-200 bg-gray-100"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.dataUrl}
                        alt={photo.name}
                        className="h-full w-full object-cover"
                      />
                      {/* Overlay with remove button */}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => removePhoto(photo.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-white shadow"
                          title="Remove photo"
                        >
                          <X className="h-3.5 w-3.5 text-gray-700" />
                        </button>
                      </div>
                      {/* Size badge */}
                      <span className="absolute bottom-1 right-1 rounded bg-black/50 px-1 py-0.5 text-[10px] text-white">
                        {photo.sizeKb}KB
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload area — hidden when at max */}
              {photos.length < MAX_PHOTOS && (
                <label
                  htmlFor={fileInputId}
                  className={cn(
                    "flex cursor-pointer flex-col items-center justify-center gap-2",
                    "rounded-lg border-2 border-dashed border-gray-300 bg-gray-50",
                    "px-4 py-5 text-center transition-colors",
                    "hover:border-indigo-400 hover:bg-indigo-50",
                  )}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100">
                    <Upload className="h-4 w-4 text-gray-500" />
                  </span>
                  <span className="text-sm text-gray-600">
                    <span className="font-medium text-indigo-600">Click to upload</span>{" "}
                    or drag &amp; drop
                  </span>
                  <span className="text-xs text-gray-400">
                    PNG, JPG, WEBP · {MAX_PHOTOS - photos.length} slot
                    {MAX_PHOTOS - photos.length !== 1 ? "s" : ""} remaining
                  </span>
                  <input
                    id={fileInputId}
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    onChange={handleFileChange}
                  />
                </label>
              )}

              {photoError && (
                <p className="text-xs font-medium text-red-600">{photoError}</p>
              )}
            </div>

            {/* GPS coordinate display (compact, when acquired) */}
            {gps && (
              <div className="flex items-center gap-2 rounded-md bg-gray-50 px-3 py-2">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                <span className="text-xs text-gray-500">
                  {gps.lat.toFixed(6)}, {gps.lng.toFixed(6)}
                </span>
                <span className="ml-auto text-xs text-gray-400">±{gps.accuracy}m</span>
              </div>
            )}

            {/* Footer actions */}
            <div className="flex items-center justify-between border-t border-gray-100 pt-4">
              {/* GPS acquiring hint in footer */}
              {gpsStatus === "acquiring" && (
                <span className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Waiting for GPS…
                </span>
              )}
              {gpsStatus !== "acquiring" && <span />}

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleClose}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={submitting}
                  icon={<Camera className="h-4 w-4" />}
                >
                  Save Visit
                </Button>
              </div>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
