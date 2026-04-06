"use client";

import { useState, useEffect, useRef } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { CheckCircle, QrCode } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import type { Staff } from "@/modules/staff/types";

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

  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Reset state
  useEffect(() => {
    if (open) {
      setStaffId(preselectedStaffId ?? staffList[0]?.id ?? "");
      setScanning(false);
      setScannedContent(null);
      setSubmitting(false);
      setError(null);
      setSuccess(false);
    }
  }, [open]);

  // Start scanner
  useEffect(() => {
    if (!scanning) return;

    const scanner = new Html5Qrcode("qr-reader");
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        (decodedText) => {
          setScannedContent(decodedText);
          setScanning(false);
          scanner.stop().then(() => scanner.clear());
        },
        () => {}
      )
      .catch((err) => {
        setError("Camera error: " + err);
      });

    return () => {
      scanner.stop().catch(() => {});
    };
  }, [scanning]);

  async function handleSubmit() {
    if (!staffId) return setError("Please select a staff member.");
    if (!scannedContent) return setError("Please scan QR first.");

    setSubmitting(true);
    setError(null);

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
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setScannedContent(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="QR Code Check-In">
      <div className="space-y-5">
        {/* Staff */}
        <select
          value={staffId}
          onChange={(e) => setStaffId(e.target.value)}
          className="w-full border px-3 py-2 rounded"
        >
          {staffList.map((s) => (
            <option key={s.id} value={s.id}>
              {s.firstName} {s.lastName}
            </option>
          ))}
        </select>

        {/* Scanner */}
        {success ? (
          <div className="text-green-600 text-center">
            <CheckCircle className="mx-auto h-8 w-8" />
            Checked in!
          </div>
        ) : scannedContent ? (
          <div className="text-green-600 text-sm">
            QR scanned. Ready.
          </div>
        ) : scanning ? (
          <div id="qr-reader" className="w-full" />
        ) : (
          <Button onClick={() => setScanning(true)}>
            <QrCode className="mr-2 h-4 w-4" />
            Scan QR
          </Button>
        )}

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!scannedContent}>
            Check In
          </Button>
        </div>
      </div>
    </Modal>
  );
}