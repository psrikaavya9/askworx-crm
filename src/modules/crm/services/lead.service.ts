import * as leadRepo from "../repositories/lead.repository";
import * as reminderRepo from "../repositories/reminder.repository";
import * as clientRepo from "../repositories/client.repository";
import { scheduleScore } from "./scoring.service";
import { checkDuplicates, DuplicateLeadError } from "./duplicate.service";
import type {
  CreateLeadInput,
  UpdateLeadInput,
  UpdateStageInput,
  AddNoteInput,
  CreateReminderInput,
  UpdateReminderInput,
  LeadFiltersInput,
  MergeLeadsInput,
  BulkAssignInput,
  AutoDistributeInput,
  BulkDeleteInput,
  BulkMoveStageInput,
} from "../schemas/lead.schema";
import type { PipelineStage } from "../types";

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

export async function getLeads(filters: LeadFiltersInput) {
  return leadRepo.findLeads(filters);
}

export async function getLeadById(id: string) {
  const lead = await leadRepo.findLeadById(id);
  if (!lead) throw new Error(`Lead not found: ${id}`);
  return lead;
}

/**
 * Creates a new lead with duplicate detection.
 *
 * @param data    — validated lead input
 * @param options.force         — skip duplicate guard and create anyway
 * @param options.duplicateIds  — IDs of the known duplicates (logged for audit)
 *
 * If duplicates are found and `force` is falsy, throws a `DuplicateLeadError`
 * that the API route serialises into a 409 response with the matches array.
 */
export async function createLead(
  data: CreateLeadInput,
  options: { force?: boolean; duplicateIds?: string[] } = {},
) {
  const { force = false, duplicateIds = [] } = options;

  if (!force) {
    const { hasDuplicates, matches } = await checkDuplicates({
      email:     data.email,
      phone:     data.phone,
      firstName: data.firstName,
      lastName:  data.lastName,
      company:   data.company,
    });
    if (hasDuplicates) throw new DuplicateLeadError(matches);
  }

  const lead = await leadRepo.createLead(data);

  // When the user overrides the duplicate warning, log it as an audit activity
  if (force && duplicateIds.length > 0) {
    const { prisma } = await import("@/lib/prisma");
    await prisma.leadActivity.create({
      data: {
        leadId:      lead.id,
        type:        "DUPLICATE_FLAGGED",
        description: `Created despite ${duplicateIds.length} potential duplicate(s)`,
        metadata:    { duplicateIds },
        performedBy: data.assignedTo ?? "system",
      },
    });
  }

  scheduleScore(lead.id);
  return lead;
}

export async function updateLead(id: string, data: UpdateLeadInput) {
  await getLeadById(id); // ensure exists
  if (data.email) {
    // Check email duplicates against OTHER leads
    const { hasDuplicates, matches } = await checkDuplicates({
      email:     data.email,
      phone:     data.phone,
      firstName: data.firstName ?? "",
      lastName:  data.lastName  ?? "",
      company:   data.company,
      excludeId: id,
    });
    // Only block on high-confidence email match (strict uniqueness)
    const emailConflict = matches.find(
      (m) => m.reasons.includes("Same email address") && m.confidence === "HIGH",
    );
    if (emailConflict) {
      throw new Error(`Email "${data.email}" is already taken by another lead.`);
    }
  }
  return leadRepo.updateLead(id, data);
}

export async function updateLeadStage(
  id: string,
  input: UpdateStageInput,
  performedBy: string
) {
  await getLeadById(id);

  const updated = await leadRepo.updateLeadStage(
    id,
    input.stage as PipelineStage,
    performedBy,
    input.lostReason
  );

  // When a lead is WON, promote to Client if not already linked
  if (input.stage === "WON" && !updated.clientId) {
    const existing = await clientRepo.findClientByEmail(updated.email);
    if (!existing) {
      const client = await clientRepo.createClient({
        firstName: updated.firstName,
        lastName: updated.lastName,
        email: updated.email,
        phone: updated.phone ?? undefined,
        company: updated.company ?? "Unknown",
        jobTitle: updated.jobTitle ?? undefined,
        assignedTo: updated.assignedTo ?? undefined,
        tags: [],
      });
      await leadRepo.updateLead(id, { assignedTo: updated.assignedTo ?? undefined });
      // Link lead → client
      await leadRepo.updateLead(id, {}); // trigger updatedAt
      // Direct Prisma call to set clientId
      const { prisma } = await import("@/lib/prisma");
      await prisma.lead.update({ where: { id }, data: { clientId: client.id } });
    }
  }

  // Recalculate score — stage change updates recency and may affect engagement
  scheduleScore(id);

  return updated;
}

export async function deleteLead(id: string) {
  await getLeadById(id);
  return leadRepo.deleteLead(id);
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export async function addNote(leadId: string, input: AddNoteInput) {
  await getLeadById(leadId);
  const [note] = await leadRepo.addLeadNote(leadId, input.content, input.createdBy);
  scheduleScore(leadId);
  return note;
}

export async function deleteNote(leadId: string, noteId: string) {
  await getLeadById(leadId);
  return leadRepo.deleteLeadNote(noteId);
}

// ---------------------------------------------------------------------------
// Reminders
// ---------------------------------------------------------------------------

export async function createReminder(leadId: string, input: CreateReminderInput) {
  await getLeadById(leadId);
  return reminderRepo.createReminder(leadId, input);
}

export async function getReminders(leadId: string) {
  await getLeadById(leadId);
  return reminderRepo.findRemindersByLead(leadId);
}

export async function updateReminder(reminderId: string, input: UpdateReminderInput) {
  return reminderRepo.updateReminder(reminderId, input);
}

export async function dismissReminder(reminderId: string) {
  return reminderRepo.updateReminder(reminderId, { status: "DISMISSED" });
}

export async function completeReminder(reminderId: string) {
  return reminderRepo.updateReminder(reminderId, { status: "COMPLETED" });
}

export async function getOverdueReminders(assignedTo?: string) {
  return reminderRepo.findOverdueReminders(assignedTo);
}

export async function getUpcomingReminders(assignedTo: string, withinHours?: number) {
  return reminderRepo.findUpcomingReminders(assignedTo, withinHours);
}

// ---------------------------------------------------------------------------
// Bulk operations
// ---------------------------------------------------------------------------

/**
 * Validates the target staff exists and is ACTIVE, then bulk-assigns leads.
 * Returns { updated, skipped }.
 */
export async function bulkAssign(input: BulkAssignInput) {
  const { prisma } = await import("@/lib/prisma");
  const staff = await prisma.staff.findUnique({
    where:  { id: input.assigned_to },
    select: { id: true, status: true },
  });
  if (!staff)                  throw new Error(`Staff member not found: ${input.assigned_to}`);
  if (staff.status !== "ACTIVE") throw new Error(`Staff member is not active: ${input.assigned_to}`);

  return leadRepo.bulkAssignLeads(
    input.lead_ids,
    input.assigned_to,
    input.overwrite ?? false,
    input.performedBy ?? "system",
  );
}

/** Distributes leads in round-robin across ACTIVE reps. */
export async function autoDistribute(input: AutoDistributeInput) {
  return leadRepo.autoDistributeLeads(
    input.lead_ids,
    input.staff_ids,
    input.performedBy ?? "system",
  );
}

/** Deletes multiple leads. */
export async function bulkDelete(input: BulkDeleteInput) {
  return leadRepo.bulkDeleteLeads(input.lead_ids);
}

/** Moves multiple leads to a new pipeline stage. */
export async function bulkMoveStage(input: BulkMoveStageInput) {
  return leadRepo.bulkMoveStage(
    input.lead_ids,
    input.stage as import("../types").PipelineStage,
    input.performedBy ?? "system",
  );
}

// ---------------------------------------------------------------------------
// Merge
// ---------------------------------------------------------------------------

export async function mergeLeads(input: MergeLeadsInput) {
  if (input.targetId === input.sourceId) {
    throw new Error("Target and source must be different leads.");
  }
  await Promise.all([getLeadById(input.targetId), getLeadById(input.sourceId)]);
  const merged = await leadRepo.mergeLeads(
    input.targetId,
    input.sourceId,
    input.performedBy,
  );
  // Recalculate score for the target — it may have gained new activities
  scheduleScore(input.targetId);
  return merged;
}
