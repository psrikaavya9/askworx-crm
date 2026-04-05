"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, LogOut, Users, QrCode } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { AttendanceStatusBadge } from "@/components/staff/shared/AttendanceStatusBadge";
import { CheckInModal } from "@/components/staff/attendance/CheckInModal";
import { QRScanModal } from "@/components/staff/attendance/QRScanModal";
import { getInitials } from "@/lib/utils";
import { format } from "date-fns";
import type { TodayAttendanceRow } from "@/modules/staff/types";
import type { Staff } from "@/modules/staff/types";

interface AttendanceTableProps {
  rows: TodayAttendanceRow[];
  staffList: Pick<Staff, "id" | "firstName" | "lastName">[];
}

function formatTime(dt: Date | string | null | undefined): string {
  if (!dt) return "—";
  return format(new Date(dt), "HH:mm");
}

export function AttendanceTable({ rows, staffList }: AttendanceTableProps) {
  const router = useRouter();
  const [modal, setModal] = useState<{
    open: boolean;
    type: "checkin" | "checkout";
    staffId?: string;
  }>({ open: false, type: "checkin" });
  const [qrModal, setQrModal] = useState<{ open: boolean; staffId?: string }>({
    open: false,
  });

  function openCheckIn(staffId?: string) {
    setModal({ open: true, type: "checkin", staffId });
  }

  function openCheckOut(staffId?: string) {
    setModal({ open: true, type: "checkout", staffId });
  }

  function openQRScan(staffId?: string) {
    setQrModal({ open: true, staffId });
  }

  function handleSuccess() {
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Toolbar */}
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Today&apos;s Attendance</h2>
            <p className="text-xs text-gray-500">Live check-in and check-out status</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<LogIn className="h-3.5 w-3.5" />}
              onClick={() => openCheckIn()}
            >
              Check In
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<QrCode className="h-3.5 w-3.5" />}
              onClick={() => openQRScan()}
            >
              Scan QR
            </Button>
            <Button
              size="sm"
              icon={<LogOut className="h-3.5 w-3.5" />}
              onClick={() => openCheckOut()}
            >
              Check Out
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-md">
          {rows.length === 0 ? (
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title="No active staff"
              description="Add staff members to track attendance."
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Staff Name</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Department</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Check In</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Check Out</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map(({ staff, attendance }) => {
                  const checkedIn = !!attendance?.checkInTime;
                  const checkedOut = !!attendance?.checkOutTime;
                  const initials = getInitials(staff.firstName, staff.lastName);

                  return (
                    <tr key={staff.id} className="group bg-white transition-colors hover:bg-gray-50">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-100 to-teal-200 text-xs font-bold text-teal-700">
                            {initials}
                          </div>
                          <span className="font-semibold text-gray-900">
                            {staff.firstName} {staff.lastName}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-gray-500">{(staff as Staff & { department?: string }).department ?? "—"}</td>
                      <td className="px-5 py-4">
                        {checkedIn ? (
                          <span className="font-semibold text-emerald-600">
                            {formatTime(attendance?.checkInTime)}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {checkedOut ? (
                          <span className="font-medium text-gray-700">{formatTime(attendance?.checkOutTime)}</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {attendance ? (
                          <AttendanceStatusBadge status={attendance.attendanceStatus} />
                        ) : (
                          <AttendanceStatusBadge status="ABSENT" />
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {!checkedIn && (
                          <button
                            onClick={() => openCheckIn(staff.id)}
                            className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 transition-colors ring-1 ring-indigo-200"
                          >
                            Check In
                          </button>
                        )}
                        {checkedIn && !checkedOut && (
                          <button
                            onClick={() => openCheckOut(staff.id)}
                            className="rounded-lg bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-600 hover:bg-orange-100 transition-colors ring-1 ring-orange-200"
                          >
                            Check Out
                          </button>
                        )}
                        {checkedIn && checkedOut && (
                          <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600 ring-1 ring-emerald-200">
                            Done
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <CheckInModal
        open={modal.open}
        type={modal.type}
        staffList={staffList}
        preselectedStaffId={modal.staffId}
        onClose={() => setModal((m) => ({ ...m, open: false }))}
        onSuccess={handleSuccess}
      />

      <QRScanModal
        open={qrModal.open}
        staffList={staffList}
        preselectedStaffId={qrModal.staffId}
        onClose={() => setQrModal((m) => ({ ...m, open: false }))}
        onSuccess={handleSuccess}
      />
    </>
  );
}
