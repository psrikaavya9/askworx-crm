/**
 * contact-matcher.service.ts
 *
 * Resolves an inbound email address or phone number to a known Client/Lead
 * and identifies the staff member involved.
 *
 * All queries are lightweight selects; phone matching uses in-memory suffix
 * comparison to handle country-code variations without a normalised column.
 */

import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Phone normalisation
// ---------------------------------------------------------------------------

function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Matches by the last N digits (up to 10).
 * Handles variations like +91-9876543210 vs 9876543210 vs (987) 654-3210.
 */
function phoneMatches(stored: string, incoming: string): boolean {
  const a = digitsOnly(stored);
  const b = digitsOnly(incoming);
  if (!a || !b) return false;
  const len = Math.min(a.length, b.length, 10);
  return a.slice(-len) === b.slice(-len);
}

// ---------------------------------------------------------------------------
// Result shape
// ---------------------------------------------------------------------------

export interface ContactMatch {
  /** Prisma Client.id if found, else null */
  clientId:  string | null;
  /** Prisma Lead.id if found, else null */
  leadId:    string | null;
  /** Assigned rep's Staff.id (from client.assignedTo or lead.assignedTo) */
  staffId:   string | null;
}

// ---------------------------------------------------------------------------
// Match by email address
// ---------------------------------------------------------------------------

export async function matchByEmail(email: string): Promise<ContactMatch> {
  const norm = email.trim().toLowerCase();

  // 1. Direct client match
  const client = await prisma.client.findUnique({
    where:  { email: norm },
    select: { id: true, assignedTo: true },
  });
  if (client) return { clientId: client.id, leadId: null, staffId: client.assignedTo };

  // 2. Lead match (lead may have a linked client)
  const lead = await prisma.lead.findUnique({
    where:  { email: norm },
    select: { id: true, clientId: true, assignedTo: true },
  });
  if (lead) return { clientId: lead.clientId, leadId: lead.id, staffId: lead.assignedTo };

  return { clientId: null, leadId: null, staffId: null };
}

// ---------------------------------------------------------------------------
// Match by phone number
// ---------------------------------------------------------------------------

export async function matchByPhone(rawPhone: string): Promise<ContactMatch> {
  const stripped = rawPhone.replace(/^whatsapp:/i, "").trim();

  const [clients, leads] = await Promise.all([
    prisma.client.findMany({
      where:   { phone: { not: null } },
      select:  { id: true, phone: true, assignedTo: true },
    }),
    prisma.lead.findMany({
      where:   { phone: { not: null } },
      select:  { id: true, phone: true, clientId: true, assignedTo: true },
    }),
  ]);

  const mc = clients.find((c) => phoneMatches(c.phone!, stripped));
  if (mc) return { clientId: mc.id, leadId: null, staffId: mc.assignedTo };

  const ml = leads.find((l) => phoneMatches(l.phone!, stripped));
  if (ml) return { clientId: ml.clientId, leadId: ml.id, staffId: ml.assignedTo };

  return { clientId: null, leadId: null, staffId: null };
}

// ---------------------------------------------------------------------------
// Staff resolution helpers
// ---------------------------------------------------------------------------

/** Find an ACTIVE staff member by their email address */
export async function findStaffByEmail(email: string): Promise<string | null> {
  const staff = await prisma.staff.findUnique({
    where:  { email: email.trim().toLowerCase() },
    select: { id: true, status: true },
  });
  return staff?.status === "ACTIVE" ? staff.id : null;
}

/** Find an ACTIVE staff member by phone number (suffix-match) */
export async function findStaffByPhone(rawPhone: string): Promise<string | null> {
  const stripped = rawPhone.replace(/^whatsapp:/i, "").trim();
  const all = await prisma.staff.findMany({
    where:  { phone: { not: null }, status: "ACTIVE" },
    select: { id: true, phone: true },
  });
  return all.find((s) => phoneMatches(s.phone!, stripped))?.id ?? null;
}

/**
 * Fallback: returns the first active OWNER → SUPER_ADMIN → ADMIN → MANAGER
 * staff record (for when no specific rep can be identified).
 */
export async function findFallbackStaff(): Promise<string | null> {
  const staff = await prisma.staff.findFirst({
    where:   { status: "ACTIVE", role: { in: ["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER"] } },
    select:  { id: true },
    orderBy: { createdAt: "asc" },
  });
  return staff?.id ?? null;
}
