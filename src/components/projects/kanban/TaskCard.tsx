"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn, formatDate } from "@/lib/utils";
import { TaskPriorityBadge } from "@/components/projects/shared/TaskPriorityBadge";
import { Clock, User, CalendarDays } from "lucide-react";
import type { TaskFull } from "@/components/projects/TaskDetailModal";

interface TaskCardProps {
  task: TaskFull;
  overlay?: boolean;
  onTaskClick?: (task: TaskFull) => void;
}

export function TaskCard({ task, overlay, onTaskClick }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isOverdue =
    task.dueDate &&
    new Date(task.dueDate) < new Date() &&
    task.status !== "DONE";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "rounded-lg border border-gray-200 bg-white p-3 shadow-sm",
        "cursor-grab active:cursor-grabbing select-none",
        isDragging && "opacity-40",
        overlay && "rotate-2 shadow-xl"
      )}
    >
      {/* Title — clickable to open detail modal */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onTaskClick?.(task);
        }}
        className="w-full text-left"
      >
        <p className="text-sm font-medium text-gray-900 hover:text-indigo-600 transition-colors leading-snug">
          {task.title}
        </p>
      </button>

      <div className="mt-2 flex items-center justify-between">
        <TaskPriorityBadge priority={task.priority} />
        {Number(task.hoursLogged) > 0 && (
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <Clock className="h-3 w-3" />
            {Number(task.hoursLogged).toFixed(1)}h
          </span>
        )}
      </div>

      {task.assignedStaff.length > 0 && (
        <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
          <User className="h-3 w-3 shrink-0" />
          <span className="truncate">{task.assignedStaff.slice(0, 2).join(", ")}</span>
        </div>
      )}

      {task.dueDate && (
        <div
          className={cn(
            "mt-2 flex items-center gap-1 text-xs",
            isOverdue ? "text-red-500 font-medium" : "text-gray-400"
          )}
        >
          <CalendarDays className="h-3 w-3 shrink-0" />
          {formatDate(task.dueDate)}
          {isOverdue && <span className="ml-0.5">· Overdue</span>}
        </div>
      )}
    </div>
  );
}

export function TaskCardOverlay({ task }: { task: TaskFull }) {
  return <TaskCard task={task} overlay />;
}
