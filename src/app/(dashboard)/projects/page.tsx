import { Suspense } from "react";
import { findProjects } from "@/modules/projects/repositories/project.repository";
import { projectFiltersSchema } from "@/modules/projects/schemas/project.schema";
import { ProjectsTable } from "@/components/projects/ProjectsTable";
import { StatCard } from "@/components/ui/Card";
import { SectionBlock } from "@/components/ui/SectionBlock";
import { prisma } from "@/lib/prisma";
import {
  FolderOpen,
  CheckCircle,
  AlertTriangle,
  Clock,
  BarChart3,
  Kanban,
} from "lucide-react";
import { serializePrisma } from "@/lib/serialize";

interface PageProps {
  searchParams: Promise<Record<string, string>>;
}

async function ProjectKPIs() {
  const now = new Date();

  const [
    totalProjects,
    completedProjects,
    overdueProjects,
    totalTasks,
    doneTasks,
    overdueTasks,
  ] = await prisma.$transaction([
    prisma.project.count(),
    prisma.project.count({ where: { status: "COMPLETED" } }),
    prisma.project.count({
      where: { deadline: { lt: now }, status: { notIn: ["COMPLETED"] } },
    }),
    prisma.task.count(),
    prisma.task.count({ where: { status: "DONE" } }),
    prisma.task.count({
      where: { dueDate: { lt: now }, status: { not: "DONE" } },
    }),
  ]);

  const onTimeRate =
    totalTasks > 0
      ? Math.round(((totalTasks - overdueTasks) / totalTasks) * 100)
      : 0;

  return (
    <div className="grid grid-cols-5 gap-6">
      <StatCard
        label="Total Projects"
        value={totalProjects}
        icon={<FolderOpen className="h-5 w-5" />}
        color="indigo"
      />
      <StatCard
        label="Total Tasks"
        value={totalTasks}
        icon={<BarChart3 className="h-5 w-5" />}
        color="indigo"
      />
      <StatCard
        label="Completed On Time"
        value={doneTasks}
        sub={`${completedProjects} projects done`}
        icon={<CheckCircle className="h-5 w-5" />}
        color="green"
      />
      <StatCard
        label="Delayed Tasks"
        value={overdueTasks}
        sub={`${overdueProjects} overdue projects`}
        icon={<AlertTriangle className="h-5 w-5" />}
        color={overdueTasks > 0 ? "red" : "green"}
      />
      <StatCard
        label="On-Time Delivery Rate"
        value={`${onTimeRate}%`}
        icon={<Clock className="h-5 w-5" />}
        color={onTimeRate >= 80 ? "green" : onTimeRate >= 50 ? "yellow" : "red"}
      />
    </div>
  );
}

export default async function ProjectsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = projectFiltersSchema.parse(params);
  const raw = await findProjects(filters);
  const projects = serializePrisma(raw);

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-8 py-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
        <p className="mt-1 text-sm text-gray-500">Manage and track all your projects and tasks</p>
      </div>

      {/* KPI Section */}
      <SectionBlock
        title="Project Health"
        subtitle="Delivery rate, deadlines, and task completion metrics"
        icon={<Kanban className="h-4.5 w-4.5 text-purple-600" />}
        href="/analytics"
        hrefLabel="View analytics"
      >
        <Suspense
          fallback={
            <div className="grid grid-cols-5 gap-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />
              ))}
            </div>
          }
        >
          <ProjectKPIs />
        </Suspense>
      </SectionBlock>

      {/* Table Section */}
      <SectionBlock
        title="All Projects"
        subtitle="Browse, filter, and manage all projects"
        icon={<FolderOpen className="h-4.5 w-4.5 text-purple-600" />}
      >
        <ProjectsTable data={projects as never} />
      </SectionBlock>
    </div>
  );
}
