import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type DuplicateConfidence = "HIGH" | "MEDIUM";

export interface DuplicateMatch {
  id:         string;
  firstName:  string;
  lastName:   string;
  email:      string;
  phone:      string | null;
  company:    string | null;
  stage:      string;
  priority:   string;
  dealValue:  number | null;
  createdAt:  Date;
  confidence: DuplicateConfidence;
  /** Human-readable reasons, e.g. ["Same email address", "Same phone number"] */
  reasons:    string[];
}

export interface DuplicateCheckResult {
  hasDuplicates: boolean;
  matches:       DuplicateMatch[];
}

export interface DuplicateCheckInput {
  email:      string;
  phone?:     string | null;
  firstName:  string;
  lastName:   string;
  company?:   string | null;
  /** When checking during an update, exclude the lead being edited. */
  excludeId?: string;
}

// ---------------------------------------------------------------------------
// Error class — thrown by createLead when duplicates are found (without force)
// ---------------------------------------------------------------------------

export class DuplicateLeadError extends Error {
  constructor(public readonly matches: DuplicateMatch[]) {
    super("Potential duplicate leads found");
    this.name = "DuplicateLeadError";
  }
}

// ---------------------------------------------------------------------------
// Phone normalisation
// ---------------------------------------------------------------------------

/**
 * Strips all non-digit characters so "+1 (555) 123-4567" and "15551234567"
 * compare equal.  Returns an empty string for null/undefined input.
 */
function normalizePhone(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "");
}

// ---------------------------------------------------------------------------
// Core checker
// ---------------------------------------------------------------------------

/**
 * Detects potential duplicate leads using three parallel DB queries:
 *
 *   HIGH confidence:   same email (exact, case-insensitive)
 *                      same phone (exact input string, OR same digits)
 *   MEDIUM confidence: same firstName + lastName + company (case-insensitive)
 *
 * All queries are bounded (take: 5) and use the indexes added in this migration:
 *   @@index([phone])
 *   @@index([firstName, lastName, company])
 *   The email @unique constraint already provides an index.
 *
 * Results are deduplicated by lead id and sorted HIGH → MEDIUM.
 */
export async function checkDuplicates(
  input: DuplicateCheckInput,
): Promise<DuplicateCheckResult> {
  const { email, phone, firstName, lastName, company, excludeId } = input;
  const normalizedInputPhone = normalizePhone(phone);

  const idFilter = excludeId ? { id: { not: excludeId } } : {};

  // ── Run all three queries in parallel ─────────────────────────────────────
  const [byEmail, byPhoneExact, byName] = await Promise.all([
    // 1. Exact email match — uses the @unique index, O(1)
    prisma.lead.findMany({
      where: { email: { equals: email, mode: "insensitive" }, ...idFilter },
      take: 5,
    }),

    // 2. Exact phone string match — uses @@index([phone])
    //    A second application-level pass (below) widens this to digit equivalence.
    phone
      ? prisma.lead.findMany({
          where: { phone, ...idFilter },
          take: 5,
        })
      : Promise.resolve([]),

    // 3. Same first + last name, optionally same company — uses @@index([firstName, lastName, company])
    prisma.lead.findMany({
      where: {
        firstName: { equals: firstName, mode: "insensitive" },
        lastName:  { equals: lastName,  mode: "insensitive" },
        ...(company ? { company: { equals: company, mode: "insensitive" } } : {}),
        ...idFilter,
      },
      take: 5,
    }),
  ]);

  // ── Application-level phone normalisation pass ─────────────────────────────
  // If the caller's phone has ≥ 7 digits, also find leads whose stored phone
  // normalises to the same digit string (catches "+1 (555)…" vs "5551234567").
  // We limit the scan to leads found by name or email to stay indexed.
  const digitMatchIds = new Set<string>();
  if (normalizedInputPhone.length >= 7) {
    // Collect all candidate IDs already loaded from the other queries
    const candidateIds = [
      ...byEmail.map((l) => l.id),
      ...byPhoneExact.map((l) => l.id),
      ...byName.map((l) => l.id),
    ];

    if (candidateIds.length > 0) {
      const withPhones = await prisma.lead.findMany({
        where: { id: { in: candidateIds }, phone: { not: null } },
        select: { id: true, phone: true },
      });
      for (const { id, phone: storedPhone } of withPhones) {
        if (normalizePhone(storedPhone) === normalizedInputPhone) {
          digitMatchIds.add(id);
        }
      }
    }

    // Also do a bounded scan for other leads with similar phone
    if (normalizedInputPhone.length >= 10) {
      // Fetch up to 50 leads that share the same last 9 digits region by
      // matching a raw suffix — this is an approximate scan, not a full-table scan.
      // In very large DBs, a stored phoneNormalized column would be faster.
      const suffix = normalizedInputPhone.slice(-9);
      const phoneCandidates = await prisma.lead.findMany({
        where: {
          phone:    { contains: suffix },
          ...idFilter,
        },
        select: { id: true, phone: true },
        take: 20,
      });
      for (const { id, phone: storedPhone } of phoneCandidates) {
        if (normalizePhone(storedPhone) === normalizedInputPhone) {
          digitMatchIds.add(id);
        }
      }
    }
  }

  // ── Deduplicate and classify by lead id ───────────────────────────────────
  type AnyLead = (typeof byEmail)[number];
  const matchMap = new Map<string, DuplicateMatch>();

  function upsert(lead: AnyLead, confidence: DuplicateConfidence, reason: string) {
    const existing = matchMap.get(lead.id);
    if (existing) {
      if (confidence === "HIGH") existing.confidence = "HIGH";
      if (!existing.reasons.includes(reason)) existing.reasons.push(reason);
    } else {
      matchMap.set(lead.id, {
        id:        lead.id,
        firstName: lead.firstName,
        lastName:  lead.lastName,
        email:     lead.email,
        phone:     lead.phone,
        company:   lead.company,
        stage:     lead.stage,
        priority:  lead.priority,
        dealValue: lead.dealValue != null ? Number(lead.dealValue) : null,
        createdAt: lead.createdAt,
        confidence,
        reasons:   [reason],
      });
    }
  }

  for (const lead of byEmail)      upsert(lead, "HIGH",   "Same email address");
  for (const lead of byPhoneExact) upsert(lead, "HIGH",   "Same phone number");

  // Apply digit-normalisation matches (IDs collected from the wider scan)
  for (const [id] of matchMap.entries()) {
    if (digitMatchIds.has(id)) {
      const m = matchMap.get(id)!;
      m.confidence = "HIGH";
      if (!m.reasons.includes("Same phone number")) m.reasons.push("Same phone number");
    }
  }
  // Digit matches on leads not yet in the map need to be loaded
  const unseenDigitIds = [...digitMatchIds].filter((id) => !matchMap.has(id));
  if (unseenDigitIds.length > 0) {
    const extra = await prisma.lead.findMany({ where: { id: { in: unseenDigitIds } } });
    for (const lead of extra) upsert(lead, "HIGH", "Same phone number");
  }

  for (const lead of byName) upsert(lead, "MEDIUM", company ? "Same name and company" : "Same name");

  // ── Sort: HIGH first ───────────────────────────────────────────────────────
  const matches = [...matchMap.values()].sort((a, b) =>
    a.confidence === "HIGH" && b.confidence !== "HIGH" ? -1
    : a.confidence !== "HIGH" && b.confidence === "HIGH" ? 1
    : 0,
  );

  return { hasDuplicates: matches.length > 0, matches };
}
