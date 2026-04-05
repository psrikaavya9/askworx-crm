"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Plus, Search, Users, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { StaffRoleBadge } from "@/components/staff/shared/StaffRoleBadge";
import { Badge } from "@/components/ui/Badge";
import { AddStaffModal } from "@/components/staff/AddStaffModal";
import { EditStaffModal } from "@/components/staff/EditStaffModal";
import { getInitials } from "@/lib/utils";
import type { Staff } from "@/modules/staff/types";

interface PaginatedStaff {
  data: Staff[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function StaffTable({ data }: { data: PaginatedStaff }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(member: Staff) {
    if (!confirm(`Delete ${member.firstName} ${member.lastName}? This cannot be undone.`)) return;
    setDeletingId(member.id);
    try {
      const res = await fetch(`/api/staff/${member.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.error ?? "Failed to delete staff member");
      } else {
        router.refresh();
      }
    } finally {
      setDeletingId(null);
    }
  }

  function updateParams(updates: Record<string, string | number>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === "" || v === undefined) params.delete(k);
      else params.set(k, String(v));
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    updateParams({ search, page: 1 });
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <form onSubmit={handleSearch} className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search staff..."
              className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-colors"
            />
          </form>

          <select
            value={searchParams.get("role") ?? ""}
            onChange={(e) => updateParams({ role: e.target.value, page: 1 })}
            className="rounded-lg border border-gray-300 bg-white py-2.5 pl-3 pr-8 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-colors"
          >
            <option value="">All Roles</option>
            <option value="ADMIN">Admin</option>
            <option value="MANAGER">Manager</option>
            <option value="STAFF">Staff</option>
          </select>

          <select
            value={searchParams.get("status") ?? ""}
            onChange={(e) => updateParams({ status: e.target.value, page: 1 })}
            className="rounded-lg border border-gray-300 bg-white py-2.5 pl-3 pr-8 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-colors"
          >
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>

          <div className="ml-auto">
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setShowAddModal(true)}>
              Add Staff
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-md">
          {data.data.length === 0 ? (
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title="No staff members yet"
              description="Add your first staff member to get started."
              action={
                <Button icon={<Plus className="h-4 w-4" />} onClick={() => setShowAddModal(true)}>
                  Add Staff
                </Button>
              }
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Name</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Email</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Phone</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Department</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Role</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.data.map((member) => (
                  <tr key={member.id} className="group bg-white transition-colors hover:bg-gray-50">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gray-200 to-gray-300 text-xs font-bold text-gray-700">
                          {getInitials(member.firstName, member.lastName)}
                        </div>
                        <span className="font-semibold text-gray-900">
                          {member.firstName} {member.lastName}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-500">{member.email}</td>
                    <td className="px-5 py-4 text-gray-500">{member.phone ?? "—"}</td>
                    <td className="px-5 py-4 text-gray-500">{member.department ?? "—"}</td>
                    <td className="px-5 py-4">
                      <StaffRoleBadge role={member.role} />
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant={member.status === "ACTIVE" ? "green" : "gray"} dot>
                        {member.status === "ACTIVE" ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditingStaff(member)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(member)}
                          disabled={deletingId === member.id}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-40"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
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

      <AddStaffModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCreated={() => router.refresh()}
      />

      <EditStaffModal
        staff={editingStaff}
        onClose={() => setEditingStaff(null)}
        onUpdated={() => { setEditingStaff(null); router.refresh(); }}
      />
    </>
  );
}
