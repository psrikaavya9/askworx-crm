"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users, Kanban, UserCheck, LayoutDashboard, ChevronDown,
  Wallet, Package, BarChart2, FileText, Wrench, Settings, FolderLock,
  ClipboardCheck, Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface NavChild { label: string; href: string; }
interface NavItem  { label: string; href?: string; icon: React.ReactNode; children?: NavChild[]; }
interface NavGroup { title: string; items: NavItem[]; }

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard",      href: "/dashboard",       icon: <LayoutDashboard  className="h-4 w-4" /> },
      { label: "Analytics",      href: "/analytics",       icon: <BarChart2        className="h-4 w-4" /> },
      { label: "Reports",        href: "/reports",         icon: <FileText         className="h-4 w-4" /> },
      { label: "Report Builder", href: "/reports/builder", icon: <Wrench           className="h-4 w-4" /> },
      { label: "Reviews",        href: "/reviews",         icon: <ClipboardCheck   className="h-4 w-4" /> },
    ],
  },
  {
    title: "Business",
    items: [
      {
        label: "CRM", icon: <Users className="h-4 w-4" />,
        children: [
          { label: "Leads",         href: "/crm/leads" },
          { label: "Pipeline",         href: "/crm/pipeline" },
          { label: "Dynamic Pipeline", href: "/crm/dynamic-pipeline" },
          { label: "Reminders",        href: "/crm/reminders" },
          { label: "Clients",          href: "/crm/clients" },
          { label: "Customer 360",  href: "/customers" },
        ],
      },
      {
        label: "Projects", icon: <Kanban className="h-4 w-4" />,
        children: [{ label: "All Projects", href: "/projects" }],
      },
      {
        label: "Staff & HR", icon: <UserCheck className="h-4 w-4" />,
        children: [
          { label: "Staff List",   href: "/staff" },
          { label: "Attendance",   href: "/attendance" },
          { label: "QR Check-In",  href: "/attendance/qr" },
          { label: "My Expenses",  href: "/staff/expenses" },
        ],
      },
      {
        label: "Finance", icon: <Wallet className="h-4 w-4" />,
        children: [
          { label: "Invoices", href: "/finance/invoices" },
          { label: "Expenses", href: "/finance/expenses" },
        ],
      },
      {
        label: "Inventory", icon: <Package className="h-4 w-4" />,
        children: [{ label: "Products", href: "/products" }],
      },
      {
        label: "HR Vault", icon: <FolderLock className="h-4 w-4" />,
        children: [
          { label: "Document Vault",  href: "/vault" },
          { label: "My Documents",    href: "/vault/my-documents" },
          { label: "Upload Document", href: "/vault/upload" },
          { label: "Training Videos", href: "/vault/videos" },
          { label: "Compliance",       href: "/vault/compliance" },
        ],
      },
    ],
  },
];

function NavLeaf({ item }: { item: NavItem & { href: string } }) {
  const pathname = usePathname();
  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

  return (
    <Link
      href={item.href}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
        isActive
          ? "bg-purple-50 text-purple-700"
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
      )}
    >
      <span className={cn(
        "shrink-0 transition-colors",
        isActive ? "text-purple-600" : "text-gray-400 group-hover:text-gray-600"
      )}>
        {item.icon}
      </span>
      <span className="truncate">{item.label}</span>
      {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-purple-500" />}
    </Link>
  );
}

function NavGroupItem({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const isGroupActive = item.children?.some(
    (c) => pathname === c.href || pathname.startsWith(c.href + "/")
  );
  const [open, setOpen] = useState(isGroupActive ?? false);

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
            isGroupActive
              ? "bg-purple-50 text-purple-700"
              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          )}
        >
          <span className={cn(
            "shrink-0 transition-colors",
            isGroupActive ? "text-purple-600" : "text-gray-400 group-hover:text-gray-600"
          )}>
            {item.icon}
          </span>
          <span className="flex-1 truncate text-left">{item.label}</span>
          <ChevronDown className={cn(
            "h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform duration-200",
            open && "rotate-180"
          )} />
        </button>

        {open && (
          <div className="ml-3.5 mt-1 space-y-0.5 border-l border-gray-200 pl-3">
            {item.children.map((child) => {
              const isChildActive = pathname === child.href || pathname.startsWith(child.href + "/");
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-all",
                    isChildActive
                      ? "bg-purple-50 font-semibold text-purple-700"
                      : "font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                  )}
                >
                  {isChildActive && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-purple-500" />}
                  {child.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return <NavLeaf item={item as NavItem & { href: string }} />;
}

export function Sidebar() {
  return (
    <aside className="flex h-screen w-[230px] shrink-0 flex-col border-r border-gray-200 bg-white shadow-lg">
      {/* Logo */}
      <div className="flex h-[64px] items-center gap-3 border-b border-gray-100 px-5">
        <img
          src="/icon-192.png"
          alt="AskWorx Logo"
          className="h-9 w-9 shrink-0 rounded-xl object-cover shadow-md shadow-purple-200"
        />
        <div>
          <span className="block text-[15px] font-bold tracking-tight text-gray-900">ASKworX</span>
          <span className="block text-[10px] font-semibold uppercase tracking-widest text-gray-400">
            Business Platform
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              {group.title}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavGroupItem key={item.label} item={item} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-100 p-3">
        <div className="group flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 transition-colors hover:bg-gray-50">
          <img
            src="/icon-192.png"
            alt="AskWorx Logo"
            className="h-8 w-8 shrink-0 rounded-full object-cover shadow-sm"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-800">Admin</p>
            <p className="truncate text-[11px] text-gray-400">admin@askworx.com</p>
          </div>
          <Settings className="h-3.5 w-3.5 shrink-0 text-gray-400 transition-colors group-hover:text-gray-600" />
        </div>
      </div>
    </aside>
  );
}
