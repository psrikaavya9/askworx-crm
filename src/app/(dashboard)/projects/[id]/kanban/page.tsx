import { notFound } from "next/navigation";
import Link from "next/link";
import { findProjectById } from "@/modules/projects/repositories/project.repository";
import { serializePrisma } from "@/lib/serialize";
import { TaskBoard } from "@/components/projects/kanban/TaskBoard";
import { ProjectStatusBadge } from "@/components/projects/shared/ProjectStatusBadge";
import { formatDate } from "@/lib/utils";
import { ArrowLeft, CalendarDays } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function KanbanPage({ params }: PageProps) {
  const { id } = await params;
  const project = await findProjectById(id);
  if (!project) notFound();

  const serializedTasks = serializePrisma(project.tasks);

  const totalHours = project.tasks.reduce(
    (sum, t) => sum + Number(t.hoursLogged),
    0
  );

  return (
    <div className="flex h-full flex-col p-6">
      {/* Header */}
      <div className="mb-5">
        <Link
          href={`/projects/${id}`}
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Project
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-gray-900">{project.name}</h1>
              <ProjectStatusBadge status={project.status} />
            </div>
            <div className="mt-1 flex items-center gap-4 text-sm text-gray-400">
              <span>{project.tasks.length} tasks</span>
              {totalHours > 0 && <span>{totalHours.toFixed(1)}h logged</span>}
              {project.deadline && (
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Due {formatDate(project.deadline)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto">
        <TaskBoard initialTasks={serializedTasks as never} />
      </div>
    </div>
  );
}
