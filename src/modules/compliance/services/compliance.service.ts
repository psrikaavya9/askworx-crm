import { prisma } from "@/lib/prisma";
import type { ComplianceFrequency, ComplianceStatus } from "@/generated/prisma/client";
import type {
  CreateComplianceInput,
  UpdateComplianceInput,
  ListComplianceInput,
} from "../schemas/compliance.schema";

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/**
 * Advance a date by one compliance cycle.
 * Uses explicit year/month arithmetic to handle month-end edge cases
 * (e.g. Jan 31 + 1 month → Feb 28, not Mar 3).
 */
export function computeNextDueDate(from: Date, frequency: ComplianceFrequency): Date {
  const d = new Date(from);
  if (frequency === "MONTHLY")   d.setMonth(d.getMonth() + 1);
  if (frequency === "QUARTERLY") d.setMonth(d.getMonth() + 3);
  if (frequency === "YEARLY")    d.setFullYear(d.getFullYear() + 1);
  return d;
}

/**
 * Derive status from nextDueDate relative to today.
 *
 *   past due            → OVERDUE
 *   due within 7 days   → UPCOMING
 *   otherwise           → PENDING
 */
export function computeStatus(nextDueDate: Date): Exclude<ComplianceStatus, "COMPLETED"> {
  const now       = new Date();
  const msPerDay  = 1000 * 60 * 60 * 24;
  const daysLeft  = Math.ceil((nextDueDate.getTime() - now.getTime()) / msPerDay);

  if (daysLeft < 0)  return "OVERDUE";
  if (daysLeft <= 7) return "UPCOMING";
  return "PENDING";
}

/**
 * If a compliance item is linked to an HrDocument, check whether that
 * document has expired (status = 'EXPIRED' or expiresAt < now).
 * An expired document always means the obligation is OVERDUE, regardless
 * of what nextDueDate says.
 *
 * Returns OVERDUE when the document has expired, otherwise returns the
 * date-derived status unchanged.
 */
async function applyDocumentExpiry(
  dateStatus: Exclude<ComplianceStatus, "COMPLETED">,
  hrDocumentId: string | null | undefined,
): Promise<Exclude<ComplianceStatus, "COMPLETED">> {
  if (!hrDocumentId) return dateStatus;

  const doc = await prisma.hrDocument.findUnique({
    where:  { id: hrDocumentId },
    select: { status: true, expiresAt: true },
  });

  if (!doc) return dateStatus; // dangling reference — fall back to date-based status

  const isExpired =
    doc.status === "EXPIRED" ||
    (doc.expiresAt !== null && doc.expiresAt < new Date());

  return isExpired ? "OVERDUE" : dateStatus;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listComplianceItems(filters: ListComplianceInput) {
  return prisma.complianceItem.findMany({
    where: {
      ...(filters.status    && { status:    filters.status }),
      ...(filters.type      && { type:      filters.type }),
      ...(filters.frequency && { frequency: filters.frequency }),
    },
    orderBy: { nextDueDate: "asc" },
  });
}

export async function createComplianceItem(data: CreateComplianceInput) {
  // Validate hrDocumentId existence if provided
  if (data.hrDocumentId) {
    const doc = await prisma.hrDocument.findUnique({ where: { id: data.hrDocumentId }, select: { id: true } });
    if (!doc) throw new Error(`HrDocument not found: ${data.hrDocumentId}`);
  }

  const dateStatus = computeStatus(data.nextDueDate);
  const status     = await applyDocumentExpiry(dateStatus, data.hrDocumentId);

  return prisma.complianceItem.create({
    data: {
      title:        data.title,
      type:         data.type,
      frequency:    data.frequency,
      nextDueDate:  data.nextDueDate,
      lastDoneDate: data.lastDoneDate,
      notes:        data.notes,
      hrDocumentId: data.hrDocumentId,
      status,
    },
  });
}

export async function updateComplianceItem(id: string, data: UpdateComplianceInput) {
  const existing = await prisma.complianceItem.findUnique({ where: { id } });
  if (!existing) throw new Error(`Compliance item not found: ${id}`);

  // Validate hrDocumentId if it is being changed to a new value
  const newDocId = data.hrDocumentId !== undefined ? data.hrDocumentId : existing.hrDocumentId;
  if (data.hrDocumentId && data.hrDocumentId !== existing.hrDocumentId) {
    const doc = await prisma.hrDocument.findUnique({ where: { id: data.hrDocumentId }, select: { id: true } });
    if (!doc) throw new Error(`HrDocument not found: ${data.hrDocumentId}`);
  }

  // markComplete: stamp today as lastDoneDate and advance to next cycle
  if (data.markComplete) {
    const today       = new Date();
    const frequency   = data.frequency ?? existing.frequency;
    const nextDueDate = computeNextDueDate(today, frequency);
    const dateStatus  = computeStatus(nextDueDate);
    const status      = await applyDocumentExpiry(dateStatus, newDocId);

    return prisma.complianceItem.update({
      where: { id },
      data:  {
        lastDoneDate: today,
        nextDueDate,
        frequency,
        status,
        ...(data.hrDocumentId !== undefined && { hrDocumentId: data.hrDocumentId }),
        ...(data.title && { title: data.title }),
        ...(data.type  && { type:  data.type  }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
    });
  }

  // General field update — recalculate status from resulting nextDueDate and document
  const nextDueDate = data.nextDueDate ?? existing.nextDueDate;
  const dateStatus  = computeStatus(nextDueDate);
  const status      = await applyDocumentExpiry(dateStatus, newDocId);

  return prisma.complianceItem.update({
    where: { id },
    data:  {
      ...(data.title       !== undefined && { title:       data.title       }),
      ...(data.type                      && { type:        data.type        }),
      ...(data.frequency                 && { frequency:   data.frequency   }),
      ...(data.nextDueDate               && { nextDueDate: data.nextDueDate }),
      ...(data.notes       !== undefined && { notes:       data.notes       }),
      ...(data.hrDocumentId !== undefined && { hrDocumentId: data.hrDocumentId }),
      status,
    },
  });
}
