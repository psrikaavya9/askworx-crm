"use client";

import { FolderLock, Upload, CheckCircle2, AlertTriangle, Files, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface VaultStats {
  total:      number;
  active:     number;
  expired:    number;
  pendingAck: number;
}

interface VaultHeaderProps {
  stats:         VaultStats;
  isAdmin?:      boolean;
  onUploadClick?: () => void;
}

function StatPill({
  icon,
  label,
  value,
  color,
}: {
  icon:  React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className={cn("flex items-center gap-2 rounded-xl border bg-white/80 px-4 py-3 shadow-sm backdrop-blur-sm", color)}>
      <span className="shrink-0">{icon}</span>
      <div>
        <p className="text-xl font-extrabold leading-none text-gray-900">{value}</p>
        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      </div>
    </div>
  );
}

export function VaultHeader({ stats, isAdmin = false, onUploadClick }: VaultHeaderProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/30 shadow-xl shadow-purple-900/20">
      {/* Gradient background */}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(135deg, #d25cf6 0%, #5c64f6 100%)" }}
      />
      {/* Glow orbs */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      {/* Top shimmer */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />

      <div className="relative px-8 py-7">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">

          {/* Left: identity */}
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 ring-2 ring-white/30 shadow-lg">
              <FolderLock className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-white">
                Document Vault
              </h1>
              <p className="mt-0.5 text-sm text-white/70">
                Secure storage for all HR documents
              </p>
            </div>
          </div>

          {/* Right: upload button */}
          {isAdmin && onUploadClick && (
            <button
              onClick={onUploadClick}
              className="flex shrink-0 items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-purple-700 shadow-lg shadow-purple-900/30 transition-all hover:brightness-105 hover:-translate-y-0.5 hover:shadow-xl active:scale-95"
            >
              <Upload className="h-4 w-4" />
              Upload Document
            </button>
          )}
        </div>

        {/* Stats row */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatPill
            icon={<Files className="h-4 w-4 text-purple-500" />}
            label="Total Docs"
            value={stats.total}
            color="border-purple-100"
          />
          <StatPill
            icon={<ShieldCheck className="h-4 w-4 text-green-500" />}
            label="Active"
            value={stats.active}
            color="border-green-100"
          />
          <StatPill
            icon={<CheckCircle2 className="h-4 w-4 text-orange-500" />}
            label="Pending Ack"
            value={stats.pendingAck}
            color="border-orange-100"
          />
          <StatPill
            icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
            label="Expired"
            value={stats.expired}
            color="border-red-100"
          />
        </div>
      </div>

      {/* Bottom shimmer */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
    </div>
  );
}
