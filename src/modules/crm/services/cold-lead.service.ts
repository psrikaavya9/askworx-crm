import { prisma } from "@/lib/prisma";
import { hasActiveColdAlert, dismissColdAlerts } from "../repositories/reminder.repository";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Number of days without activity before a lead is considered cold. */
export const COLD_THRESHOLD_DAYS = 7;

/** Reminder is set N days after the lead goes cold (same-day by default). */
const REMINDER_OFFSET_DAYS = 0;

// ---------------------------------------------------------------------------
// Core job
// ---------------------------------------------------------------------------

export interface ColdLeadJobResult {
  markedCold:     number;
  alertsCreated:  number;
  recovered:      number;
  alertsDismissed: number;
  overdueMarked:  number;
}

/**
 * Runs the full cold-lead detection + overdue-reminder sweep.
 * Designed to be called by the daily cron at 09:00.
 * Fully idempotent — safe to re-run multiple times a day.
 */
export async function runColdLeadJob(): Promise<ColdLeadJobResult> {
  const result: ColdLeadJobResult = {
    markedCold: 0, alertsCreated: 0,
    recovered: 0,  alertsDismissed: 0, overdueMarked: 0,
  };

  const threshold = new Date(Date.now() - COLD_THRESHOLD_DAYS * 86_400_000);
  const recoveryThreshold = new Date(Date.now() - COLD_THRESHOLD_DAYS * 86_400_000);

  // ── 1. Mark overdue reminders ────────────────────────────────────────────
  const { count: overdueCount } = await prisma.followUpReminder.updateMany({
    where: { status: "PENDING", dueAt: { lt: new Date() } },
    data: { status: "OVERDUE" },
  });
  result.overdueMarked = overdueCount;

  // ── 2. Recover leads that have had recent activity ───────────────────────
  // Find leads flagged as cold but now have lastActivityAt within threshold.
  const recovered = await prisma.lead.findMany({
    where: {
      isCold: true,
      lastActivityAt: { gte: recoveryThreshold },
      stage: { notIn: ["WON", "LOST"] },
    },
    select: { id: true },
  });

  for (const { id } of recovered) {
    await Promise.all([
      prisma.lead.update({ where: { id }, data: { isCold: false } }),
      dismissColdAlerts(id),
    ]);
    result.recovered++;
    result.alertsDismissed++;
  }

  // ── 3. Detect newly cold leads ───────────────────────────────────────────
  // A lead is cold if:
  //   - Not already marked cold
  //   - lastActivityAt < threshold (or null + createdAt < threshold)
  //   - Not WON or LOST
  const coldLeads = await prisma.lead.findMany({
    where: {
      isCold: false,
      stage: { notIn: ["WON", "LOST"] },
      OR: [
        { lastActivityAt: { lt: threshold } },
        { lastActivityAt: null, createdAt: { lt: threshold } },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      assignedTo: true,
    },
  });

  for (const lead of coldLeads) {
    // Update lead status
    await prisma.lead.update({ where: { id: lead.id }, data: { isCold: true } });
    result.markedCold++;

    // Create COLD_ALERT only if none already active (idempotency guard)
    const alreadyAlerted = await hasActiveColdAlert(lead.id);
    if (!alreadyAlerted) {
      const dueAt = new Date();
      dueAt.setDate(dueAt.getDate() + REMINDER_OFFSET_DAYS);
      dueAt.setHours(9, 0, 0, 0); // 9 AM same/next day

      await prisma.followUpReminder.create({
        data: {
          leadId:     lead.id,
          type:       "COLD_ALERT",
          title:      `Cold lead — ${lead.firstName} ${lead.lastName}`,
          description: `No activity for more than ${COLD_THRESHOLD_DAYS} days. Re-engage now.`,
          dueAt,
          status:     "PENDING",
          assignedTo: lead.assignedTo ?? "admin",
          createdBy:  "system",
        },
      });
      result.alertsCreated++;
    }
  }

  console.log("[cold-lead] Job complete:", result);
  return result;
}
