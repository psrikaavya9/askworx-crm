import { prisma } from "@/lib/prisma";
import * as repo from "../repositories/interaction.repository";
import type {
  CreateInteractionInput,
  InteractionFiltersInput,
  ApproveInteractionInput,
  RejectInteractionInput,
  RequestEditInput,
  ReviewFiltersInput,
  BulkActionInput,
} from "../schemas/interaction.schema";
import type { ReviewerInfo } from "../repositories/interaction.repository";

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createInteraction(
  input: CreateInteractionInput,
  staffId: string,
) {
  const client = await prisma.client.findUnique({
    where:  { id: input.clientId },
    select: { id: true },
  });
  if (!client) throw new Error(`Client not found: ${input.clientId}`);

  const interaction = await repo.createInteraction(input, staffId);

  // Auto-create a FollowUpReminder when needed
  const needsReminder =
    input.nextFollowUp ||
    (input.outcome && /follow[-\s]?up/i.test(input.outcome));

  if (needsReminder) {
    const lead = await prisma.lead.findFirst({
      where:   { clientId: input.clientId, stage: { notIn: ["WON", "LOST"] } },
      orderBy: { updatedAt: "desc" },
      select:  { id: true, firstName: true, lastName: true },
    });

    if (lead) {
      const dueAt = input.nextFollowUp
        ? new Date(input.nextFollowUp)
        : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

      const outcomeSnippet = input.outcome
        ? ` — ${input.outcome.slice(0, 60)}`
        : "";

      const existing = await prisma.followUpReminder.findFirst({
        where: {
          leadId:    lead.id,
          assignedTo: staffId,
          status:    "PENDING",
          dueAt:     { gte: new Date(dueAt.getTime() - 3_600_000) },
        },
      });

      if (!existing) {
        await prisma.followUpReminder.create({
          data: {
            leadId:      lead.id,
            type:        "FOLLOW_UP",
            title:       `Follow up with ${lead.firstName} ${lead.lastName}`,
            description: `Logged after ${input.type} interaction${outcomeSnippet}`,
            dueAt,
            status:      "PENDING",
            assignedTo:  staffId,
            createdBy:   staffId,
          },
        });
      }
    }
  }

  // Notify all OWNER staff that a new interaction needs review
  const owners = await prisma.staff.findMany({
    where:  { role: "OWNER", status: "ACTIVE" },
    select: { id: true },
  });

  if (owners.length > 0) {
    const staffInfo = await prisma.staff.findUnique({
      where:  { id: staffId },
      select: { firstName: true, lastName: true },
    });
    const staffName = staffInfo
      ? `${staffInfo.firstName} ${staffInfo.lastName}`
      : "A staff member";

    await repo.createAppNotificationsMany(
      owners.map((o) => ({
        userId:        o.id,
        interactionId: interaction.id,
        type:          "INTERACTION_REVIEW_NEEDED",
        message:       `${staffName} logged a new ${interaction.type.toLowerCase()} that needs your review.`,
      })),
    );
  }

  return interaction;
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function listInteractions(filters: InteractionFiltersInput) {
  return repo.findInteractions(filters);
}

// ---------------------------------------------------------------------------
// Approve
// ---------------------------------------------------------------------------

export async function approveInteraction(
  id:       string,
  input:    ApproveInteractionInput,
  reviewer: ReviewerInfo,
) {
  const interaction = await repo.findInteractionById(id);
  if (!interaction) throw new Error("Interaction not found");

  if (interaction.approved) {
    throw new Error("Interaction is already approved and cannot be modified");
  }

  const updated = await repo.approveInteraction(id, reviewer, input.ownerNote);

  // Notify the staff member
  await repo.createAppNotification({
    userId:        interaction.staffId,
    interactionId: id,
    type:          "INTERACTION_APPROVED",
    message:       `Your ${interaction.type.toLowerCase()} interaction has been approved.`,
  }).catch(() => null);

  return updated;
}

// ---------------------------------------------------------------------------
// Reject
// ---------------------------------------------------------------------------

export async function rejectInteraction(
  id:       string,
  input:    RejectInteractionInput,
  reviewer: ReviewerInfo,
  reviewReason: string,
) {
  const interaction = await repo.findInteractionById(id);
  if (!interaction) throw new Error("Interaction not found");

  if (interaction.approved) {
    throw new Error("Approved interactions cannot be rejected");
  }

  const updated = await repo.rejectInteraction(id, reviewer, input.ownerNote, reviewReason);

  // Notify the staff member
  await repo.createAppNotification({
    userId:        interaction.staffId,
    interactionId: id,
    type:          "INTERACTION_REJECTED",
    message:       `Your ${interaction.type.toLowerCase()} interaction was rejected: ${reviewReason}${input.ownerNote && input.ownerNote !== reviewReason ? ` — ${input.ownerNote}` : ""}.`,
  }).catch(() => null);

  return updated;
}

// ---------------------------------------------------------------------------
// Request Edit
// ---------------------------------------------------------------------------

export async function requestEditInteraction(
  id:       string,
  input:    RequestEditInput,
  reviewer: ReviewerInfo,
) {
  const interaction = await repo.findInteractionById(id);
  if (!interaction) throw new Error("Interaction not found");

  if (interaction.approved) {
    throw new Error("Approved interactions cannot be sent back for editing");
  }

  const updated = await repo.requestEditInteraction(id, reviewer, input.ownerNote);

  // Notify the staff member
  await repo.createAppNotification({
    userId:        interaction.staffId,
    interactionId: id,
    type:          "INTERACTION_EDIT_REQUESTED",
    message:       `Your ${interaction.type.toLowerCase()} interaction needs edits: ${input.ownerNote.slice(0, 100)}`,
  }).catch(() => null);

  return updated;
}

// ---------------------------------------------------------------------------
// List for Owner Review Dashboard
// ---------------------------------------------------------------------------

export async function listPendingForReview(filters: ReviewFiltersInput) {
  const result = await repo.findPendingForReview(filters);

  // Lazily create escalation notifications for interactions pending > 48h
  const now = Date.now();
  const escalated = result.data.filter((r) => {
    const ageMs = now - new Date(r.createdAt).getTime();
    return ageMs > 48 * 60 * 60 * 1000 && r.reviewStatus === "PENDING";
  });

  if (escalated.length > 0) {
    // Get owners to notify (deduped — only notify once per interaction)
    const owners = await prisma.staff.findMany({
      where:  { role: "OWNER", status: "ACTIVE" },
      select: { id: true },
    });

    for (const item of escalated) {
      for (const owner of owners) {
        // Check if escalation notification already sent
        const existing = await prisma.appNotification.findFirst({
          where: {
            userId:        owner.id,
            interactionId: item.id,
            type:          "INTERACTION_ESCALATED",
          },
          select: { id: true },
        });
        if (!existing) {
          await repo.createAppNotification({
            userId:        owner.id,
            interactionId: item.id,
            type:          "INTERACTION_ESCALATED",
            message:       `Escalated: ${item.type.toLowerCase()} interaction by ${item.staff?.firstName ?? "staff"} has been pending for over 48 hours.`,
          }).catch(() => null);
        }
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Bulk Actions
// ---------------------------------------------------------------------------

export async function bulkReviewAction(
  input:    BulkActionInput,
  reviewer: ReviewerInfo,
) {
  const reviewedAt = reviewer.reviewedAt;

  if (input.action === "approve") {
    const result = await repo.bulkApprove(input.ids, reviewer);

    // Notify affected staff
    const interactions = await prisma.customerInteraction.findMany({
      where:  { id: { in: input.ids } },
      select: { staffId: true, type: true, id: true },
    });
    await repo.createAppNotificationsMany(
      interactions.map((i) => ({
        userId:        i.staffId,
        interactionId: i.id,
        type:          "INTERACTION_APPROVED",
        message:       `Your ${i.type.toLowerCase()} interaction has been approved.`,
      })),
    ).catch(() => null);

    return { action: "approve", count: result.count };
  }

  if (input.action === "reject") {
    const reason   = input.reason    ?? "Rejected";
    const noteText = input.note      ?? reason;
    const result = await repo.bulkReject(input.ids, reviewer, noteText, reason);

    const interactions = await prisma.customerInteraction.findMany({
      where:  { id: { in: input.ids } },
      select: { staffId: true, type: true, id: true },
    });
    await repo.createAppNotificationsMany(
      interactions.map((i) => ({
        userId:        i.staffId,
        interactionId: i.id,
        type:          "INTERACTION_REJECTED",
        message:       `Your ${i.type.toLowerCase()} interaction was rejected: ${reason}.`,
      })),
    ).catch(() => null);

    return { action: "reject", count: result.count };
  }

  if (input.action === "request-edit") {
    const noteText = input.note ?? "Please review and resubmit.";
    const result = await repo.bulkRequestEdit(input.ids, reviewer, noteText);

    const interactions = await prisma.customerInteraction.findMany({
      where:  { id: { in: input.ids } },
      select: { staffId: true, type: true, id: true },
    });
    await repo.createAppNotificationsMany(
      interactions.map((i) => ({
        userId:        i.staffId,
        interactionId: i.id,
        type:          "INTERACTION_EDIT_REQUESTED",
        message:       `Your ${i.type.toLowerCase()} interaction needs edits: ${noteText.slice(0, 100)}`,
      })),
    ).catch(() => null);

    return { action: "request-edit", count: result.count };
  }

  throw new Error("Unknown bulk action");
}
