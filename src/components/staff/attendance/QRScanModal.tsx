"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { CheckCircle, QrCode } from "lucide-react";
import type { OnResultFunction } from "react-qr-reader";
import type { Staff } from "@/modules/staff/types";

// Dynamically import to avoid SSR issues with camera APIs
const QrReader = dynamic(
  () => import("react-qr-reader").then((m) => m.QrReader),
  { ssr: false }
);

interface QRScanModalProps {
  open: boolean;
  staffList: Pick<Staff, "id" | "firstName" | "lastName">[];
  preselectedStaffId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function QRScanModal({
  open,
  staffList,
  preselectedStaffId,
  onClose,
  onSuccess,
}: QRScanModalProps) {
  const [staffId, setStaffId] = useState(preselectedStaffId ?? staffList[0]?.id ?? "");
  const [scanning, setScanning] = useState(false);
  const [scannedContent, setScannedContent] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  // prevent duplicate scan callbacks
  const processedRef = useRef(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setStaffId(preselectedStaffId ?? staffList[0]?.id ?? "");
      setScanning(false);
      setScannedContent(null);
      setSubmitting(false);
      setError(null);
      setSuccess(false);
      processedRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleScanResult: OnResultFunction = (result) => {
    if (!result || processedRef.current) return;
    const text = result.getText();
    if (!text) return;
    processedRef.current = true;
    setScanning(false);
    setScannedContent(text);
  };

  async function handleSubmit() {
    if (!staffId) { setError("Please select a staff member."); return; }
    if (!scannedContent) { setError("Please scan the QR code first."); return; }

    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/attendance/checkin/qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId, qrContent: scannedContent }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Request failed");
      }
      setSuccess(true);
      setTimeout(() => { onSuccess(); onClose(); }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      // allow re-scan
      setScannedContent(null);
      processedRef.current = false;
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="QR Code Check-In">
      <div className="space-y-5">
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

        {/* QR Scanner */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">
            <QrCode className="inline h-3.5 w-3.5 mr-1" />
            Scan Office QR Code
          </label>

          {success ? (
            <div className="flex flex-col items-center gap-2 rounded-lg bg-green-50 px-4 py-6 text-green-700">
              <CheckCircle className="h-8 w-8" />
              <p className="text-sm font-medium">Checked in successfully!</p>
            </div>
          ) : scannedContent ? (
            <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span>QR code scanned. Ready to check in.</span>
            </div>
          ) : scanning ? (
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <QrReader
                onResult={handleScanResult}
                constraints={{ facingMode: "environment" }}
                containerStyle={{ width: "100%" }}
              />
              <div className="bg-gray-50 px-3 py-2 text-center">
                <p className="text-xs text-gray-500">Point the camera at the QR code displayed on screen.</p>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon={<QrCode className="h-4 w-4" />}
              onClick={() => {
                setError(null);
                processedRef.current = false;
                setScanning(true);
              }}
            >
              Open Camera &amp; Scan
            </Button>
          )}
        </div>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting || success}>
            Cancel
          </Button>
          <Button
            type="button"
            loading={submitting}
            disabled={!scannedContent || success}
            onClick={handleSubmit}
          >
            Check In
          </Button>
        </div>
      </div>
    </Modal>
  );
}
