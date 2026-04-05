import { Suspense } from "react";
import { AttendanceTable } from "@/components/staff/attendance/AttendanceTable";
import { StatCard } from "@/components/ui/Card";
import { SectionBlock } from "@/components/ui/SectionBlock";
import { getTodayAttendance, getAttendanceKPI } from "@/modules/staff/services/attendance.service";
import { findAllActiveStaff } from "@/modules/staff/repositories/staff.repository";
import { Users, UserCheck, UserX, Clock } from "lucide-react";
import { serializePrisma } from "@/lib/serialize";

async function AttendanceKPIs() {
  const kpi = await getAttendanceKPI();

  return (
    <div className="grid grid-cols-4 gap-6">
      <StatCard label="Total Staff" value={kpi.totalStaff} icon={<Users className="h-5 w-5" />} color="indigo" />
      <StatCard label="Present Today" value={kpi.presentToday} icon={<UserCheck className="h-5 w-5" />} color="green" />
      <StatCard label="Absent Today" value={kpi.absentToday} icon={<UserX className="h-5 w-5" />} color={kpi.absentToday > 0 ? "red" : "green"} />
      <StatCard label="Late Check-ins" value={kpi.lateToday} icon={<Clock className="h-5 w-5" />} color={kpi.lateToday > 0 ? "yellow" : "green"} />
    </div>
  );
}

export default async function AttendancePage() {
  const [rows, activeStaff] = await Promise.all([
    getTodayAttendance(),
    findAllActiveStaff(),
  ]);

  const staffList = activeStaff.map((s) => ({
    id: s.id,
    firstName: s.firstName,
    lastName: s.lastName,
  }));

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-8 py-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
        <p className="mt-1 text-sm text-gray-500">Today&apos;s attendance overview and check-in management</p>
      </div>

      {/* KPI Section */}
      <SectionBlock
        title="Today&apos;s Summary"
        subtitle="Live check-in status, late arrivals, and absences"
        icon={<UserCheck className="h-4.5 w-4.5 text-teal-600" />}
        href="/staff"
        hrefLabel="View staff"
      >
        <Suspense
          fallback={
            <div className="grid grid-cols-4 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />
              ))}
            </div>
          }
        >
          <AttendanceKPIs />
        </Suspense>
      </SectionBlock>

      {/* Table Section */}
      <SectionBlock
        title="Today&apos;s Attendance"
        subtitle="Real-time check-in status for all active staff"
        icon={<Clock className="h-4.5 w-4.5 text-teal-600" />}
      >
        <AttendanceTable rows={serializePrisma(rows) as never} staffList={staffList} />
      </SectionBlock>
    </div>
  );
}
