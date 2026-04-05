import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type {
  CreateInteractionInput,
  InteractionFiltersInput,
  ReviewFiltersInput,
} from "../schemas/interaction.schema";

// ---------------------------------------------------------------------------
// Shared include shapes
// ---------------------------------------------------------------------------

const CLIENT_SELECT = {
  firstName: true,
  lastName:  true,
  company:   true,
} as const;

const STAFF_SELECT = {
  firstName:  true,
  lastName:   true,
  department: true,
} as const;

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function findInteractions(filters: InteractionFiltersInput) {
  const { clientId, type, page, pageSize } = filters;
  const skip = (page - 1) * pageSize;

  const where: Prisma.CustomerInteractionWhereInput = { clientId };
  if (type) where.type = type;

  const [data, total] = await Promise.all([
    prisma.customerInteraction.findMany({
      where,
      orderBy: { date: "desc" },
      skip,
      take:    pageSize,
      include: {
        client: { select: CLIENT_SELECT },
        staff:  { select: STAFF_SELECT },
      },
    }),
    prisma.customerInteraction.count({ where }),
  ]);

  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function findInteractionById(id: string) {
  return prisma.customerInteraction.findUnique({
    where: { id },
    include: {
      client: { select: CLIENT_SELECT },
      staff:  { select: STAFF_SELECT },
    },
  });
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export async function createInteraction(
  input: CreateInteractionInput,
  staffId: string,
) {
  return prisma.customerInteraction.create({
    data: {
      clientId:           input.clientId,
      staffId,
      type:               input.type,
      date:               new Date(input.date),
      duration:           input.duration           ?? null,
      outcome:            input.outcome            ?? null,
      notes:              input.notes              ?? null,
      gpsLat:             input.gpsLat             ?? null,
      gpsLng:             input.gpsLng             ?? null,
      // Prisma Json? fields require DbNull (not JS null) when explicitly clearing
      photos:             input.photos ?? Prisma.DbNull,
      nextFollowUp:       input.nextFollowUp ? new Date(input.nextFollowUp) : null,
      // EMAIL / WHATSAPP messaging fields
      direction:          input.direction          ?? null,
      messageContent:     input.messageContent     ?? null,
      messageSubject:     input.messageSubject     ?? null,
      counterpartyEmail:  input.counterpartyEmail  ?? null,
      counterpartyPhone:  input.counterpartyPhone  ?? null,
    },
    include: {
      client: { select: CLIENT_SELECT },
      staff:  { select: STAFF_SELECT },
    },
  });
}

// ---------------------------------------------------------------------------
// Webhook-created interactions (EMAIL / WHATSAPP — auto-approved)
// ---------------------------------------------------------------------------

export interface WebhookInteractionData {
  clientId:           string;
  type:               "EMAIL" | "WHATSAPP";
  date:               Date;
  messageContent?:    string | null;
  messageSubject?:    string | null;
  direction:          "INBOUND" | "OUTBOUND";
  externalId:         string;
  counterpartyEmail?: string | null;
  counterpartyPhone?: string | null;
  notes?:             string | null;
}

/**
 * Creates a webhook-sourced interaction.
 * - auto-approved (no manual review required)
 * - carries messaging-specific fields not present in manual interactions
 */
export async function createWebhookInteraction(
  input:   WebhookInteractionData,
  staffId: string,
) {
  return prisma.customerInteraction.create({
    data: {
      clientId:           input.clientId,
      staffId,
      type:               input.type,
      date:               input.date,
      messageContent:     input.messageContent  ?? null,
      messageSubject:     input.messageSubject  ?? null,
      direction:          input.direction,
      externalId:         input.externalId,
      counterpartyEmail:  input.counterpartyEmail ?? null,
      counterpartyPhone:  input.counterpartyPhone ?? null,
      notes:              input.notes ?? null,
      // Auto-approved — these are factual system records, not field reports
      approved: true,
      rejected: false,
    },
    include: {
      client: { select: CLIENT_SELECT },
      staff:  { select: STAFF_SELECT },
    },
  });
}

// ---------------------------------------------------------------------------
// Review list — all non-approved interactions (owner dashboard)
// ---------------------------------------------------------------------------

export async function findPendingForReview(filters: ReviewFiltersInput) {
  const { status, type, page, pageSize } = filters;
  const skip = (page - 1) * pageSize;

  // Base: never approved
  const where: Prisma.CustomerInteractionWhereInput = { approved: false };

  // Status refinement
  if (status === "PENDING") {
    where.rejected  = false;
    where.ownerNote = null;
  } else if (status === "EDIT_REQUESTED") {
    where.rejected   = false;
    where.ownerNote  = { not: null };
  }
  // "ALL" = anything not yet approved (pending + edit-requested + rejected)

  if (type) where.type = type;

  const [data, total] = await Promise.all([
    prisma.customerInteraction.findMany({
      where,
      orderBy: { date: "desc" },
      skip,
      take: pageSize,
      include: {
        client: { select: { id: true, firstName: true, lastName: true, company: true } },
        staff:  { select: { firstName: true, lastName: true, department: true } },
      },
    }),
    prisma.customerInteraction.count({ where }),
  ]);

  return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

// ---------------------------------------------------------------------------
// Write — owner actions
// ---------------------------------------------------------------------------

// Approved interactions are locked — no further updates are permitted.
// The service layer enforces this guard before calling either function below.

export async function approveInteraction(id: string, ownerNote?: string) {
  return prisma.customerInteraction.update({
    where: { id },
    data: {
      approved:  true,
      rejected:  false,
      ownerNote: ownerNote ?? null,
    },
    include: {
      client: { select: CLIENT_SELECT },
      staff:  { select: STAFF_SELECT },
    },
  });
}

export async function requestEditInteraction(id: string, ownerNote: string) {
  return prisma.customerInteraction.update({
    where: { id },
    data: {
      approved:  false,
      rejected:  false,
      ownerNote,
    },
    include: {
      client: { select: CLIENT_SELECT },
      staff:  { select: STAFF_SELECT },
    },
  });
}

export async function rejectInteraction(id: string, ownerNote: string) {
  return prisma.customerInteraction.update({
    where: { id },
    data: {
      rejected:  true,
      approved:  false,
      ownerNote,
    },
    include: {
      client: { select: CLIENT_SELECT },
      staff:  { select: STAFF_SELECT },
    },
  });
}
