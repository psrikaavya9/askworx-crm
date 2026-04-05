"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Webcam from "react-webcam";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { MapPin, Camera, RefreshCw, CheckCircle, X, AlertTriangle, RotateCcw } from "lucide-react";
import type { Staff } from "@/modules/staff/types";
import { getGeoLocation, type GeoResult } from "@/lib/geoFence";

interface CheckInModalProps {
  open: boolean;
  type: "checkin" | "checkout";
  staffList: Pick<Staff, "id" | "firstName" | "lastName">[];
  preselectedStaffId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function CheckInModal({
  open,
  type,
  staffList,
  preselectedStaffId,
  onClose,
  onSuccess,
}: CheckInModalProps) {
  const [staffId, setStaffId] = useState(preselectedStaffId ?? staffList[0]?.id ?? "");
  const [geoResult, setGeoResult]           = useState<GeoResult | null>(null);
  const [locationError, setLocationError]   = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [selfie, setSelfie]             = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError]   = useState<string | null>(null);
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const webcamRef = useRef<Webcam>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStaffId(preselectedStaffId ?? staffList[0]?.id ?? "");
      setGeoResult(null);
      setLocationError(null);
      setSelfie(null);
      setCameraActive(false);
      setCameraError(null);
      setError(null);
      captureLocation();

    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Close webcam preview when modal closes
  useEffect(() => {
    if (!open) setCameraActive(false);
  }, [open]);

  async function captureLocation() {
    setLocationLoading(true);
    setLocationError(null);
    setGeoResult(null);
    try {
      const result = await getGeoLocation();
      setGeoResult(result);
      if (!result.isWithinRange) {
        setLocationError(
          `Outside office range — you are ${result.distance} m away (limit: 100 m).`
        );
      }
    } catch (err) {
      setLocationError(err instanceof Error ? err.message : "Location unavailable.");
    } finally {
      setLocationLoading(false);
    }
  }

  function openCamera() {
    setCameraError(null);
    setSelfie(null);
    setCameraActive(true);
  }

  const capturePhoto = useCallback(() => {
    const dataUrl = webcamRef.current?.getScreenshot() ?? null;
    if (!dataUrl) {
      setCameraError("Could not capture photo. Try again.");
      return;
    }
    setSelfie(dataUrl);
    setCameraActive(false);
  }, []);

  const handleCameraError = useCallback(() => {
    setCameraError("Camera access denied or not available.");
    setCameraActive(false);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!staffId) {
      setError("Please select a staff member.");
      return;
    }
    // Block check-in (not check-out) if outside office range
    if (type === "checkin" && geoResult && !geoResult.isWithinRange) {
      setError(`Outside office range — you are ${geoResult.distance} m away (limit: 100 m).`);
      return;
    }
    // Selfie is required for check-in
    if (type === "checkin" && !selfie) {
      setError("Selfie required. Please take a photo before checking in.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const endpoint = type === "checkin" ? "/api/attendance/checkin" : "/api/attendance/checkout";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId,
          latitude:  geoResult?.latitude  ?? undefined,
          longitude: geoResult?.longitude ?? undefined,
          location:  geoResult
            ? `${geoResult.latitude.toFixed(6)},${geoResult.longitude.toFixed(6)}`
            : undefined,
          selfie: selfie ?? undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        if (body.error && typeof body.error === "object") {
          const fieldMsgs = Object.entries(body.error.fieldErrors ?? {})
            .map(([f, msgs]) => `${f}: ${(msgs as string[]).join(", ")}`)
            .join("; ");
          const formMsgs = (body.error.formErrors ?? []).join("; ");
          throw new Error(fieldMsgs || formMsgs || "Validation failed");
        }
        throw new Error(body.error ?? "Request failed");
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  const title = type === "checkin" ? "Check In" : "Check Out";

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Staff selection */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Staff Member *</label>
          <select
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none"
          >
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.firstName} {s.lastName}
              </option>
            ))}
          </select>
        </div>

        {/* GPS Location + Geo-fence */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            <MapPin className="inline h-3.5 w-3.5 mr-1" />
            GPS Location
            {type === "checkout" && (
              <span className="ml-1 text-gray-400 font-normal">(optional — records checkout location)</span>
            )}
          </label>

          {locationLoading ? (
            <div className="flex items-center gap-2 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-500">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Getting location…</span>
            </div>
          ) : geoResult ? (
            <div
              className={`rounded-md px-3 py-2 text-sm ${
                geoResult.isWithinRange
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              <div className="flex items-center gap-2">
                {geoResult.isWithinRange ? (
                  <CheckCircle className="h-4 w-4 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                )}
                <span className="font-medium">
                  {geoResult.isWithinRange ? "Within office range" : "Outside office range"}
                </span>
                <button
                  type="button"
                  onClick={captureLocation}
                  className="ml-auto opacity-60 hover:opacity-100"
                  title="Retry"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-1 font-mono text-xs opacity-75">
                {geoResult.latitude.toFixed(6)}, {geoResult.longitude.toFixed(6)}
                &nbsp;·&nbsp;{geoResult.distance} m from office
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-500">
              <span className="flex-1">{locationError ?? "Location not captured"}</span>
              <button
                type="button"
                onClick={captureLocation}
                className="text-indigo-600 hover:text-indigo-800 text-xs font-medium"
              >
                {locationError ? "Retry" : "Get Location"}
              </button>
            </div>
          )}
        </div>

        {/* Selfie capture */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            <Camera className="inline h-3.5 w-3.5 mr-1" />
            Selfie (optional)
          </label>

          {selfie ? (
            /* ── Captured: thumbnail + retake ── */
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selfie}
                alt="Selfie preview"
                className="h-20 w-20 rounded-xl border border-gray-200 object-cover"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                icon={<RotateCcw className="h-4 w-4" />}
                onClick={openCamera}
              >
                Retake
              </Button>
              <button
                type="button"
                onClick={() => setSelfie(null)}
                className="ml-auto rounded-full p-1 text-gray-400 hover:text-red-500"
                title="Remove selfie"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : cameraActive ? (
            /* ── Live preview ── */
            <div className="space-y-2">
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                screenshotQuality={0.8}
                videoConstraints={{ width: 320, height: 240, facingMode: "user" }}
                onUserMediaError={handleCameraError}
                className="w-full max-w-xs rounded-xl border border-gray-200"
                mirrored
              />
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={capturePhoto}>
                  Capture
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setCameraActive(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            /* ── No selfie yet ── */
            <div className="space-y-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                icon={<Camera className="h-4 w-4" />}
                onClick={openCamera}
              >
                Take Selfie
              </Button>
              {cameraError && (
                <p className="text-xs text-red-500">{cameraError}</p>
              )}
            </div>
          )}
        </div>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={submitting}
            disabled={
              submitting ||
              // Block check-IN only when geo-fence failed; checkout always allowed
              (type === "checkin" && geoResult !== null && !geoResult.isWithinRange)
            }
          >
            {title}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
