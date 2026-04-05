import Link from "next/link";
import { Kanban, CalendarDays, CheckSquare, ArrowRight, FolderOpen } from "lucide-react";
import { ProjectStatusBadge } from "@/components/projects/shared/ProjectStatusBadge";
import { formatDate } from "@/lib/utils";
import type { C360Project } from "../types";

interface Props {
  projects: C360Project[];
}

export function ProjectsTab({ projects }: Props) {
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
          <FolderOpen className="h-7 w-7 text-gray-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-700">No projects yet</p>
          <p className="mt-1 text-xs text-gray-400">
            Projects linked to this client will appear here.
          </p>
        </div>
      </div>
    );
  }

  const activeCount    = projects.filter((p) => p.status === "ACTIVE").length;
  const completedCount = projects.filter((p) => p.status === "COMPLETED").length;

  return (
    <div className="space-y-5">
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total", value: projects.length, color: "text-indigo-600" },
          { label: "Active", value: activeCount, color: "text-blue-600" },
          { label: "Completed", value: completedCount, color: "text-emerald-600" },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center"
          >
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      {/* Projects list */}
      <div className="space-y-3">
        {projects.map((project) => {
          const isOverdue =
            project.deadline &&
            new Date(project.deadline) < new Date() &&
            project.status !== "COMPLETED";

          return (
            <div
              key={project.id}
              className="group rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/projects/${project.id}`}
                      className="text-sm font-semibold text-gray-900 hover:text-indigo-600 transition-colors"
                    >
                      {project.name}
                    </Link>
                    <ProjectStatusBadge status={project.status} />
                    {isOverdue && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                        Overdue
                      </span>
                    )}
                  </div>
                  {project.description && (
                    <p className="mt-1 line-clamp-1 text-xs text-gray-500">
                      {project.description}
                    </p>
                  )}
                </div>

                <Link
                  href={`/projects/${project.id}`}
                  className="shrink-0 flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-gray-50 hover:text-gray-700"
                >
                  View <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              <div className="mt-3 flex items-center gap-5 text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <CheckSquare className="h-3.5 w-3.5" />
                  {project._count.tasks} task{project._count.tasks !== 1 ? "s" : ""}
                </span>
                {project.startDate && (
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Started {formatDate(project.startDate)}
                  </span>
                )}
                {project.deadline && (
                  <span
                    className={`flex items-center gap-1.5 ${
                      isOverdue ? "font-semibold text-red-600" : ""
                    }`}
                  >
                    <Kanban className="h-3.5 w-3.5" />
                    Due {formatDate(project.deadline)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
