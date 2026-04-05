import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { sendEmail } from "@/lib/sendgrid";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Days without activity before triggering a follow-up reminder. */
export const FOLLOW_UP_THRESHOLD_DAYS = 3;

/** Days a lead can sit in the same stage before triggering a stuck warning. */
export const STAGE_STUCK_THRESHOLD_DAYS = 7;

/** Cooldown: don't re-fire the same rule for the same lead within this window. */
const FOLLOW_UP_COOLDOWN_DAYS = 3;
const STAGE_STUCK_COOLDOWN_DAYS = 7;

const ACTIVE_STAGES = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL"] as const;

const STAGE_LABELS: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  PROPOSAL: "Proposal",
};

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface AutomationJobResult {
  followUpRemindersCreated: number;
  stageStuckWarningsCreated: number;
  emailsSent: number;
  rulesSkipped: number;
  errors: number;
}

// ---------------------------------------------------------------------------
// Idempotency guard
// ---------------------------------------------------------------------------

/**
 * Returns true if a system-created reminder with the given title prefix already
 * exists for this lead and was created within the cooldown window.
 * Prevents duplicate reminders from firing on every cron tick.
 */
async function hasRecentSystemReminder(
  leadId: string,
  titlePrefix: string,
  withinDays: number
): Promise<boolean> {
  const cutoff = new Date(Date.now() - withinDays * 86_400_000);
  const count = await prisma.followUpReminder.count({
    where: {
      leadId,
      createdBy: "system",
      title: { startsWith: titlePrefix },
      status: { in: ["PENDING", "OVERDUE"] },
      createdAt: { gte: cutoff },
    },
  });
  return count > 0;
}

// ---------------------------------------------------------------------------
// Email helper — never throws; returns false if email is not configured
// ---------------------------------------------------------------------------

async function tryEmailAssignee(
  assignedTo: string,
  subject: string,
  body: string
): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY) return false;

  try {
    const staff = await prisma.staff.findUnique({
      where: { id: assignedTo },
      select: { email: true },
    });
    if (!staff?.email) return false;

    await sendEmail({ to: staff.email, subject, text: body });
    return true;
  } catch (err) {
    console.warn("[automation] Email failed (non-fatal):", err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Audit logging helper
// ---------------------------------------------------------------------------

async function logEvent(
  action: string,
  leadId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: null, // system-initiated
      action,
      entityType: "automation_rule",
      entityId: leadId,
      metadata: metadata as Prisma.InputJsonValue,
    },
  });
}

// ---------------------------------------------------------------------------
// Rule 1 — No interaction in 3 days → create follow-up reminder
// ---------------------------------------------------------------------------

async function runFollowUpRule(result: AutomationJobResult): Promise<void> {
  const threshold = new Date(Date.now() - FOLLOW_UP_THRESHOLD_DAYS * 86_400_000);

  const leads = await prisma.lead.findMany({
    where: {
      stage: { in: [...ACTIVE_STAGES] },
      isCold: false, // cold leads are already handled by the cold-lead cron
      OR: [
        { lastActivityAt: { lt: threshold } },
        { lastActivityAt: null, createdAt: { lt: threshold } },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      stage: true,
      assignedTo: true,
      lastActivityAt: true,
    },
  });

  for (const lead of leads) {
    const alreadyPending = await hasRecentSystemReminder(
      lead.id,
      "[Automation] Follow-up",
      FOLLOW_UP_COOLDOWN_DAYS
    );
    if (alreadyPending) {
      result.rulesSkipped++;
      continue;
    }

    const leadName = `${lead.firstName} ${lead.lastName}`;
    const daysSince = lead.lastActivityAt
      ? Math.floor((Date.now() - new Date(lead.lastActivityAt).getTime()) / 86_400_000)
      : null;
    const description = daysSince !== null
      ? `No interaction logged for ${daysSince} day${daysSince === 1 ? "" : "s"}.`
      : "No interaction logged since lead was created.";

    const dueAt = new Date();
    dueAt.setHours(dueAt.getHours() + 1); // actionable in 1 hour

    await prisma.followUpReminder.create({
      data: {
        leadId: lead.id,
        type: "FOLLOW_UP",
        title: `[Automation] Follow-up needed — ${leadName}`,
        description,
        dueAt,
        status: "PENDING",
        assignedTo: lead.assignedTo ?? "admin",
        createdBy: "system",
      },
    });

    await logEvent("FOLLOW_UP_REMINDER_CREATED", lead.id, {
      rule: "no_interaction_3_days",
      leadName,
      stage: lead.stage,
      daysSinceLastActivity: daysSince,
    });

    result.followUpRemindersCreated++;

    // Optional email notification
    if (lead.assignedTo) {
      const sent = await tryEmailAssignee(
        lead.assignedTo,
        `[ASKworX] Follow-up needed: ${leadName}`,
        `Hi,\n\nThe lead "${leadName}" has had no interaction for ${daysSince ?? "several"} day(s).\n\nPlease follow up at your earliest convenience.\n\n— ASKworX CRM Automation`
      );
      if (sent) result.emailsSent++;
    }
  }
}

// ---------------------------------------------------------------------------
// Rule 2 — Stage unchanged > 7 days → create stuck-stage warning
// ---------------------------------------------------------------------------

type StuckLead = {
  id: string;
  firstName: string;
  lastName: string;
  stage: string;
  assignedTo: string | null;
  stageEnteredAt: Date;
};

async function runStageStuckRule(result: AutomationJobResult): Promise<void> {
  const threshold = new Date(Date.now() - STAGE_STUCK_THRESHOLD_DAYS * 86_400_000);
  const stuckLeads: StuckLead[] = [];
  const seen = new Set<string>();

  // ── Path A: leads using the dynamic LeadPipeline ──
  const pipelineLeads = await prisma.leadPipeline.findMany({
    where: {
      stageUpdatedAt: { lt: threshold },
      lead: { stage: { in: [...ACTIVE_STAGES] } },
    },
    select: {
      stageUpdatedAt: true,
      lead: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          stage: true,
          assignedTo: true,
        },
      },
    },
  });

  for (const pl of pipelineLeads) {
    seen.add(pl.lead.id);
    stuckLeads.push({
      id: pl.lead.id,
      firstName: pl.lead.firstName,
      lastName: pl.lead.lastName,
      stage: pl.lead.stage,
      assignedTo: pl.lead.assignedTo,
      stageEnteredAt: pl.stageUpdatedAt,
    });
  }

  // ── Path B: leads without a pipeline — use stage-specific timestamps ──
  const standaloneLeads = await prisma.lead.findMany({
    where: {
      stage: { in: [...ACTIVE_STAGES] },
      leadPipeline: null,
      OR: [
        { stage: "NEW",       createdAt:   { lt: threshold } },
        { stage: "CONTACTED", contactedAt: { lt: threshold } },
        { stage: "QUALIFIED", qualifiedAt: { lt: threshold } },
        { stage: "PROPOSAL",  proposalAt:  { lt: threshold } },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      stage: true,
      assignedTo: true,
      createdAt: true,
      contactedAt: true,
      qualifiedAt: true,
      proposalAt: true,
    },
  });

  for (const l of standaloneLeads) {
    if (seen.has(l.id)) continue;
    const stageEnteredAt =
      l.stage === "CONTACTED" ? (l.contactedAt ?? l.createdAt) :
      l.stage === "QUALIFIED"  ? (l.qualifiedAt  ?? l.createdAt) :
      l.stage === "PROPOSAL"   ? (l.proposalAt   ?? l.createdAt) :
      l.createdAt;

    stuckLeads.push({
      id: l.id,
      firstName: l.firstName,
      lastName: l.lastName,
      stage: l.stage,
      assignedTo: l.assignedTo,
      stageEnteredAt,
    });
  }

  // ── Process each stuck lead ──
  for (const lead of stuckLeads) {
    const alreadyPending = await hasRecentSystemReminder(
      lead.id,
      "[Automation] Stage stuck",
      STAGE_STUCK_COOLDOWN_DAYS
    );
    if (alreadyPending) {
      result.rulesSkipped++;
      continue;
    }

    const daysStuck = Math.floor(
      (Date.now() - new Date(lead.stageEnteredAt).getTime()) / 86_400_000
    );
    const stageLabel = STAGE_LABELS[lead.stage] ?? lead.stage;
    const leadName = `${lead.firstName} ${lead.lastName}`;

    const dueAt = new Date();
    dueAt.setHours(dueAt.getHours() + 1);

    // Reminder in the reminders panel
    await prisma.followUpReminder.create({
      data: {
        leadId: lead.id,
        type: "FOLLOW_UP",
        title: `[Automation] Stage stuck — ${leadName}`,
        description: `Lead has been in "${stageLabel}" for ${daysStuck} day${daysStuck === 1 ? "" : "s"}. Consider advancing or closing.`,
        dueAt,
        status: "PENDING",
        assignedTo: lead.assignedTo ?? "admin",
        createdBy: "system",
      },
    });

    // Activity entry so it appears on the lead's timeline
    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        type: "NOTE_ADDED",
        description: `[Automation] Stage alert: lead has been in "${stageLabel}" for ${daysStuck} days without progressing.`,
        performedBy: "system",
        metadata: { rule: "stage_stuck_7_days", daysStuck, stage: lead.stage },
      },
    });

    await logEvent("STAGE_STUCK_WARNING", lead.id, {
      rule: "stage_stuck_7_days",
      leadName,
      stage: lead.stage,
      daysStuck,
    });

    result.stageStuckWarningsCreated++;

    // Optional email notification
    if (lead.assignedTo) {
      const sent = await tryEmailAssignee(
        lead.assignedTo,
        `[ASKworX] Stage alert: ${leadName} stuck in ${stageLabel}`,
        `Hi,\n\nThe lead "${leadName}" has been in the "${stageLabel}" stage for ${daysStuck} day${daysStuck === 1 ? "" : "s"} without progressing.\n\nPlease review and either advance or close this deal.\n\n— ASKworX CRM Automation`
      );
      if (sent) result.emailsSent++;
    }
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Runs all automation rules.
 * Each rule is isolated — a failure in one does not abort the others.
 * Safe to call multiple times (fully idempotent via cooldown guards).
 */
export async function runAutomationJob(): Promise<AutomationJobResult> {
  const result: AutomationJobResult = {
    followUpRemindersCreated: 0,
    stageStuckWarningsCreated: 0,
    emailsSent: 0,
    rulesSkipped: 0,
    errors: 0,
  };

  try {
    await runFollowUpRule(result);
  } catch (err) {
    console.error("[automation] Rule 1 (follow-up) failed:", err);
    result.errors++;
  }

  try {
    await runStageStuckRule(result);
  } catch (err) {
    console.error("[automation] Rule 2 (stage stuck) failed:", err);
    result.errors++;
  }

  console.log("[automation] Job complete:", result);
  return result;
}
