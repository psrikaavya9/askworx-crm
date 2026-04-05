"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, UserCheck, Building2, MoreHorizontal } from "lucide-react";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate, getInitials } from "@/lib/utils";
import type { Client } from "@/modules/crm/types";
import type { PaginatedResult } from "@/modules/crm/types";

interface ClientsTableProps {
  data: PaginatedResult<Client>;
}

const CLIENT_COLORS = [
  "from-emerald-400 to-emerald-600",
  "from-teal-400 to-teal-600",
  "from-cyan-400 to-cyan-600",
  "from-green-400 to-green-600",
];

function getClientColor(name: string) {
  const idx = name.charCodeAt(0) % CLIENT_COLORS.length;
  return CLIENT_COLORS[idx];
}

export function ClientsTable({ data }: ClientsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");

  function updateParams(updates: Record<string, string | number>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === "") params.delete(k);
      else params.set(k, String(v));
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    updateParams({ search, page: 1 });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <form onSubmit={handleSearch} className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients..."
            className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-colors"
          />
        </form>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-md">
        {data.data.length === 0 ? (
          <EmptyState
            icon={<UserCheck className="h-6 w-6" />}
            title="No clients yet"
            description="Clients are automatically created when a lead is marked as Won."
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Client</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Company</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Contact</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Member Since</th>
                <th className="px-5 py-3.5 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.data.map((client) => {
                const gradColor = getClientColor(client.firstName);
                return (
                  <tr key={client.id} className="group bg-white transition-colors hover:bg-gray-50">
                    <td className="px-5 py-4">
                      <Link href={`/crm/clients/${client.id}`} className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradColor} text-xs font-bold text-white`}>
                          {getInitials(client.firstName, client.lastName)}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                            {client.firstName} {client.lastName}
                          </p>
                          {client.jobTitle && (
                            <p className="text-xs text-gray-400">{client.jobTitle}</p>
                          )}
                        </div>
                      </Link>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 text-gray-700">
                        <Building2 className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        {client.company}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-500">
                      <div>{client.email}</div>
                      {client.phone && <div className="text-xs text-gray-400">{client.phone}</div>}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-400">{formatDate(client.createdAt)}</td>
                    <td className="px-5 py-4">
                      <Link
                        href={`/crm/clients/${client.id}`}
                        className="invisible rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 group-hover:visible transition-colors"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {data.totalPages > 1 && (
        <Pagination
          page={data.page}
          totalPages={data.totalPages}
          total={data.total}
          pageSize={data.pageSize}
          onPageChange={(p) => updateParams({ page: p })}
        />
      )}
    </div>
  );
}
