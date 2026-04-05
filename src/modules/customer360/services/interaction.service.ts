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

  return repo.createInteraction(input, staffId);
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
