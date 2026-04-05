import { prisma } from "@/lib/prisma"
import { InteractionType } from "@/generated/prisma/client"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TimelineItem = {
  id: string
  type: string
  title: string
  date: Date
  icon: string
  description: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: any
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapInteractionType(type: InteractionType): Pick<TimelineItem, "title" | "icon"> {
  switch (type) {
    case InteractionType.CALL:
      return { title: "Call logged", icon: "📞" }
    case InteractionType.VISIT:
      return { title: "Client visit", icon: "🤝" }
    default:
      return { title: "Note added", icon: "📝" }
  }
}

// ---------------------------------------------------------------------------
// Main service
// ---------------------------------------------------------------------------

export async function getCustomerTimeline(clientId: string): Promise<TimelineItem[]> {
  const [interactions, projects, invoices, payments, complaints] = await Promise.all([
    // Task 2 — interactions: ONLY approved and not rejected
    prisma.customerInteraction.findMany({
      where: {
        clientId,
        approved: true,
        rejected: false,
      },
      orderBy: { date: "desc" },
    }),

    // Task 2 — projects
    prisma.project.findMany({
      where: { clientId },
      select: {
        id: true,
        name: true,
        description: true,
        startDate: true,
        status: true,
        deadline: true,
        createdAt: true,
      },
    }),

    // Task 2 — invoices
    prisma.invoice.findMany({
      where: { clientId },
      select: {
        id: true,
        invoiceNumber: true,
        issueDate: true,
        dueDate: true,
        totalAmount: true,
        status: true,
      },
    }),

    // Task 2 — payments (joined through invoice → client)
    prisma.payment.findMany({
      where: { invoice: { clientId } },
      select: {
        id: true,
        invoiceId: true,
        amount: true,
        paymentDate: true,
        paymentMethod: true,
        referenceNumber: true,
      },
    }),

    // Task 2 — complaints
    prisma.complaint.findMany({
      where: { clientId },
      select: {
        id: true,
        description: true,
        priority: true,
        status: true,
        createdAt: true,
        resolvedAt: true,
      },
    }),
  ])

  // -------------------------------------------------------------------------
  // Task 3 + 4 — Normalize each module into TimelineItem[]
  // -------------------------------------------------------------------------

  const interactionItems: TimelineItem[] = interactions.map((i) => {
    const { title, icon } = mapInteractionType(i.type)
    return {
      id: i.id,
      type: i.type,
      title,
      date: i.date,
      icon,
      description: i.outcome ?? i.notes ?? "",
      metadata: {
        staffId: i.staffId,
        duration: i.duration,
        nextFollowUp: i.nextFollowUp,
        gpsLat: i.gpsLat,
        gpsLng: i.gpsLng,
      },
    }
  })

  const projectItems: TimelineItem[] = projects.map((p) => ({
    id: p.id,
    type: "PROJECT",
    title: "Project started",
    date: p.startDate ?? p.createdAt,
    icon: "🚀",
    description: p.description ? `${p.name} — ${p.description}` : p.name,
    metadata: {
      status: p.status,
      deadline: p.deadline,
    },
  }))

  const invoiceItems: TimelineItem[] = invoices.map((inv) => ({
    id: inv.id,
    type: "INVOICE",
    title: "Invoice raised",
    date: inv.issueDate,
    icon: "🧾",
    description: `Invoice #${inv.invoiceNumber} — ₹${inv.totalAmount.toString()}`,
    metadata: {
      status: inv.status,
      dueDate: inv.dueDate,
      totalAmount: inv.totalAmount.toString(),
    },
  }))

  const paymentItems: TimelineItem[] = payments.map((pay) => ({
    id: pay.id,
    type: "PAYMENT",
    title: "Payment received",
    date: pay.paymentDate,
    icon: "💰",
    description: `₹${pay.amount.toString()} via ${pay.paymentMethod}`,
    metadata: {
      invoiceId: pay.invoiceId,
      method: pay.paymentMethod,
      referenceNumber: pay.referenceNumber,
    },
  }))

  const complaintItems: TimelineItem[] = complaints.map((c) => ({
    id: c.id,
    type: "COMPLAINT",
    title: "Complaint raised",
    date: c.createdAt,
    icon: "⚠️",
    description: c.description,
    metadata: {
      priority: c.priority,
      status: c.status,
      resolvedAt: c.resolvedAt,
    },
  }))

  // -------------------------------------------------------------------------
  // Task 5 — Merge all arrays
  // -------------------------------------------------------------------------

  const timeline: TimelineItem[] = [
    ...interactionItems,
    ...projectItems,
    ...invoiceItems,
    ...paymentItems,
    ...complaintItems,
  ]

  // -------------------------------------------------------------------------
  // Task 5 — Sort chronologically descending (newest first)
  // -------------------------------------------------------------------------

  timeline.sort((a, b) => b.date.getTime() - a.date.getTime())

  // -------------------------------------------------------------------------
  // Task 8 — Debug log
  // -------------------------------------------------------------------------

  console.log("Timeline items:", timeline.length)

  // -------------------------------------------------------------------------
  // Task 6 — Return
  // -------------------------------------------------------------------------

  return timeline
}
