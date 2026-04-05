"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import {
  MapPin, Clock, AlertTriangle, X, Camera,
  ChevronLeft, ChevronRight, Loader2,
} from "lucide-react";
import { AttendanceStatusBadge } from "@/components/staff/shared/AttendanceStatusBadge";
import { getInitials } from "@/lib/utils";
import type { AttendanceWithStaff } from "@/modules/staff/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AttendanceRecordsViewProps {
  /** Optional pre-filter by staff ID — omit to show all staff */
  staffId?: string;
  /** Number of records per page (default 20) */
  pageSize?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtTime(dt: string | Date | null | undefined): string {
  if (!dt) return "—";
  return format(new Date(dt), "HH:mm");
}

function fmtDate(dt: string | Date | null | undefined): string {
  if (!dt) return "—";
  return format(new Date(dt), "dd MMM yyyy");
}

/** Parse "lat,lng" location string into a display-friendly label */
function fmtLocation(loc: string | null | undefined): string {
  if (!loc) return "—";
  const [lat, lng] = loc.split(",").map(Number);
  if (isNaN(lat) || isNaN(lng)) return loc;
  return `${lat.toFixed(4)}°, ${lng.toFixed(4)}°`;
}

/** True when selfieUrl or checkInSelfie is a real image source (not raw base64 beyond a stub) */
function resolveImage(record: AttendanceWithStaff): string | null {
  // Prefer the dedicated selfieUrl column added in the last migration
  if (record.selfieUrl) return record.selfieUrl;
  // Fall back to checkInSelfie if it looks like a URL or data URL
  const raw = record.checkInSelfie;
  if (!raw) return null;
  if (raw.startsWith("/") || raw.startsWith("http") || raw.startsWith("data:image")) return raw;
  return null;
}

// ---------------------------------------------------------------------------
// Selfie image modal
// ---------------------------------------------------------------------------

interface ImageModalProps {
  record: AttendanceWithStaff;
  src: string;
  onClose: () => void;
}

function ImageModal({ record, src, onClose }: ImageModalProps) {
  // Close on backdrop click or Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-w-sm w-full rounded-2xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {record.staff.firstName} {record.staff.lastName}
            </p>
            <p className="text-xs text-gray-400">
              {fmtDate(record.checkInTime)} · {fmtTime(record.checkInTime)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Full image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={`Selfie — ${record.staff.firstName} ${record.staff.lastName}`}
          className="w-full object-cover max-h-80"
        />

        {/* GPS footer */}
        {record.checkInLocation && (
          <div className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-50 border-t border-gray-100">
            <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <span className="font-mono text-xs text-gray-500">
              {fmtLocation(record.checkInLocation)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row card
// ---------------------------------------------------------------------------

interface RecordCardProps {
  record: AttendanceWithStaff;
  onImageClick: (record: AttendanceWithStaff, src: string) => void;
}

function RecordCard({ record, onImageClick }: RecordCardProps) {
  const imageSrc  = resolveImage(record);
  const initials  = getInitials(record.staff.firstName, record.staff.lastName);
  const hasGps    = !!record.checkInLocation;
  const hasSelfie = !!imageSrc;

  return (
    <div className="flex items-start gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">

      {/* Avatar */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-indigo-200 text-sm font-bold text-indigo-700">
        {initials}
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0 space-y-1.5">
        {/* Name + status */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-gray-900 truncate">
            {record.staff.firstName} {record.staff.lastName}
          </span>
          <AttendanceStatusBadge status={record.attendanceStatus} />
          {!hasSelfie && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600 ring-1 ring-amber-200">
              <AlertTriangle className="h-2.5 w-2.5" /> No selfie
            </span>
          )}
        </div>

        {/* Department */}
        {record.staff.department && (
          <p className="text-xs text-gray-400">{record.staff.department}</p>
        )}

        {/* Check-in time */}
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span>
            {fmtDate(record.checkInTime)}&ensp;{fmtTime(record.checkInTime)}
            {record.checkOutTime && (
              <> &rarr; {fmtTime(record.checkOutTime)}</>
            )}
          </span>
        </div>

        {/* GPS */}
        <div className="flex items-center gap-1.5 text-xs">
          <MapPin className={`h-3.5 w-3.5 shrink-0 ${hasGps ? "text-emerald-500" : "text-gray-300"}`} />
          <span className={`font-mono ${hasGps ? "text-gray-500" : "text-gray-300"}`}>
            {hasGps ? fmtLocation(record.checkInLocation) : "No GPS data"}
          </span>
        </div>
      </div>

      {/* Selfie thumbnail */}
      <div className="shrink-0">
        {hasSelfie ? (
          <button
            onClick={() => onImageClick(record, imageSrc!)}
            className="group relative h-16 w-16 overflow-hidden rounded-xl border-2 border-indigo-200 shadow-sm hover:border-indigo-400 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500"
            title="View full selfie"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageSrc!}
              alt="Check-in selfie"
              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
          </button>
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50">
            <Camera className="h-5 w-5 text-gray-300" />
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AttendanceRecordsView({
  staffId,
  pageSize = 20,
}: AttendanceRecordsViewProps) {
  const [records, setRecords]   = useState<AttendanceWithStaff[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [modal, setModal]       = useState<{ record: AttendanceWithStaff; src: string } | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page:     String(page),
        pageSize: String(pageSize),
        sortBy:   "checkInTime",
        sortOrder: "desc",
      });
      if (staffId) params.set("staffId", staffId);

      const res = await fetch(`/api/attendance?${params}`);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const json = await res.json();
      setRecords(json.data ?? []);
      setTotal(json.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load records");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, staffId]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const openModal = useCallback((record: AttendanceWithStaff, src: string) => {
    setModal({ record, src });
  }, []);

  const closeModal = useCallback(() => setModal(null), []);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span className="text-sm">Loading records…</span>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-700">
        {error}
        <button
          onClick={fetchRecords}
          className="ml-3 text-xs font-semibold underline hover:no-underline"
        >
          Retry
        </button>
      </div>
    );
  }

  // ── Empty ─────────────────────────────────────────────────────────────────
  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-16 text-gray-400">
        <Camera className="h-8 w-8" />
        <p className="text-sm font-medium">No attendance records found</p>
      </div>
    );
  }

  // ── Records grid ──────────────────────────────────────────────────────────
  return (
    <>
      <div className="space-y-4">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
            {total} record{total !== 1 ? "s" : ""}
            {total > pageSize && ` · page ${page} of ${totalPages}`}
          </p>
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 text-xs tabular-nums text-gray-500">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Cards */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {records.map((record) => (
            <RecordCard
              key={record.id}
              record={record}
              onImageClick={openModal}
            />
          ))}
        </div>
      </div>

      {/* Image modal */}
      {modal && (
        <ImageModal
          record={modal.record}
          src={modal.src}
          onClose={closeModal}
        />
      )}
    </>
  );
}
