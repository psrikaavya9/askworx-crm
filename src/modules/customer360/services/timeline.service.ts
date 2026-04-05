import { prisma } from "@/lib/prisma";
import type {
  TimelineEvent,
  TimelineEventType,
  InteractionMeta,
  ProjectMeta,
  InvoiceMeta,
  PaymentMeta,
  ComplaintMeta,
} from "../types/timeline.types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Stable deterministic id prevents React key collisions across event types. */
function eid(type: TimelineEventType, id: string): string {
  return `${type}::${id}`;
}

function iso(date: Date): string {
  return date.toISOString();
}

// ---------------------------------------------------------------------------
// Source mappers — one per Prisma model
// ---------------------------------------------------------------------------

function mapInteractions(
  rows: Awaited<ReturnType<typeof fetchInteractions>>,
): TimelineEvent[] {
  const INTERACTION_ICONS: Record<string, string> = {
    CALL:      "Phone",
    VISIT:     "MapPin",
    NOTE:      "StickyNote",
    EMAIL:     "Mail",
    WHATSAPP:  "MessageCircle",
  };

  const INTERACTION_TITLES: Record<string, string> = {
    CALL:      "Call logged",
    VISIT:     "Visit recorded",
    NOTE:      "Note added",
    EMAIL:     "Email",
    WHATSAPP:  "WhatsApp message",
  };

  return rows.map((r) => {
    const staffName  = r.staff
      ? `${r.staff.firstName} ${r.staff.lastName}`
      : "Unknown staff";
    const photoCount = Array.isArray(r.photos) ? r.photos.length : 0;

    let description: string;
    if (r.type === "EMAIL") {
      description = r.messageSubject ? r.messageSubject.slice(0, 120) : staffName;
      description += r.direction === "INBOUND" ? " · Received" : " · Sent";
    } else if (r.type === "WHATSAPP") {
      const preview = r.messageContent ? r.messageContent.slice(0, 100) : staffName;
      description   = preview + (r.direction === "INBOUND" ? " · Received" : " · Sent");
    } else {
      description = staffName;
      if (r.outcome) description += ` · ${r.outcome}`;
      if (r.type === "CALL" && r.duration != null) description += ` · ${r.duration} min`;
    }

    const meta: InteractionMeta = {
      kind:              "interaction",
      interactionId:     r.id,
      staffName,
      duration:          r.duration,
      outcome:           r.outcome,
      approved:          r.approved,
      rejected:          r.rejected,
      gpsLat:            r.gpsLat,
      gpsLng:            r.gpsLng,
      photoCount,
      nextFollowUp:      r.nextFollowUp,
      messagePreview:    r.messageContent ? r.messageContent.slice(0, 300) : null,
      messageSubject:    r.messageSubject   ?? null,
      direction:         (r.direction as "INBOUND" | "OUTBOUND" | null) ?? null,
      counterpartyEmail: r.counterpartyEmail ?? null,
      counterpartyPhone: r.counterpartyPhone ?? null,
      externalId:        r.externalId        ?? null,
    };

    return {
      id:          eid(r.type as TimelineEventType, r.id),
      type:        r.type as TimelineEventType,
      title:       INTERACTION_TITLES[r.type] ?? "Interaction",
      date:        iso(r.date),
      icon:        INTERACTION_ICONS[r.type] ?? "Activity",
      description,
      metadata:    meta,
    };
  });
}

function mapProjects(
  rows: Awaited<ReturnType<typeof fetchProjects>>,
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const p of rows) {
    const baseMeta: ProjectMeta = {
      kind:        "project",
      projectId:   p.id,
      projectName: p.name,
      status:      p.status,
      taskCount:   p._count.tasks,
      deadline:    p.deadline,
    };

    // Always emit PROJECT_CREATED on createdAt
    events.push({
      id:          eid("PROJECT_CREATED", p.id),
      type:        "PROJECT_CREATED",
      title:       "Project started",
      date:        iso(p.createdAt),
      icon:        "FolderKanban",
      description: `"${p.name}" was created with ${p._count.tasks} task${p._count.tasks !== 1 ? "s" : ""}`,
      metadata:    baseMeta,
    });

    // Emit PROJECT_COMPLETED only when status is COMPLETED
    // Use updatedAt as the best available proxy for completion timestamp
    if (p.status === "COMPLETED") {
      events.push({
        id:          eid("PROJECT_COMPLETED", p.id),
        type:        "PROJECT_COMPLETED",
        title:       "Project completed",
        date:        iso(p.updatedAt),
        icon:        "CheckCircle2",
        description: `"${p.name}" was marked as completed`,
        metadata:    { ...baseMeta },
      });
    }

    if (p.status === "ON_HOLD") {
      events.push({
        id:          eid("PROJECT_ON_HOLD", p.id),
        type:        "PROJECT_ON_HOLD",
        title:       "Project put on hold",
        date:        iso(p.updatedAt),
        icon:        "PauseCircle",
        description: `"${p.name}" is currently on hold`,
        metadata:    { ...baseMeta },
      });
    }
  }

  return events;
}

function mapInvoices(
  rows: Awaited<ReturnType<typeof fetchInvoices>>,
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const inv of rows) {
    const amount = Number(inv.totalAmount);
    const baseMeta: InvoiceMeta = {
      kind:          "invoice",
      invoiceId:     inv.id,
      invoiceNumber: inv.invoiceNumber,
      totalAmount:   amount,
      status:        inv.status,
      dueDate:       inv.dueDate,
    };

    // Invoice issued — use issueDate as the anchor point
    events.push({
      id:          eid("INVOICE_ISSUED", inv.id),
      type:        "INVOICE_ISSUED",
      title:       `Invoice ${inv.invoiceNumber} issued`,
      date:        iso(inv.issueDate),
      icon:        "ReceiptText",
      description: `₹${amount.toLocaleString("en-IN")} due by ${inv.dueDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`,
      metadata:    baseMeta,
    });

    // Invoice paid — use updatedAt (set by auto-PAID trigger in payment service)
    if (inv.status === "PAID") {
      events.push({
        id:          eid("INVOICE_PAID", inv.id),
        type:        "INVOICE_PAID",
        title:       `Invoice ${inv.invoiceNumber} fully paid`,
        date:        iso(inv.updatedAt),
        icon:        "BadgeCheck",
        description: `₹${amount.toLocaleString("en-IN")} received in full`,
        metadata:    baseMeta,
      });
    }

    // Invoice overdue — only emit a synthetic event when it is currently OVERDUE
    if (inv.status === "OVERDUE") {
      events.push({
        id:          eid("INVOICE_OVERDUE", inv.id),
        type:        "INVOICE_OVERDUE",
        title:       `Invoice ${inv.invoiceNumber} overdue`,
        date:        iso(inv.dueDate),   // anchor at due date — when it became overdue
        icon:        "AlertCircle",
        description: `₹${amount.toLocaleString("en-IN")} payment is past due`,
        metadata:    baseMeta,
      });
    }
  }

  return events;
}

function mapPayments(
  rows: Awaited<ReturnType<typeof fetchPayments>>,
): TimelineEvent[] {
  return rows.map((p) => {
    const amount = Number(p.amount);
    const meta: PaymentMeta = {
      kind:            "payment",
      paymentId:       p.id,
      invoiceId:       p.invoice.id,
      invoiceNumber:   p.invoice.invoiceNumber,
      amount,
      paymentMethod:   p.paymentMethod,
      referenceNumber: p.referenceNumber,
    };

    const method = p.paymentMethod.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

    return {
      id:          eid("PAYMENT_RECEIVED", p.id),
      type:        "PAYMENT_RECEIVED" as TimelineEventType,
      title:       "Payment received",
      date:        iso(p.paymentDate),
      icon:        "Banknote",
      description: `₹${amount.toLocaleString("en-IN")} via ${method} against ${p.invoice.invoiceNumber}`,
      metadata:    meta,
    };
  });
}

function mapComplaints(
  rows: Awaited<ReturnType<typeof fetchComplaints>>,
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const c of rows) {
    const snippet =
      c.description.length > 80
        ? c.description.slice(0, 77) + "…"
        : c.description;

    const baseMeta: ComplaintMeta = {
      kind:        "complaint",
      complaintId: c.id,
      priority:    c.priority,
      status:      c.status,
      assignedTo:  c.assignedTo,
      resolution:  c.resolution,
    };

    // Complaint raised
    events.push({
      id:          eid("COMPLAINT_RAISED", c.id),
      type:        "COMPLAINT_RAISED",
      title:       `${c.priority.charAt(0) + c.priority.slice(1).toLowerCase()} complaint raised`,
      date:        iso(c.createdAt),
      icon:        "MessageSquareWarning",
      description: snippet,
      metadata:    baseMeta,
    });

    // Complaint resolved — only when resolvedAt is recorded
    if (c.resolvedAt) {
      events.push({
        id:          eid("COMPLAINT_RESOLVED", c.id),
        type:        "COMPLAINT_RESOLVED",
        title:       "Complaint resolved",
        date:        iso(c.resolvedAt),
        icon:        "ShieldCheck",
        description: c.resolution
          ? c.resolution.length > 80
            ? c.resolution.slice(0, 77) + "…"
            : c.resolution
          : "Complaint marked as resolved",
        metadata:    baseMeta,
      });
    }
  }

  return events;
}

// ---------------------------------------------------------------------------
// Prisma fetchers — parallel, minimal select
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Fetcher limits
//
// These caps keep the timeline fast for high-volume clients while preserving
// the full recent history that matters most for day-to-day CRM usage.
// ---------------------------------------------------------------------------

const LIMITS = {
  interactions: 200,   // ~4 interactions/week × 1 year
  projects:      50,
  invoices:     100,   // ~8 invoices/month × 1 year
  payments:     200,   // payments can outnumber invoices (partial payments)
  complaints:   100,
} as const;

function fetchInteractions(clientId: string) {
  return prisma.customerInteraction.findMany({
    where: {
      clientId,
      rejected: false,  // show approved + pending; exclude only rejected
    },
    orderBy: { date: "desc" },
    take:    LIMITS.interactions,
    include: {
      staff: { select: { firstName: true, lastName: true } },
    },
  });
}

function fetchProjects(clientId: string) {
  return prisma.project.findMany({
    where:   { clientId },
    orderBy: { createdAt: "desc" },
    take:    LIMITS.projects,
    include: { _count: { select: { tasks: true } } },
  });
}

function fetchInvoices(clientId: string) {
  return prisma.invoice.findMany({
    where:   { clientId },
    orderBy: { issueDate: "desc" },
    take:    LIMITS.invoices,
    select: {
      id:            true,
      invoiceNumber: true,
      status:        true,
      issueDate:     true,
      dueDate:       true,
      totalAmount:   true,
      updatedAt:     true,
    },
  });
}

function fetchPayments(clientId: string) {
  return prisma.payment.findMany({
    where:   { invoice: { clientId } },
    orderBy: { paymentDate: "desc" },
    take:    LIMITS.payments,
    select: {
      id:              true,
      amount:          true,
      paymentDate:     true,
      paymentMethod:   true,
      referenceNumber: true,
      invoice: {
        select: { id: true, invoiceNumber: true },
      },
    },
  });
}

function fetchComplaints(clientId: string) {
  return prisma.complaint.findMany({
    where:   { clientId },
    orderBy: { createdAt: "desc" },
    take:    LIMITS.complaints,
    select: {
      id:          true,
      description: true,
      priority:    true,
      status:      true,
      assignedTo:  true,
      resolution:  true,
      resolvedAt:  true,
      createdAt:   true,
    },
  });
}

// ---------------------------------------------------------------------------
// Source-group helpers (shared by both the public function and the page API)
// ---------------------------------------------------------------------------

export type TimelineSource = "all" | "crm" | "projects" | "finance" | "complaints";

const SOURCE_TYPES: Record<Exclude<TimelineSource, "all">, TimelineEventType[]> = {
  crm:        ["CALL", "VISIT", "NOTE", "EMAIL", "WHATSAPP"],
  projects:   ["PROJECT_CREATED", "PROJECT_COMPLETED", "PROJECT_ON_HOLD"],
  finance:    ["INVOICE_ISSUED", "INVOICE_PAID", "INVOICE_OVERDUE", "PAYMENT_RECEIVED"],
  complaints: ["COMPLAINT_RAISED", "COMPLAINT_RESOLVED"],
};

function applySourceFilter(events: TimelineEvent[], source: TimelineSource): TimelineEvent[] {
  if (source === "all") return events;
  const allowed = SOURCE_TYPES[source];
  return events.filter((e) => (allowed as string[]).includes(e.type));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Aggregates all customer-related events into a single, unified timeline.
 *
 * Sources: CustomerInteraction, Project, Invoice, Payment, Complaint
 * Sort:    Latest first (descending by date)
 *
 * Designed for server components and API routes — all dates serialised to ISO.
 */
export async function getCustomerTimeline(
  clientId: string,
): Promise<TimelineEvent[]> {
  // Fan out to all 5 sources in parallel
  const [rawInteractions, projects, invoices, payments, complaints] =
    await Promise.all([
      fetchInteractions(clientId),
      fetchProjects(clientId),
      fetchInvoices(clientId),
      fetchPayments(clientId),
      fetchComplaints(clientId),
    ]);

  // Exclude rejected interactions — pending ones are included intentionally so
  // staff-logged activity (calls, notes, emails) appears immediately on the timeline.
  const interactions = rawInteractions.filter((i) => !i.rejected);

  console.log(
    `[timeline] clientId=${clientId}` +
    ` | DB returned ${rawInteractions.length} interactions` +
    ` | ${interactions.length} passed approved+!rejected guard` +
    ` | projects=${projects.length} invoices=${invoices.length}` +
    ` | payments=${payments.length} complaints=${complaints.length}`,
  );

  const events: TimelineEvent[] = [
    ...mapInteractions(interactions),
    ...mapProjects(projects),
    ...mapInvoices(invoices),
    ...mapPayments(payments),
    ...mapComplaints(complaints),
  ];

  // Sort latest first — ISO strings sort lexicographically correctly
  events.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return events;
}

// ---------------------------------------------------------------------------
// Paginated + filtered API — used by GET /api/customers/:id/timeline
// ---------------------------------------------------------------------------

export interface TimelinePage {
  /** The events on this page, sorted latest-first. */
  events:     TimelineEvent[];
  /**
   * Opaque cursor to pass as `cursor=` on the next request.
   * Format: "<ISO8601>::<eventId>" — null when no further pages exist.
   */
  nextCursor: string | null;
  /** Total events that match the source filter (across all pages). */
  total:      number;
}

/**
 * Paginated, source-filtered version of getCustomerTimeline.
 *
 * Cursor format: "<ISO8601 date>::<event id>" (both parts required for
 * correctness when two events share the same millisecond timestamp).
 * A bare ISO string (no "::" suffix) is also accepted as a lenient fallback.
 *
 * @param clientId  — the Client record id
 * @param options.source  — "all" | "crm" | "projects" | "finance" | "complaints"
 * @param options.cursor  — opaque cursor returned by the previous page
 * @param options.limit   — page size, 1–100, default 50
 */
export async function getCustomerTimelinePage(
  clientId: string,
  options: {
    source?: TimelineSource;
    cursor?: string;
    limit?:  number;
  } = {},
): Promise<TimelinePage> {
  const { source = "all", cursor, limit = 50 } = options;

  // Fetch full merged feed (uses in-memory caps defined in LIMITS above)
  const all = await getCustomerTimeline(clientId);

  // Apply source filter
  const filtered = applySourceFilter(all, source);
  const total = filtered.length;

  // Apply cursor: slice to events that come after the cursor position
  let paged: TimelineEvent[];
  if (cursor) {
    const sepIdx = cursor.indexOf("::");
    const cursorDate = sepIdx === -1 ? cursor : cursor.slice(0, sepIdx);
    const cursorId   = sepIdx === -1 ? null   : cursor.slice(sepIdx + 2);

    // Find the cursor event by date+id (exact), then take everything after it
    const idx = cursorId
      ? filtered.findIndex((e) => e.date === cursorDate && e.id === cursorId)
      : filtered.findIndex((e) => e.date <= cursorDate);

    paged = idx === -1 ? [] : filtered.slice(idx + 1);
  } else {
    paged = filtered;
  }

  // Fetch one extra to detect whether a next page exists
  const pageItems = paged.slice(0, limit);
  const hasMore   = paged.length > limit;
  const nextCursor = hasMore
    ? `${pageItems[pageItems.length - 1].date}::${pageItems[pageItems.length - 1].id}`
    : null;

  return { events: pageItems, nextCursor, total };
}
