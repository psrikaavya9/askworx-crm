"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import { TaskCard } from "./TaskCard";
import type { TaskFull } from "@/components/projects/TaskDetailModal";

const COLUMN_CONFIG = {
  TODO: { label: "To Do", color: "bg-gray-100 text-gray-700" },
  IN_PROGRESS: { label: "In Progress", color: "bg-blue-100 text-blue-700" },
  DONE: { label: "Done", color: "bg-green-100 text-green-700" },
} as const;

interface TaskColumnProps {
  status: "TODO" | "IN_PROGRESS" | "DONE";
  tasks: TaskFull[];
  onTaskClick: (task: TaskFull) => void;
}

export function TaskColumn({ status, tasks, onTaskClick }: TaskColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const config = COLUMN_CONFIG[status];

  return (
    <div className="flex w-72 shrink-0 flex-col">
      {/* Column header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-semibold",
              config.color
            )}
          >
            {config.label}
          </span>
          <span className="text-xs text-gray-400">{tasks.length}</span>
        </div>
      </div>

      {/* Droppable area */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 rounded-xl p-2 transition-colors min-h-[200px]",
          isOver ? "bg-indigo-50 ring-2 ring-indigo-200" : "bg-gray-50"
        )}
      >
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onTaskClick={onTaskClick}
              />
            ))}
          </div>
        </SortableContext>

        {tasks.length === 0 && (
          <div className="flex h-20 items-center justify-center">
            <p className="text-xs text-gray-400">Drop tasks here</p>
          </div>
        )}
      </div>
    </div>
  );
}
