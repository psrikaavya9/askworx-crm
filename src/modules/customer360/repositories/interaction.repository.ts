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
  id:        true,
  firstName: true,
  lastName:  true,
  company:   true,
} as const;

const STAFF_SELECT = {
  id:         true,
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
      photos:             input.photos ?? Prisma.DbNull,
      nextFollowUp:       input.nextFollowUp ? new Date(input.nextFollowUp) : null,
      direction:          input.direction          ?? null,
      messageContent:     input.messageContent     ?? null,
      messageSubject:     input.messageSubject     ?? null,
      counterpartyEmail:  input.counterpartyEmail  ?? null,
      counterpartyPhone:  input.counterpartyPhone  ?? null,
      // new review fields — defaults
      reviewStatus: "PENDING",
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
      approved:     true,
      rejected:     false,
      reviewStatus: "APPROVED",
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
  const { status, type, staffId, clientId, dateFrom, dateTo, page, pageSize } = filters;
  const skip = (page - 1) * pageSize;

  const where: Prisma.CustomerInteractionWhereInput = { approved: false };

  if (status === "PENDING") {
    where.rejected  = false;
    where.ownerNote = null;
  } else if (status === "EDIT_REQUESTED") {
    where.rejected   = false;
    where.ownerNote  = { not: null };
  }

  if (type)     where.type     = type;
  if (staffId)  where.staffId  = staffId;
  if (clientId) where.clientId = clientId;

  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo)   where.createdAt.lte = new Date(dateTo);
  }

  const [data, total] = await Promise.all([
    prisma.customerInteraction.findMany({
      where,
      orderBy: { createdAt: "asc" },   // oldest first so SLA urgency is visible
      skip,
      take: pageSize,
      include: {
        client: { select: CLIENT_SELECT },
        staff:  { select: STAFF_SELECT },
      },
    }),
    prisma.customerInteraction.count({ where }),
  ]);

  return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

// ---------------------------------------------------------------------------
// Write — owner review actions
// ---------------------------------------------------------------------------

export interface ReviewerInfo {
  reviewedBy:  string;   // staffId
  reviewedAt:  Date;
}

export async function approveInteraction(
  id:       string,
  reviewer: ReviewerInfo,
  ownerNote?: string,
) {
  return prisma.customerInteraction.update({
    where: { id },
    data: {
      approved:     true,
      rejected:     false,
      ownerNote:    ownerNote ?? null,
      reviewStatus: "APPROVED",
      reviewedBy:   reviewer.reviewedBy,
      reviewedAt:   reviewer.reviewedAt,
    },
    include: {
      client: { select: CLIENT_SELECT },
      staff:  { select: STAFF_SELECT },
    },
  });
}

export async function rejectInteraction(
  id:           string,
  reviewer:     ReviewerInfo,
  ownerNote:    string,
  reviewReason: string,
) {
  return prisma.customerInteraction.update({
    where: { id },
    data: {
      rejected:     true,
      approved:     false,
      ownerNote,
      reviewStatus: "REJECTED",
      reviewedBy:   reviewer.reviewedBy,
      reviewedAt:   reviewer.reviewedAt,
      reviewReason,
    },
    include: {
      client: { select: CLIENT_SELECT },
      staff:  { select: STAFF_SELECT },
    },
  });
}

export async function requestEditInteraction(
  id:       string,
  reviewer: ReviewerInfo,
  ownerNote: string,
) {
  return prisma.customerInteraction.update({
    where: { id },
    data: {
      approved:     false,
      rejected:     false,
      ownerNote,
      reviewStatus: "EDIT_REQUESTED",
      reviewedBy:   reviewer.reviewedBy,
      reviewedAt:   reviewer.reviewedAt,
    },
    include: {
      client: { select: CLIENT_SELECT },
      staff:  { select: STAFF_SELECT },
    },
  });
}

// ---------------------------------------------------------------------------
// Bulk review actions (max 50 at a time)
// ---------------------------------------------------------------------------

export async function bulkApprove(ids: string[], reviewer: ReviewerInfo) {
  return prisma.customerInteraction.updateMany({
    where: { id: { in: ids }, approved: false },
    data: {
      approved:     true,
      rejected:     false,
      reviewStatus: "APPROVED",
      reviewedBy:   reviewer.reviewedBy,
      reviewedAt:   reviewer.reviewedAt,
    },
  });
}

export async function bulkReject(
  ids:          string[],
  reviewer:     ReviewerInfo,
  ownerNote:    string,
  reviewReason: string,
) {
  return prisma.customerInteraction.updateMany({
    where: { id: { in: ids }, approved: false },
    data: {
      rejected:     true,
      approved:     false,
      ownerNote,
      reviewStatus: "REJECTED",
      reviewedBy:   reviewer.reviewedBy,
      reviewedAt:   reviewer.reviewedAt,
      reviewReason,
    },
  });
}

export async function bulkRequestEdit(
  ids:      string[],
  reviewer: ReviewerInfo,
  ownerNote: string,
) {
  return prisma.customerInteraction.updateMany({
    where: { id: { in: ids }, approved: false },
    data: {
      approved:     false,
      rejected:     false,
      ownerNote,
      reviewStatus: "EDIT_REQUESTED",
      reviewedBy:   reviewer.reviewedBy,
      reviewedAt:   reviewer.reviewedAt,
    },
  });
}

// ---------------------------------------------------------------------------
// App notifications
// ---------------------------------------------------------------------------

export async function createAppNotification(data: {
  userId:        string;
  interactionId?: string;
  type:          string;
  message:       string;
}) {
  return prisma.appNotification.create({ data });
}

export async function createAppNotificationsMany(entries: {
  userId:        string;
  interactionId?: string;
  type:          string;
  message:       string;
}[]) {
  if (entries.length === 0) return;
  return prisma.appNotification.createMany({ data: entries });
}

export async function findAppNotifications(userId: string, opts?: { unreadOnly?: boolean; limit?: number }) {
  return prisma.appNotification.findMany({
    where: {
      userId,
      ...(opts?.unreadOnly ? { isRead: false } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: opts?.limit ?? 30,
  });
}

export async function countUnreadAppNotifications(userId: string) {
  return prisma.appNotification.count({ where: { userId, isRead: false } });
}

export async function markAppNotificationRead(id: string, userId: string) {
  return prisma.appNotification.updateMany({
    where: { id, userId, isRead: false },
    data:  { isRead: true },
  });
}

export async function markAllAppNotificationsRead(userId: string) {
  return prisma.appNotification.updateMany({
    where: { userId, isRead: false },
    data:  { isRead: true },
  });
}
