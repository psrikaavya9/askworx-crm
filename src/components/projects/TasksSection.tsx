"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Kanban, User } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { TaskStatusBadge } from "@/components/projects/shared/TaskStatusBadge";
import { TaskPriorityBadge } from "@/components/projects/shared/TaskPriorityBadge";
import { AddTaskModal, type TaskRow } from "@/components/projects/AddTaskModal";
import { formatDate } from "@/lib/utils";

interface TasksSectionProps {
  projectId: string;
  initialTasks: TaskRow[];
}

export function TasksSection({ projectId, initialTasks }: TasksSectionProps) {
  const [tasks, setTasks] = useState<TaskRow[]>(initialTasks);
  const [showModal, setShowModal] = useState(false);

  function handleCreated(task: TaskRow) {
    setTasks((prev) => [task, ...prev]);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">
          Tasks ({tasks.length})
        </h2>
        <div className="flex items-center gap-2">
          <Link href={`/projects/${projectId}/kanban`}>
            <Button
              variant="secondary"
              size="sm"
              icon={<Kanban className="h-3.5 w-3.5" />}
            >
              Kanban Board
            </Button>
          </Link>
          <Button
            size="sm"
            icon={<Plus className="h-3.5 w-3.5" />}
            onClick={() => setShowModal(true)}
          >
            Add Task
          </Button>
        </div>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          title="No tasks yet"
          description="Add your first task to get started."
          action={
            <Button
              size="sm"
              icon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => setShowModal(true)}
            >
              Add Task
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-md">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-5 py-4 text-left font-medium text-gray-600">
                  Task
                </th>
                <th className="px-5 py-4 text-left font-medium text-gray-600">
                  Status
                </th>
                <th className="px-5 py-4 text-left font-medium text-gray-600">
                  Priority
                </th>
                <th className="px-5 py-4 text-left font-medium text-gray-600">
                  Assignee
                </th>
                <th className="px-5 py-4 text-left font-medium text-gray-600">
                  Due Date
                </th>
                <th className="px-5 py-4 text-left font-medium text-gray-600">
                  Hours
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {tasks.map((task) => {
                const isOverdue =
                  task.dueDate &&
                  new Date(task.dueDate) < new Date() &&
                  task.status !== "DONE";
                return (
                  <tr key={task.id} className="hover:bg-gray-50">
                    <td className="px-5 py-4 font-medium text-gray-900">
                      {task.title}
                      {task.description && (
                        <p className="mt-0.5 text-xs text-gray-400 line-clamp-1">
                          {task.description}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <TaskStatusBadge status={task.status} />
                    </td>
                    <td className="px-5 py-4">
                      <TaskPriorityBadge priority={task.priority} />
                    </td>
                    <td className="px-5 py-4">
                      {task.assignedStaff.length > 0 ? (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <User className="h-3 w-3" />
                          {task.assignedStaff.slice(0, 2).join(", ")}
                          {task.assignedStaff.length > 2 &&
                            ` +${task.assignedStaff.length - 2}`}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td
                      className={`px-5 py-4 text-sm ${
                        isOverdue ? "font-medium text-red-600" : "text-gray-500"
                      }`}
                    >
                      {formatDate(task.dueDate)}
                    </td>
                    <td className="px-5 py-4 text-gray-700">
                      {Number(task.hoursLogged) > 0
                        ? `${Number(task.hoursLogged).toFixed(1)}h`
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AddTaskModal
        open={showModal}
        projectId={projectId}
        onClose={() => setShowModal(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}
