import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withRole } from "@/lib/middleware/roleCheck";
import { calculateHealthScore } from "@/modules/customer360/services/healthScore.service";

type Ctx = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

/** cuid() IDs are 25 chars starting with 'c'. Reject anything else early. */
const clientIdSchema = z.string().min(1).max(30).regex(/^c[a-z0-9]+$/i, {
  message: "Invalid client ID format",
});

const postBodySchema = z.object({
  persist: z.boolean().optional().default(true),
});

// ---------------------------------------------------------------------------
// In-memory rate-limit: max 1 recalculation per client per 5 minutes.
//
// Rationale: calculateHealthScore fans out 3 parallel Prisma queries. At 1
// req/second per client this becomes a meaningful DB load even for MANAGER+
// users. A simple in-process map is sufficient here — the freshness guard
// inside the service adds a second layer of protection (1h TTL on writes).
//
// For multi-instance deployments, replace with Redis INCR + EXPIRE.
// ---------------------------------------------------------------------------

const recalcCooldownMs = 5 * 60 * 1000; // 5 minutes
const lastRecalcByClient = new Map<string, number>();

function isRateLimited(clientId: string): boolean {
  const last = lastRecalcByClient.get(clientId);
  if (!last) return false;
  return Date.now() - last < recalcCooldownMs;
}

function markRecalc(clientId: string) {
  lastRecalcByClient.set(clientId, Date.now());
  // Prevent unbounded map growth — prune entries older than 1 hour
  if (lastRecalcByClient.size > 10_000) {
    const threshold = Date.now() - 60 * 60 * 1000;
    for (const [k, v] of lastRecalcByClient) {
      if (v < threshold) lastRecalcByClient.delete(k);
    }
  }
}

// ---------------------------------------------------------------------------
// GET /api/customers/:id/health-score
//
// Returns the latest persisted score without recalculating.
// Fast read — uses the composite index (clientId, calculatedAt).
// ---------------------------------------------------------------------------

export const GET = withRole(
  "STAFF",
  async (_req: NextRequest, _user, ctx?: Ctx) => {
    const { id } = await ctx!.params;

    const validation = clientIdSchema.safeParse(id);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: "Invalid client ID" },
        { status: 400 },
      );
    }

    const score = await prisma.customerHealthScore.findFirst({
      where:   { clientId: id },
      orderBy: { calculatedAt: "desc" },
    });

    if (!score) {
      return NextResponse.json(
        { success: false, error: "No health score calculated yet" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: score });
  },
);

// ---------------------------------------------------------------------------
// POST /api/customers/:id/health-score
//
// Triggers a fresh calculation and persists the result.
// Restricted to MANAGER and above (prevents staff gaming their own scores).
// Rate-limited: 1 recalculation per client per 5 minutes.
//
// Body (optional): { persist: boolean }  — false = dry run, no DB write.
// ---------------------------------------------------------------------------

export const POST = withRole(
  "MANAGER",
  async (req: NextRequest, _user, ctx?: Ctx) => {
    const { id } = await ctx!.params;

    const idValidation = clientIdSchema.safeParse(id);
    if (!idValidation.success) {
      return NextResponse.json(
        { success: false, error: "Invalid client ID" },
        { status: 400 },
      );
    }

    const rawBody = await req.json().catch(() => ({}));
    const bodyParsed = postBodySchema.safeParse(rawBody);
    if (!bodyParsed.success) {
      return NextResponse.json(
        { success: false, error: bodyParsed.error.flatten() },
        { status: 400 },
      );
    }

    const { persist } = bodyParsed.data;

    // Rate limit only applies to persisting writes — dry runs are always allowed
    if (persist && isRateLimited(id)) {
      return NextResponse.json(
        {
          success: false,
          error:   "Health score was calculated recently. Please wait before recalculating.",
          retryAfterMs: recalcCooldownMs,
        },
        { status: 429 },
      );
    }

    try {
      const result = await calculateHealthScore(id, persist);
      if (persist) markRecalc(id);
      return NextResponse.json({ success: true, data: result });
    } catch (err) {
      const message = (err as Error).message;
      const status  = message.includes("not found") ? 404 : 422;
      return NextResponse.json({ success: false, error: message }, { status });
    }
  },
);
