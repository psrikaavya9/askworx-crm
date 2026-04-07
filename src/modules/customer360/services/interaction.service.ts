import { prisma } from "@/lib/prisma";
import * as repo from "../repositories/interaction.repository";
import type {
  CreateInteractionInput,
  InteractionFiltersInput,
  ApproveInteractionInput,
  RejectInteractionInput,
  RequestEditInput,
  ReviewFiltersInput,
} from "../schemas/interaction.schema";

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createInteraction(
  input: CreateInteractionInput,
  staffId: string,
) {
  // Validate the referenced client exists before writing
  const client = await prisma.client.findUnique({
    where:  { id: input.clientId },
    select: { id: true },
  });
  if (!client) throw new Error(`Client not found: ${input.clientId}`);

  const interaction = await repo.createInteraction(input, staffId);

  // Auto-create a FollowUpReminder when:
  //   a) nextFollowUp date is explicitly provided, or
  //   b) outcome text contains "follow-up" (case-insensitive)
  const needsReminder =
    input.nextFollowUp ||
    (input.outcome && /follow[-\s]?up/i.test(input.outcome));

  if (needsReminder) {
    // Find the most recent active lead linked to this client
    const lead = await prisma.lead.findFirst({
      where:   { clientId: input.clientId, stage: { notIn: ["WON", "LOST"] } },
      orderBy: { updatedAt: "desc" },
      select:  { id: true, firstName: true, lastName: true },
    });

    if (lead) {
      const dueAt = input.nextFollowUp
        ? new Date(input.nextFollowUp)
        : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // default: 3 days

      const outcomeSnippet = input.outcome
        ? ` — ${input.outcome.slice(0, 60)}`
        : "";

      // Avoid duplicate: skip if an identical pending reminder already exists
      const existing = await prisma.followUpReminder.findFirst({
        where: {
          leadId:    lead.id,
          assignedTo: staffId,
          status:    "PENDING",
          dueAt:     { gte: new Date(dueAt.getTime() - 3_600_000) }, // within ±1h
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
//
// Guard: an already-approved interaction is immutable.
// A rejected interaction CAN be approved (owner overrides their rejection).
// ---------------------------------------------------------------------------

export async function approveInteraction(
  id: string,
  input: ApproveInteractionInput,
) {
  const interaction = await repo.findInteractionById(id);
  if (!interaction) throw new Error("Interaction not found");

  if (interaction.approved) {
    throw new Error("Interaction is already approved and cannot be modified");
  }

  return repo.approveInteraction(id, input.ownerNote);
}

// ---------------------------------------------------------------------------
// Reject
//
// Guard: approved interactions are locked — they cannot be rejected.
// A pending or already-rejected interaction can be rejected (or re-rejected
// to update the reason).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Request Edit
//
// Guard: approved interactions are locked.
// Sends the interaction back to the staff member with instructions to fix.
// State: approved=false, rejected=false, ownerNote=<instructions>
// ---------------------------------------------------------------------------

export async function requestEditInteraction(
  id: string,
  input: RequestEditInput,
) {
  const interaction = await repo.findInteractionById(id);
  if (!interaction) throw new Error("Interaction not found");

  if (interaction.approved) {
    throw new Error("Approved interactions cannot be sent back for editing");
  }

  return repo.requestEditInteraction(id, input.ownerNote);
}

// ---------------------------------------------------------------------------
// List for Owner Review Dashboard
// ---------------------------------------------------------------------------

export async function listPendingForReview(filters: ReviewFiltersInput) {
  return repo.findPendingForReview(filters);
}

// ---------------------------------------------------------------------------
// Reject
//
// Guard: approved interactions are locked — they cannot be rejected.
// A pending or already-rejected interaction can be rejected (or re-rejected
// to update the reason).
// ---------------------------------------------------------------------------

export async function rejectInteraction(
  id: string,
  input: RejectInteractionInput,
) {
  const interaction = await repo.findInteractionById(id);
  if (!interaction) throw new Error("Interaction not found");

  if (interaction.approved) {
    throw new Error("Approved interactions cannot be rejected");
  }

  return repo.rejectInteraction(id, input.ownerNote);
}
