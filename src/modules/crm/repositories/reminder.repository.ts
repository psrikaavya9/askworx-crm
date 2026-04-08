import { prisma } from "@/lib/prisma";
import type { CreateReminderInput, UpdateReminderInput } from "../schemas/lead.schema";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LEAD_SUMMARY = {
  id: true,
  firstName: true,
  lastName: true,
  company: true,
  stage: true,
  lastActivityAt: true,
  isCold: true,
} as const;

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function createReminder(
  leadId: string,
  data: CreateReminderInput,
  type: "FOLLOW_UP" | "COLD_ALERT" = "FOLLOW_UP"
) {
  return prisma.followUpReminder.create({
    data: {
      leadId,
      type,
      title: data.title,
      description: data.description,
      dueAt: new Date(data.dueAt),
      assignedTo: data.assignedTo,
      createdBy: data.createdBy,
    },
  });
}

export async function findRemindersByLead(leadId: string) {
  return prisma.followUpReminder.findMany({
    where: { leadId },
    orderBy: { dueAt: "asc" },
  });
}

// ---------------------------------------------------------------------------
// Per-user queries (for bell + reminders page)
// ---------------------------------------------------------------------------

export async function findUserReminders(assignedTo: string) {
  const now = new Date();
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [overdue, dueToday, upcoming] = await Promise.all([
    prisma.followUpReminder.findMany({
      where: { assignedTo, status: { in: ["PENDING", "OVERDUE"] }, dueAt: { lt: now } },
      include: { lead: { select: LEAD_SUMMARY } },
      orderBy: { dueAt: "asc" },
    }),
    prisma.followUpReminder.findMany({
      where: { assignedTo, status: "PENDING", dueAt: { gte: now, lte: todayEnd } },
      include: { lead: { select: LEAD_SUMMARY } },
      orderBy: { dueAt: "asc" },
    }),
    prisma.followUpReminder.findMany({
      where: { assignedTo, status: "PENDING", dueAt: { gt: todayEnd } },
      include: { lead: { select: LEAD_SUMMARY } },
      orderBy: { dueAt: "asc" },
      take: 20,
    }),
  ]);

  return { overdue, dueToday, upcoming };
}

export async function countPendingReminders(assignedTo: string) {
  const now = new Date();
  return prisma.followUpReminder.count({
    where: {
      assignedTo,
      status: { in: ["PENDING", "OVERDUE"] },
      // count overdue + due within next 24 h as "actionable"
      dueAt: { lt: new Date(now.getTime() + 24 * 60 * 60 * 1000) },
    },
  });
}

export async function findOverdueReminders(assignedTo?: string) {
  return prisma.followUpReminder.findMany({
    where: {
      status: "PENDING",
      dueAt: { lt: new Date() },
      ...(assignedTo ? { assignedTo } : {}),
    },
    include: { lead: { select: LEAD_SUMMARY } },
    orderBy: { dueAt: "asc" },
  });
}

export async function findUpcomingReminders(assignedTo: string, withinHours = 24) {
  const cutoff = new Date(Date.now() + withinHours * 60 * 60 * 1000);
  return prisma.followUpReminder.findMany({
    where: {
      assignedTo,
      status: "PENDING",
      dueAt: { lte: cutoff, gte: new Date() },
    },
    include: { lead: { select: LEAD_SUMMARY } },
    orderBy: { dueAt: "asc" },
  });
}

export async function updateReminder(id: string, data: UpdateReminderInput) {
  const updates: Record<string, unknown> = { ...data };
  if (data.dueAt) updates.dueAt = new Date(data.dueAt);
  if (data.status === "COMPLETED") updates.completedAt = new Date();
  return prisma.followUpReminder.update({ where: { id }, data: updates });
}

export async function markOverdueReminders() {
  return prisma.followUpReminder.updateMany({
    where: { status: "PENDING", dueAt: { lt: new Date() } },
    data: { status: "OVERDUE" },
  });
}

export async function deleteReminder(id: string) {
  return prisma.followUpReminder.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Cold-alert helpers (used by cold-lead detection engine)
// ---------------------------------------------------------------------------

/** Returns true if there is already an active FOLLOW_UP reminder for this lead. */
export async function hasActivePendingFollowUp(leadId: string): Promise<boolean> {
  const count = await prisma.followUpReminder.count({
    where: {
      leadId,
      type: "FOLLOW_UP",
      status: { in: ["PENDING", "OVERDUE"] },
    },
  });
  return count > 0;
}

/** Returns true if there is already an active COLD_ALERT for this lead. */
export async function hasActiveColdAlert(leadId: string): Promise<boolean> {
  const count = await prisma.followUpReminder.count({
    where: {
      leadId,
      type: "COLD_ALERT",
      status: { in: ["PENDING", "OVERDUE"] },
    },
  });
  return count > 0;
}

/** Dismisses all active COLD_ALERTs for a lead (call when activity resumes). */
export async function dismissColdAlerts(leadId: string) {
  return prisma.followUpReminder.updateMany({
    where: {
      leadId,
      type: "COLD_ALERT",
      status: { in: ["PENDING", "OVERDUE"] },
    },
    data: { status: "DISMISSED" },
  });
}
