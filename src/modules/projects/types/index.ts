import type {
  Project,
  Task,
  TimeLog,
  Client,
  ProjectStatus,
  TaskStatus,
  TaskPriority,
} from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Re-export Prisma-generated types
// ---------------------------------------------------------------------------

export type {
  Project,
  Task,
  TimeLog,
  Client,
  ProjectStatus,
  TaskStatus,
  TaskPriority,
};

// ---------------------------------------------------------------------------
// Enriched / view types
// ---------------------------------------------------------------------------

export type ProjectWithRelations = Project & {
  client: Client | null;
  tasks: Task[];
  _count: { tasks: number };
};

export type ProjectSummary = Project & {
  client: Pick<Client, "id" | "firstName" | "lastName" | "company"> | null;
  _count: { tasks: number };
};

export type TaskWithRelations = Task & {
  project: Pick<Project, "id" | "name" | "status">;
  timeLogs: TimeLog[];
};

export type TaskSummary = Task & {
  project: Pick<Project, "id" | "name">;
  _count: { timeLogs: number };
};

// ---------------------------------------------------------------------------
// Status/priority labels & ordering
// ---------------------------------------------------------------------------

export const PROJECT_STATUSES: ProjectStatus[] = [
  "PLANNING",
  "ACTIVE",
  "ON_HOLD",
  "COMPLETED",
];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  PLANNING: "Planning",
  ACTIVE: "Active",
  ON_HOLD: "On Hold",
  COMPLETED: "Completed",
};

export const TASK_STATUSES: TaskStatus[] = ["TODO", "IN_PROGRESS", "DONE"];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  DONE: "Done",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

// ---------------------------------------------------------------------------
// KPI types
// ---------------------------------------------------------------------------

export interface ProjectKPI {
  totalProjects: number;
  byStatus: Record<ProjectStatus, number>;
  overdueProjects: number;       // deadline passed & not COMPLETED
  totalTasks: number;
  tasksByStatus: Record<TaskStatus, number>;
  overdueTasks: number;          // dueDate passed & not DONE
  totalHoursLogged: number;
}

// ---------------------------------------------------------------------------
// Pagination helpers (re-used from CRM, defined here independently)
// ---------------------------------------------------------------------------

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
