import { notFound } from "next/navigation";
import Link from "next/link";
import { findProjectById } from "@/modules/projects/repositories/project.repository";
import { serializePrisma } from "@/lib/serialize";
import { TasksSection } from "@/components/projects/TasksSection";
import { ProjectStatusBadge } from "@/components/projects/shared/ProjectStatusBadge";
import { StatCard } from "@/components/ui/Card";
import { SectionBlock } from "@/components/ui/SectionBlock";
import { formatDate } from "@/lib/utils";
import {
  ArrowLeft,
  Kanban,
  Building2,
  CalendarDays,
  AlertTriangle,
  CheckCircle2,
  Clock,
  BarChart3,
} from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { id } = await params;
  const project = await findProjectById(id);
  if (!project) notFound();

  const now = new Date();
  const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

  const deadlineAlerts = project.tasks
    .filter((t) => {
      if (t.status === "DONE" || !t.dueDate) return false;
      const due = new Date(t.dueDate as unknown as string);
      return due <= twoDaysFromNow;
    })
    .sort((a, b) => {
      const aDate = a.dueDate ? new Date(a.dueDate as unknown as string).getTime() : 0;
      const bDate = b.dueDate ? new Date(b.dueDate as unknown as string).getTime() : 0;
      return aDate - bDate;
    });

  const totalTasks = project.tasks.length;
  const doneTasks = project.tasks.filter((t) => t.status === "DONE").length;
  const overdueTasks = project.tasks.filter(
    (t) => t.status !== "DONE" && t.dueDate && new Date(t.dueDate as unknown as string) < now
  ).length;
  const onTimeRate =
    totalTasks > 0
      ? Math.round(((totalTasks - overdueTasks) / totalTasks) * 100)
      : 0;

  const isProjectOverdue =
    project.deadline &&
    new Date(project.deadline) < now &&
    project.status !== "COMPLETED";

  const serializedTasks = serializePrisma(project.tasks);

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-8 py-6">
      {/* Back link */}
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        All Projects
      </Link>

      {/* Project header card */}
      <div className="rounded-xl border border-gray-200 bg-white p-7 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
              <ProjectStatusBadge status={project.status} />
            </div>
            {project.description && (
              <p className="mt-1.5 text-sm text-gray-500">{project.description}</p>
            )}
          </div>
          <Link
            href={`/projects/${id}/kanban`}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 hover:shadow-md transition-all"
          >
            <Kanban className="h-4 w-4 text-purple-600" />
            Kanban Board
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4 border-t border-gray-100 pt-5">
          {project.client && (
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Client</p>
              <p className="flex items-center gap-1.5 mt-1 text-sm font-medium text-gray-900">
                <Building2 className="h-3.5 w-3.5 text-gray-400" />
                {project.client.firstName} {project.client.lastName}
                <span className="font-normal text-gray-400">· {project.client.company}</span>
              </p>
            </div>
          )}
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Start Date</p>
            <p className="flex items-center gap-1.5 mt-1 text-sm font-medium text-gray-900">
              <CalendarDays className="h-3.5 w-3.5 text-gray-400" />
              {formatDate(project.startDate)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Deadline</p>
            <p className={`flex items-center gap-1.5 mt-1 text-sm font-medium ${isProjectOverdue ? "text-red-600" : "text-gray-900"}`}>
              <CalendarDays className="h-3.5 w-3.5" />
              {formatDate(project.deadline)}
              {isProjectOverdue && (
                <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">
                  Overdue
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Deadline Alerts */}
      {deadlineAlerts.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-800">
            <AlertTriangle className="h-4 w-4" />
            Deadline Alerts — {deadlineAlerts.length} task{deadlineAlerts.length > 1 ? "s" : ""} due soon
          </h2>
          <div className="space-y-2">
            {deadlineAlerts.map((task) => {
              const dueDate = new Date(task.dueDate as unknown as string);
              const isOverdue = dueDate < now;
              const daysLeft = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              return (
                <div
                  key={task.id}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2.5 ${
                    isOverdue ? "border-red-200 bg-red-50" : "border-amber-200 bg-white"
                  }`}
                >
                  <span className={`text-sm font-medium ${isOverdue ? "text-red-700" : "text-gray-800"}`}>
                    {task.title}
                  </span>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={isOverdue ? "font-semibold text-red-600" : "text-amber-700"}>
                      {isOverdue ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? "Due today" : `${daysLeft}d left`}
                    </span>
                    <span className="text-gray-400">{formatDate(task.dueDate as unknown as string)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* KPI Section */}
      <SectionBlock
        title="Task Metrics"
        subtitle="Completion rate, delays, and on-time delivery performance"
        icon={<BarChart3 className="h-4.5 w-4.5 text-purple-600" />}
        href={`/projects/${id}/kanban`}
        hrefLabel="Kanban board"
      >
        <div className="grid grid-cols-4 gap-6">
          <StatCard label="Total Tasks" value={totalTasks} icon={<BarChart3 className="h-5 w-5" />} color="indigo" />
          <StatCard
            label="Completed"
            value={doneTasks}
            sub={totalTasks > 0 ? `${Math.round((doneTasks / totalTasks) * 100)}% done` : undefined}
            icon={<CheckCircle2 className="h-5 w-5" />}
            color="green"
          />
          <StatCard
            label="Delayed Tasks"
            value={overdueTasks}
            icon={<AlertTriangle className="h-5 w-5" />}
            color={overdueTasks > 0 ? "red" : "green"}
          />
          <StatCard
            label="On-Time Rate"
            value={`${onTimeRate}%`}
            icon={<Clock className="h-5 w-5" />}
            color={onTimeRate >= 80 ? "green" : onTimeRate >= 50 ? "yellow" : "red"}
          />
        </div>
      </SectionBlock>

      {/* Tasks section */}
      <SectionBlock
        title="Tasks"
        subtitle="All tasks for this project — add, update, and log time"
        icon={<CheckCircle2 className="h-4.5 w-4.5 text-purple-600" />}
      >
        <TasksSection projectId={id} initialTasks={serializedTasks as never} />
      </SectionBlock>
    </div>
  );
}
