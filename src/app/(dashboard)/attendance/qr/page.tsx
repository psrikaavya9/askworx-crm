import { QRDisplayCard } from "@/components/staff/attendance/QRDisplayCard";

export const metadata = { title: "Attendance QR Code" };

export default function AttendanceQRPage() {
  return (
    <div className="flex min-h-[calc(100vh-56px)] items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-sm">
        <QRDisplayCard title="Daily Attendance QR Code" size={300} showCountdown />
      </div>
    </div>
  );
}
