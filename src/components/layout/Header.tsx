"use client";

import { Search, ChevronRight, Plus, LogOut } from "lucide-react";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { CrmReminderBell } from "@/components/crm/reminders/CrmReminderBell";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

interface Crumb { label: string; href?: string; }

function getBreadcrumbs(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  const LABELS: Record<string, string> = {
    dashboard: "Dashboard", analytics: "Analytics", reports: "Reports",
    builder: "Report Builder", crm: "CRM", leads: "Leads", pipeline: "Pipeline",
    clients: "Clients", projects: "Projects", new: "New Project",
    kanban: "Kanban Board", staff: "Staff", attendance: "Attendance",
    qr: "QR Check-In", finance: "Finance", invoices: "Invoices",
    expenses: "Expenses", products: "Products", "my-expenses": "My Expenses",
    vault: "Document Vault", "my-documents": "My Documents", upload: "Upload Document",
    videos: "Training Videos", compliance: "Compliance Dashboard",
    customers: "Clients",
    reviews:   "Reviews",
    reminders: "Reminders",
  };

  const crumbs: Crumb[] = [];
  let path = "";
  for (const segment of segments) {
    path += `/${segment}`;
    const label = LABELS[segment];
    if (!label) {
      const prev = crumbs[crumbs.length - 1]?.label;
      if (prev === "Leads") crumbs.push({ label: "Lead Detail" });
      else if (prev === "Clients") crumbs.push({ label: "Customer 360" });
      else if (prev === "Projects") crumbs.push({ label: "Project Detail", href: path });
      else if (prev === "Invoices") crumbs.push({ label: "Invoice Detail" });
      else if (prev === "Products") crumbs.push({ label: "Product Detail" });
      else crumbs.push({ label: "Detail" });
    } else {
      crumbs.push({ label, href: path });
    }
  }
  return crumbs;
}

export function Header() {
  const pathname = usePathname();
  const crumbs = getBreadcrumbs(pathname);
  const pageTitle = crumbs[crumbs.length - 1]?.label ?? "ASKworX";
  const { user, logout } = useAuth();
  const initials = user
    ? `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase()
    : "?";

  return (
    <header className="flex h-[64px] shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6 shadow-sm z-10">
      {/* Breadcrumbs */}
      <div className="flex min-w-0 items-center gap-2">
        {crumbs.length > 1 ? (
          <nav className="flex items-center gap-1 text-sm" aria-label="Breadcrumb">
            {crumbs.map((crumb, idx) => {
              const isLast = idx === crumbs.length - 1;
              return (
                <span key={idx} className="flex items-center gap-1">
                  {idx > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />}
                  {isLast ? (
                    <span className="truncate max-w-[200px] font-semibold text-gray-900">
                      {crumb.label}
                    </span>
                  ) : crumb.href ? (
                    <Link href={crumb.href} className="truncate max-w-[120px] text-gray-500 transition-colors hover:text-purple-600">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="truncate max-w-[120px] text-gray-500">{crumb.label}</span>
                  )}
                </span>
              );
            })}
          </nav>
        ) : (
          <h1 className="text-sm font-semibold text-gray-900">{pageTitle}</h1>
        )}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-2">
        <button className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-500 transition-all hover:border-purple-200 hover:bg-purple-50 hover:text-purple-700">
          <Search className="h-3.5 w-3.5" />
          <span className="hidden sm:block">Search...</span>
          <kbd className="hidden sm:block font-mono text-gray-400">⌘K</kbd>
        </button>

        <CrmReminderBell />
        <NotificationBell />

        <button className="rounded-lg p-1.5 text-gray-500 transition-all hover:bg-purple-50 hover:text-purple-600">
          <Plus className="h-4 w-4" />
        </button>

        <img
          src="/icon-192.png"
          alt="AskWorx Logo"
          className="ml-1 h-8 w-8 rounded-full object-cover shadow-sm"
        />

        <button
          onClick={logout}
          title="Sign out"
          className="rounded-lg p-1.5 text-gray-400 transition-all hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
