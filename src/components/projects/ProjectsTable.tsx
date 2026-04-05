"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Plus, Search, FolderOpen, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProjectStatusBadge } from "@/components/projects/shared/ProjectStatusBadge";
import { formatDate } from "@/lib/utils";

interface ProjectRow {
  id: string;
  name: string;
  status: "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED";
  startDate: string | null;
  deadline: string | null;
  client: { id: string; firstName: string; lastName: string; company: string } | null;
  tasks: { hoursLogged: string | number }[];
  _count: { tasks: number };
}

interface PaginatedProjects {
  data: ProjectRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface ProjectsTableProps {
  data: PaginatedProjects;
}

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "PLANNING", label: "Planning" },
  { value: "ACTIVE", label: "Active" },
  { value: "ON_HOLD", label: "On Hold" },
  { value: "COMPLETED", label: "Completed" },
];

export function ProjectsTable({ data }: ProjectsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");

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

  const sortBy = searchParams.get("sortBy") ?? "createdAt";
  const sortOrder = searchParams.get("sortOrder") ?? "desc";

  function handleSort(col: string) {
    if (sortBy === col) {
      updateParams({ sortBy: col, sortOrder: sortOrder === "asc" ? "desc" : "asc" });
    } else {
      updateParams({ sortBy: col, sortOrder: "desc" });
    }
  }

  function SortIcon({ col }: { col: string }) {
    if (sortBy !== col) return <ChevronDown className="h-3.5 w-3.5 text-gray-300" />;
    return sortOrder === "asc" ? (
      <ChevronUp className="h-3.5 w-3.5 text-indigo-500" />
    ) : (
      <ChevronDown className="h-3.5 w-3.5 text-indigo-500" />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <form onSubmit={handleSearch} className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-colors"
          />
        </form>

        <select
          value={searchParams.get("status") ?? ""}
          onChange={(e) => updateParams({ status: e.target.value, page: 1 })}
          className="rounded-lg border border-gray-300 bg-white py-2.5 pl-3 pr-8 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-colors"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <div className="ml-auto">
          <Button
            icon={<Plus className="h-4 w-4" />}
            onClick={() => router.push("/projects/new")}
          >
            New Project
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-md">
        {data.data.length === 0 ? (
          <EmptyState
            icon={<FolderOpen className="h-6 w-6" />}
            title="No projects yet"
            description="Create your first project to get started."
            action={
              <Button
                icon={<Plus className="h-4 w-4" />}
                onClick={() => router.push("/projects/new")}
              >
                New Project
              </Button>
            }
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-5 py-3.5 text-left">
                  <button
                    onClick={() => handleSort("name")}
                    className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-800"
                  >
                    Project <SortIcon col="name" />
                  </button>
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Client
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Status
                </th>
                <th className="px-5 py-3.5 text-left">
                  <button
                    onClick={() => handleSort("startDate")}
                    className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-800"
                  >
                    Start <SortIcon col="startDate" />
                  </button>
                </th>
                <th className="px-5 py-3.5 text-left">
                  <button
                    onClick={() => handleSort("deadline")}
                    className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-800"
                  >
                    Deadline <SortIcon col="deadline" />
                  </button>
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Hours
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Tasks
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.data.map((project) => {
                const totalHours = project.tasks.reduce(
                  (sum, t) => sum + Number(t.hoursLogged),
                  0
                );
                const isOverdue =
                  project.deadline &&
                  new Date(project.deadline) < new Date() &&
                  project.status !== "COMPLETED";

                return (
                  <tr key={project.id} className="group bg-white transition-colors hover:bg-gray-50">
                    <td className="px-5 py-4">
                      <Link
                        href={`/projects/${project.id}`}
                        className="font-semibold text-gray-900 hover:text-indigo-600 transition-colors"
                      >
                        {project.name}
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-500">
                      {project.client
                        ? `${project.client.firstName} ${project.client.lastName} · ${project.client.company}`
                        : "—"}
                    </td>
                    <td className="px-5 py-4">
                      <ProjectStatusBadge status={project.status} />
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-500">
                      {formatDate(project.startDate)}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-sm font-medium ${isOverdue ? "text-red-600" : "text-gray-700"}`}>
                        {formatDate(project.deadline)}
                      </span>
                      {isOverdue && (
                        <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 ring-1 ring-red-200">
                          Overdue
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm font-medium text-gray-700">
                      {totalHours > 0 ? `${totalHours.toFixed(1)}h` : "—"}
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-gray-100 px-2 text-xs font-semibold text-gray-600">
                        {project._count.tasks}
                      </span>
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
