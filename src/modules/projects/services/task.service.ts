import * as taskRepo from "../repositories/task.repository";
import * as timeLogRepo from "../repositories/timelog.repository";
import * as projectRepo from "../repositories/project.repository";
import type {
  CreateTaskInput,
  UpdateTaskInput,
  TaskFiltersInput,
  CreateTimeLogInput,
  UpdateTimeLogInput,
} from "../schemas/task.schema";

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export async function getTasksByProject(
  projectId: string,
  filters: TaskFiltersInput
) {
  // Ensure project exists
  const project = await projectRepo.findProjectById(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  return taskRepo.findTasks(filters, projectId);
}

export async function getTasks(filters: TaskFiltersInput) {
  return taskRepo.findTasks(filters);
}

export async function getTaskById(id: string) {
  const task = await taskRepo.findTaskById(id);
  if (!task) throw new Error(`Task not found: ${id}`);
  return task;
}

export async function createTask(projectId: string, data: CreateTaskInput) {
  const project = await projectRepo.findProjectById(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);

  if (data.dueDate && project.deadline) {
    if (new Date(data.dueDate) > project.deadline) {
      throw new Error("Task due date cannot be after project deadline.");
    }
  }

  return taskRepo.createTask(projectId, data);
}

export async function updateTask(id: string, data: UpdateTaskInput) {
  const task = await getTaskById(id);

  if (data.dueDate) {
    const project = await projectRepo.findProjectById(task.projectId);
    if (project?.deadline && new Date(data.dueDate) > project.deadline) {
      throw new Error("Task due date cannot be after project deadline.");
    }
  }

  return taskRepo.updateTask(id, data);
}

export async function deleteTask(id: string) {
  await getTaskById(id);
  return taskRepo.deleteTask(id);
}

// ---------------------------------------------------------------------------
// Time Logs
// ---------------------------------------------------------------------------

export async function getTimeLogsByTask(taskId: string) {
  await getTaskById(taskId);
  return timeLogRepo.findTimeLogsByTask(taskId);
}

export async function createTimeLog(taskId: string, data: CreateTimeLogInput) {
  await getTaskById(taskId);
  const log = await timeLogRepo.createTimeLog(taskId, data);
  // Recompute hoursLogged on the task
  await taskRepo.recalcTaskHours(taskId);
  return log;
}

export async function updateTimeLog(
  timeLogId: string,
  data: UpdateTimeLogInput
) {
  const log = await timeLogRepo.findTimeLogById(timeLogId);
  if (!log) throw new Error(`TimeLog not found: ${timeLogId}`);

  const updated = await timeLogRepo.updateTimeLog(timeLogId, data);
  // Recompute hoursLogged on the parent task
  await taskRepo.recalcTaskHours(log.taskId);
  return updated;
}

export async function deleteTimeLog(timeLogId: string) {
  const log = await timeLogRepo.findTimeLogById(timeLogId);
  if (!log) throw new Error(`TimeLog not found: ${timeLogId}`);

  await timeLogRepo.deleteTimeLog(timeLogId);
  // Recompute hoursLogged on the parent task
  await taskRepo.recalcTaskHours(log.taskId);
}
