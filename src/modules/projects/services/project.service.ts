import * as projectRepo from "../repositories/project.repository";
import type {
  CreateProjectInput,
  UpdateProjectInput,
  ProjectFiltersInput,
} from "../schemas/project.schema";
import type { ProjectKPI, ProjectStatus, TaskStatus } from "../types";
import * as taskRepo from "../repositories/task.repository";

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function getProjects(filters: ProjectFiltersInput) {
  return projectRepo.findProjects(filters);
}

export async function getProjectById(id: string) {
  const project = await projectRepo.findProjectById(id);
  if (!project) throw new Error(`Project not found: ${id}`);
  return project;
}

export async function createProject(data: CreateProjectInput) {
  if (data.deadline && data.startDate) {
    if (new Date(data.deadline) < new Date(data.startDate)) {
      throw new Error("Deadline cannot be before start date.");
    }
  }
  return projectRepo.createProject(data);
}

export async function updateProject(id: string, data: UpdateProjectInput) {
  const project = await getProjectById(id);

  const effectiveStart = data.startDate ?? project.startDate?.toISOString();
  const effectiveDeadline = data.deadline ?? project.deadline?.toISOString();

  if (effectiveStart && effectiveDeadline) {
    if (new Date(effectiveDeadline) < new Date(effectiveStart)) {
      throw new Error("Deadline cannot be before start date.");
    }
  }

  return projectRepo.updateProject(id, data);
}

export async function deleteProject(id: string) {
  await getProjectById(id);
  return projectRepo.deleteProject(id);
}

// ---------------------------------------------------------------------------
// KPIs
// ---------------------------------------------------------------------------

export async function getProjectKPIs(): Promise<ProjectKPI> {
  const [statusGroups, overdueProjects, taskStatusGroups, overdueTasks, totalHours] =
    await Promise.all([
      projectRepo.countProjectsByStatus(),
      projectRepo.countOverdueProjects(),
      taskRepo.countTasksByStatus(),
      taskRepo.countOverdueTasks(),
      taskRepo.sumHoursLogged(),
    ]);

  const byStatus = {
    PLANNING: 0,
    ACTIVE: 0,
    ON_HOLD: 0,
    COMPLETED: 0,
  } as Record<ProjectStatus, number>;

  let totalProjects = 0;
  for (const row of statusGroups) {
    byStatus[row.status] = row._count._all;
    totalProjects += row._count._all;
  }

  const tasksByStatus = {
    TODO: 0,
    IN_PROGRESS: 0,
    DONE: 0,
  } as Record<TaskStatus, number>;

  let totalTasks = 0;
  for (const row of taskStatusGroups) {
    tasksByStatus[row.status] = row._count._all;
    totalTasks += row._count._all;
  }

  return {
    totalProjects,
    byStatus,
    overdueProjects,
    totalTasks,
    tasksByStatus,
    overdueTasks,
    totalHoursLogged: totalHours,
  };
}
