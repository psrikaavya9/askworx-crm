"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState } from "react";
import { Search, Building2, Phone, ArrowRight, UserCircle2, AlertTriangle } from "lucide-react";
import { getInitials, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { HealthBadge } from "./HealthScoreCard";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CustomerHealthData {
  score:            number;
  status:           string;
  paymentScore:     number;
  engagementScore:  number;
  interactionScore: number;
  complaintScore:   number;
  revenueScore:     number;
}

export interface CustomerRow {
  id:        string;
  firstName: string;
  lastName:  string;
  email:     string;
  phone:     string | null;
  company:   string;
  jobTitle:  string | null;
  tags:      string[];
  createdAt: string;
  health:    CustomerHealthData | null;
}

// ---------------------------------------------------------------------------
// Avatar colour
// ---------------------------------------------------------------------------

const AVATAR_GRADIENTS = [
  "from-indigo-400 to-indigo-600",
  "from-purple-400 to-purple-600",
  "from-violet-400 to-violet-600",
  "from-blue-400 to-blue-600",
  "from-sky-400 to-sky-600",
];

function avatarGradient(name: string): string {
  return AVATAR_GRADIENTS[name.charCodeAt(0) % AVATAR_GRADIENTS.length];
}

// ---------------------------------------------------------------------------
// Score tooltip — pure CSS hover, no JS state
// ---------------------------------------------------------------------------

function ScoreTooltip({ health }: { health: CustomerHealthData }) {
  const rows: Array<{ label: string; value: number; bar: string }> = [
    { label: "Payment",     value: health.paymentScore,     bar: "bg-emerald-500" },
    { label: "Engagement",  value: health.engagementScore,  bar: "bg-blue-500"    },
    { label: "Interaction", value: health.interactionScore, bar: "bg-purple-500"  },
    { label: "Complaints",  value: health.complaintScore,   bar: "bg-amber-500"   },
    { label: "Revenue",     value: health.revenueScore,     bar: "bg-teal-500"    },
  ];

  return (
    // group/score scopes the hover to this element only
    <div className="group/score relative inline-flex items-center">
      <HealthBadge status={health.status} score={health.score} size="sm" />

      {/* Tooltip panel — invisible by default, appears on hover */}
      <div
        className={cn(
          "pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-48",
          "-translate-x-1/2",
          "invisible opacity-0",
          "transition-opacity duration-150",
          "group-hover/score:visible group-hover/score:opacity-100",
        )}
      >
        <div className="rounded-xl bg-gray-900 px-3.5 py-3 shadow-xl">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
            Score breakdown
          </p>
          <div className="space-y-1.5">
            {rows.map(({ label, value, bar }) => (
              <div key={label} className="space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-300">{label}</span>
                  <span className="text-[11px] font-semibold tabular-nums text-white">{value}</span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className={cn("h-full rounded-full", bar)}
                    style={{ width: `${value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          {/* Caret */}
          <div className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 rounded-sm bg-gray-900" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
        <UserCircle2 className="h-7 w-7 text-gray-400" />
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-700">
          {filtered ? "No customers match your search" : "No customers found"}
        </p>
        <p className="mt-1 text-xs text-gray-400">
          {filtered
            ? "Try a different name, company, or phone number."
            : "Customers converted from won leads will appear here."}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  customers: CustomerRow[];
  /** Count of customers needing attention (At Risk + Critical) */
  atRiskCount?: number;
}

export function CustomersTable({ customers, atRiskCount = 0 }: Props) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  // Client-side search filter over the server-sorted list
  const filtered = query.trim()
    ? customers.filter((c) => {
        const q = query.toLowerCase();
        return (
          `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
          c.company.toLowerCase().includes(q) ||
          (c.phone ?? "").includes(q) ||
          c.email.toLowerCase().includes(q)
        );
      })
    : customers;

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (query.trim()) params.set("q", query.trim());
    else params.delete("q");
    router.push(`${pathname}?${params.toString()}`);
  }

  function openCustomer(id: string) {
    router.push(`/customers/${id}`);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <form onSubmit={handleSearch} className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, company, or phone..."
            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors"
          />
        </form>

        {/* At-risk summary badge */}
        {atRiskCount > 0 && (
          <div className="flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            {atRiskCount} customer{atRiskCount !== 1 ? "s" : ""} need{atRiskCount === 1 ? "s" : ""} attention
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {filtered.length === 0 ? (
          <EmptyState filtered={!!query.trim()} />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Customer
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Company
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Phone
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Health
                  <span className="ml-1 text-[10px] normal-case tracking-normal text-gray-400">
                    (hover for breakdown)
                  </span>
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Since
                </th>
                <th className="w-10 px-5 py-3.5" />
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {filtered.map((customer) => {
                const isCritical = customer.health?.status === "Critical";
                const isAtRisk   = customer.health?.status === "At Risk";

                return (
                  <tr
                    key={customer.id}
                    onClick={() => openCustomer(customer.id)}
                    className={cn(
                      "group cursor-pointer transition-colors",
                      isCritical
                        ? "border-l-2 border-l-red-400 bg-red-50/30 hover:bg-red-50/60"
                        : isAtRisk
                          ? "border-l-2 border-l-orange-300 bg-orange-50/20 hover:bg-orange-50/40"
                          : "bg-white hover:bg-indigo-50/40",
                    )}
                  >
                    {/* Name + avatar */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold text-white shadow-sm",
                            avatarGradient(customer.firstName),
                          )}
                        >
                          {getInitials(customer.firstName, customer.lastName)}
                        </div>
                        <div>
                          <p
                            className={cn(
                              "font-semibold transition-colors",
                              isCritical
                                ? "text-red-700 group-hover:text-red-800"
                                : isAtRisk
                                  ? "text-orange-700 group-hover:text-orange-800"
                                  : "text-gray-900 group-hover:text-indigo-700",
                            )}
                          >
                            {customer.firstName} {customer.lastName}
                          </p>
                          {customer.jobTitle && (
                            <p className="text-xs text-gray-400">{customer.jobTitle}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Company */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 text-sm text-gray-700">
                        <Building2 className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        {customer.company}
                      </div>
                    </td>

                    {/* Phone */}
                    <td className="px-5 py-4">
                      {customer.phone ? (
                        <div className="flex items-center gap-1.5 text-sm text-gray-600">
                          <Phone className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                          {customer.phone}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-300">—</span>
                      )}
                    </td>

                    {/* Health score + tooltip */}
                    <td className="px-5 py-4">
                      {customer.health ? (
                        <ScoreTooltip health={customer.health} />
                      ) : (
                        <span className="text-xs text-gray-400">No data</span>
                      )}
                    </td>

                    {/* Since */}
                    <td className="px-5 py-4 text-sm text-gray-400">
                      {formatDate(customer.createdAt)}
                    </td>

                    {/* Arrow */}
                    <td className="px-5 py-4">
                      <ArrowRight className="h-4 w-4 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 group-hover:text-indigo-400" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      {filtered.length > 0 && (
        <p className="text-xs text-gray-400">
          {filtered.length} customer{filtered.length !== 1 ? "s" : ""}
          {query.trim() ? ` matching "${query.trim()}"` : ""}
          {" · "}sorted by health score (lowest first)
        </p>
      )}
    </div>
  );
}
