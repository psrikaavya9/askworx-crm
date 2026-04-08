import { prisma } from "@/lib/prisma";
import type { Prisma, PipelineStage } from "@/generated/prisma/client";
import type { CreateLeadInput, UpdateLeadInput, LeadFiltersInput } from "../schemas/lead.schema";
import type { PaginatedResult } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildWhereClause(filters: Partial<LeadFiltersInput>): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = {};

  if (filters.stage) where.stage = filters.stage;
  if (filters.source) where.source = filters.source;
  if (filters.priority) where.priority = filters.priority;
  if (filters.assignedTo) where.assignedTo = filters.assignedTo;
  if (filters.scoreCategory) {
    where.score = { is: { category: filters.scoreCategory as import("@/generated/prisma/client").ScoreCategory } };
  }

  if (filters.search) {
    const search = filters.search.trim();
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { company: { contains: search, mode: "insensitive" } },
    ];
  }

  return where;
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function findLeads(
  filters: LeadFiltersInput
): Promise<PaginatedResult<Awaited<ReturnType<typeof findLeadById>> extends null ? never : NonNullable<Awaited<ReturnType<typeof findLeadById>>>>> {
  const { page, pageSize, sortBy, sortOrder } = filters;
  const where = buildWhereClause(filters);
  const skip = (page - 1) * pageSize;

  const [data, total] = await prisma.$transaction([
    prisma.lead.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: pageSize,
      include: {
        reminders: { where: { status: "PENDING" }, orderBy: { dueAt: "asc" } },
        _count: { select: { notes: true, activities: true } },
        score: true,
      },
    }),
    prisma.lead.count({ where }),
  ]);

  return {
    data: data as never,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function findLeadById(id: string) {
  return prisma.lead.findUnique({
    where: { id },
    include: {
      notes: { orderBy: { createdAt: "desc" } },
      activities: { orderBy: { createdAt: "desc" } },
      reminders: { orderBy: { dueAt: "asc" } },
      client: true,
      score: true,
    },
  });
}

export async function findLeadByEmail(email: string) {
  return prisma.lead.findUnique({ where: { email } });
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export async function createLead(data: CreateLeadInput) {
  return prisma.lead.create({
    data: {
      ...data,
      dealValue: data.dealValue ? data.dealValue : undefined,
      lastActivityAt: new Date(),
      activities: {
        create: {
          type: "LEAD_CREATED",
          description: "Lead created",
          performedBy: data.assignedTo ?? "system",
        },
      },
    },
    include: { activities: true },
  });
}

export async function updateLead(id: string, data: UpdateLeadInput) {
  return prisma.lead.update({
    where: { id },
    data: {
      ...data,
      dealValue: data.dealValue ? data.dealValue : undefined,
    },
  });
}

export async function updateLeadStage(
  id: string,
  stage: PipelineStage,
  performedBy: string,
  lostReason?: string
) {
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id } });

  const stageTimestamps: Partial<Prisma.LeadUpdateInput> = {};
  if (stage === "CONTACTED" && !lead.contactedAt) stageTimestamps.contactedAt = new Date();
  if (stage === "QUALIFIED" && !lead.qualifiedAt) stageTimestamps.qualifiedAt = new Date();
  if (stage === "PROPOSAL" && !lead.proposalAt) stageTimestamps.proposalAt = new Date();
  if (stage === "WON" && !lead.convertedAt) stageTimestamps.convertedAt = new Date();
  if (stage === "LOST" && !lead.lostAt) {
    stageTimestamps.lostAt = new Date();
    stageTimestamps.lostReason = lostReason;
  }

  return prisma.lead.update({
    where: { id },
    data: {
      stage,
      ...stageTimestamps,
      lastActivityAt: new Date(),
      activities: {
        create: {
          type: "STAGE_CHANGED",
          description: `Stage changed from ${lead.stage} to ${stage}`,
          metadata: { fromStage: lead.stage, toStage: stage, lostReason },
          performedBy,
        },
      },
    },
    include: { activities: { take: 1, orderBy: { createdAt: "desc" } } },
  });
}

export async function deleteLead(id: string) {
  return prisma.lead.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Bulk operations
// ---------------------------------------------------------------------------

/**
 * Assigns multiple leads to one rep inside a single transaction.
 * When overwrite=false, already-assigned leads are skipped.
 * Returns { updated, skipped }.
 */
export async function bulkAssignLeads(
  leadIds:    string[],
  assignedTo: string,
  overwrite:  boolean,
  performedBy: string,
): Promise<{ updated: number; skipped: number }> {
  const now = new Date();

  const leads = await prisma.lead.findMany({
    where:  { id: { in: leadIds } },
    select: { id: true, assignedTo: true },
  });

  const toUpdate = overwrite ? leads : leads.filter((l) => !l.assignedTo);
  const skipped  = leads.length - toUpdate.length;

  if (toUpdate.length === 0) return { updated: 0, skipped };

  const ids = toUpdate.map((l) => l.id);

  await prisma.$transaction(async (tx) => {
    await tx.lead.updateMany({
      where: { id: { in: ids } },
      data:  { assignedTo, assignedAt: now, lastActivityAt: now },
    });
    await tx.leadActivity.createMany({
      data: ids.map((leadId) => ({
        leadId,
        type:        "LEAD_ASSIGNED" as const,
        description: `Lead assigned`,
        metadata:    { assignedTo, overwrite } as object,
        performedBy,
      })),
    });
  });

  return { updated: toUpdate.length, skipped };
}

/**
 * Round-robin distributes leads across staff members inside a single transaction.
 * - lead_ids: target leads (all unassigned leads when omitted)
 * - staffIds: target reps  (all ACTIVE staff when omitted)
 */
export async function autoDistributeLeads(
  leadIds:    string[] | undefined,
  staffIds:   string[] | undefined,
  performedBy: string,
): Promise<{ updated: number; distribution: Record<string, number> }> {
  const now = new Date();

  const where = leadIds?.length ? { id: { in: leadIds } } : { assignedTo: null as string | null };

  const [leads, staff] = await Promise.all([
    prisma.lead.findMany({ where, select: { id: true }, orderBy: { createdAt: "asc" } }),
    staffIds?.length
      ? prisma.staff.findMany({ where: { id: { in: staffIds }, status: "ACTIVE" }, select: { id: true } })
      : prisma.staff.findMany({ where: { status: "ACTIVE" }, select: { id: true } }),
  ]);

  if (leads.length === 0) return { updated: 0, distribution: {} };
  if (staff.length === 0) throw new Error("No active staff members found.");

  // Round-robin mapping
  const assignments = leads.map((lead, i) => ({
    leadId:  lead.id,
    staffId: staff[i % staff.length].id,
  }));

  // Pre-compute distribution counts
  const distribution: Record<string, number> = {};
  for (const { staffId } of assignments) {
    distribution[staffId] = (distribution[staffId] ?? 0) + 1;
  }

  // Group by staff for efficient updateMany calls
  const byStaff = new Map<string, string[]>();
  for (const { leadId, staffId } of assignments) {
    if (!byStaff.has(staffId)) byStaff.set(staffId, []);
    byStaff.get(staffId)!.push(leadId);
  }

  await prisma.$transaction(async (tx) => {
    for (const [staffId, ids] of byStaff) {
      await tx.lead.updateMany({
        where: { id: { in: ids } },
        data:  { assignedTo: staffId, assignedAt: now, lastActivityAt: now },
      });
    }
    await tx.leadActivity.createMany({
      data: assignments.map(({ leadId, staffId }) => ({
        leadId,
        type:        "LEAD_ASSIGNED" as const,
        description: "Lead auto-distributed",
        metadata:    { assignedTo: staffId, autoDistributed: true } as object,
        performedBy,
      })),
    });
  });

  return { updated: leads.length, distribution };
}

/**
 * Deletes multiple leads. Database cascades remove all child records.
 */
export async function bulkDeleteLeads(leadIds: string[]): Promise<number> {
  const result = await prisma.lead.deleteMany({ where: { id: { in: leadIds } } });
  return result.count;
}

/**
 * Moves multiple leads to the given pipeline stage.
 */
export async function bulkMoveStage(
  leadIds:     string[],
  stage:       import("@/generated/prisma/client").PipelineStage,
  performedBy: string,
): Promise<number> {
  const now = new Date();

  const timestamps: Record<string, Date> = {};
  if (stage === "CONTACTED") timestamps.contactedAt = now;
  if (stage === "QUALIFIED")  timestamps.qualifiedAt = now;
  if (stage === "PROPOSAL")   timestamps.proposalAt  = now;
  if (stage === "WON")        timestamps.convertedAt = now;
  if (stage === "LOST")       timestamps.lostAt      = now;

  await prisma.$transaction(async (tx) => {
    await tx.lead.updateMany({
      where: { id: { in: leadIds } },
      data:  { stage, ...timestamps, lastActivityAt: now },
    });
    await tx.leadActivity.createMany({
      data: leadIds.map((leadId) => ({
        leadId,
        type:        "STAGE_CHANGED" as const,
        description: `Bulk stage change to ${stage}`,
        metadata:    { toStage: stage, bulk: true } as object,
        performedBy,
      })),
    });
  });

  return leadIds.length;
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export async function addLeadNote(
  leadId: string,
  content: string,
  createdBy: string
) {
  return prisma.$transaction([
    prisma.leadNote.create({ data: { leadId, content, createdBy } }),
    prisma.leadActivity.create({
      data: {
        leadId,
        type: "NOTE_ADDED",
        description: "Note added",
        performedBy: createdBy,
      },
    }),
    // Stamp last-activity so cold-lead cron picks up the fresh interaction
    prisma.lead.update({ where: { id: leadId }, data: { lastActivityAt: new Date() } }),
  ]);
}

export async function deleteLeadNote(noteId: string) {
  return prisma.leadNote.delete({ where: { id: noteId } });
}

// ---------------------------------------------------------------------------
// Merge
// ---------------------------------------------------------------------------

/**
 * Merges `sourceId` into `targetId` inside a single transaction:
 *   1. Reassign all notes, activities, and reminders to the target.
 *   2. Fill any null fields on the target from the source.
 *   3. Merge tags (union, deduplicated).
 *   4. Write a LEAD_MERGED activity on the target for audit.
 *   5. Delete the source lead (cascade cleans up LeadScore, LeadPipeline, etc.).
 *
 * Returns the updated target lead with full includes.
 */
export async function mergeLeads(
  targetId: string,
  sourceId: string,
  performedBy: string,
) {
  // Fetch both leads upfront — outside the transaction so we can use the data
  // to build the update payload without a nested read inside the tx.
  const [target, source] = await Promise.all([
    prisma.lead.findUniqueOrThrow({ where: { id: targetId } }),
    prisma.lead.findUniqueOrThrow({ where: { id: sourceId } }),
  ]);

  // Merge tags: union + deduplicate
  const mergedTags = [...new Set([...target.tags, ...source.tags])];

  // Only override null fields on the target with non-null values from source
  const fieldFill: Partial<{
    phone: string; company: string; jobTitle: string; dealValue: unknown;
    clientId: string; sourceDetail: string; assignedTo: string;
  }> = {};
  if (!target.phone      && source.phone)      fieldFill.phone      = source.phone;
  if (!target.company    && source.company)     fieldFill.company    = source.company;
  if (!target.jobTitle   && source.jobTitle)    fieldFill.jobTitle   = source.jobTitle;
  if (!target.dealValue  && source.dealValue)   fieldFill.dealValue  = source.dealValue;
  if (!target.clientId   && source.clientId)    fieldFill.clientId   = source.clientId;
  if (!target.sourceDetail && source.sourceDetail) fieldFill.sourceDetail = source.sourceDetail;
  if (!target.assignedTo && source.assignedTo) fieldFill.assignedTo = source.assignedTo;

  await prisma.$transaction([
    // 1. Move notes
    prisma.leadNote.updateMany({
      where: { leadId: sourceId },
      data:  { leadId: targetId },
    }),
    // 2. Move activities
    prisma.leadActivity.updateMany({
      where: { leadId: sourceId },
      data:  { leadId: targetId },
    }),
    // 3. Move reminders
    prisma.followUpReminder.updateMany({
      where: { leadId: sourceId },
      data:  { leadId: targetId },
    }),
    // 4. Update target: fill nulls + merge tags
    prisma.lead.update({
      where: { id: targetId },
      data:  { ...fieldFill, tags: mergedTags, lastActivityAt: new Date() } as Prisma.LeadUncheckedUpdateInput,
    }),
    // 5. Audit activity on target
    prisma.leadActivity.create({
      data: {
        leadId:      targetId,
        type:        "LEAD_MERGED",
        description: `Merged duplicate lead: ${source.firstName} ${source.lastName} (${source.email})`,
        metadata: {
          sourceId:    source.id,
          sourceEmail: source.email,
          sourcePhone: source.phone,
          sourceName:  `${source.firstName} ${source.lastName}`,
        },
        performedBy,
      },
    }),
    // 6. Delete source — cascade removes LeadScore, LeadPipeline, etc.
    prisma.lead.delete({ where: { id: sourceId } }),
  ]);

  return prisma.lead.findUniqueOrThrow({
    where:   { id: targetId },
    include: {
      notes:      { orderBy: { createdAt: "desc" } },
      activities: { orderBy: { createdAt: "desc" } },
      reminders:  { orderBy: { dueAt: "asc" } },
      score:      true,
    },
  });
}

// ---------------------------------------------------------------------------
// Stale-lead query (for auto follow-up reminders)
// ---------------------------------------------------------------------------

/**
 * Returns active leads (not WON/LOST) whose lastActivityAt is older than
 * the given cutoff date (i.e. no activity for > 3 days).
 * Also includes leads that have never had any activity but were created
 * before the cutoff.
 */
export async function findStaleLeads(cutoff: Date) {
  return prisma.lead.findMany({
    where: {
      stage: { notIn: ["WON", "LOST"] },
      OR: [
        { lastActivityAt: { lt: cutoff } },
        { lastActivityAt: null, createdAt: { lt: cutoff } },
      ],
    },
    select: {
      id:         true,
      firstName:  true,
      lastName:   true,
      company:    true,
      assignedTo: true,
    },
  });
}
