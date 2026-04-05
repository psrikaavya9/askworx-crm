import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getCustomerTimelinePage,
  type TimelineSource,
} from "@/modules/customer360/services/timeline.service";

/**
 * GET /api/customers/:id/timeline
 *
 * Returns a source-filtered, cursor-paginated slice of the customer timeline.
 *
 * Query parameters:
 *   source  — "all" | "crm" | "projects" | "finance" | "complaints"  (default "all")
 *   cursor  — opaque string returned as `nextCursor` from the previous page
 *   limit   — page size, 1–100  (default 50)
 *
 * Response:
 *   {
 *     success: true,
 *     events:     TimelineEvent[],
 *     nextCursor: string | null,   // pass as `cursor` on the next call
 *     total:      number           // total matching events across all pages
 *   }
 */

type Ctx = { params: Promise<{ id: string }> };

// ─── Input schemas ────────────────────────────────────────────────────────────

/** cuid() starts with 'c', 25 chars, alphanumeric. */
const clientIdSchema = z
  .string()
  .min(1)
  .max(30)
  .regex(/^c[a-z0-9]+$/i, { message: "Invalid client ID" });

const querySchema = z.object({
  source: z
    .enum(["all", "crm", "projects", "finance", "complaints"])
    .optional()
    .default("all"),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;

  // Validate client ID
  const idResult = clientIdSchema.safeParse(id);
  if (!idResult.success) {
    return NextResponse.json(
      { success: false, error: "Invalid client ID" },
      { status: 400 },
    );
  }

  // Validate query params
  const sp = req.nextUrl.searchParams;
  const qResult = querySchema.safeParse({
    source: sp.get("source") ?? undefined,
    cursor: sp.get("cursor") ?? undefined,
    limit:  sp.get("limit")  ?? undefined,
  });
  if (!qResult.success) {
    return NextResponse.json(
      { success: false, error: qResult.error.flatten() },
      { status: 400 },
    );
  }

  const { source, cursor, limit } = qResult.data;

  try {
    const page = await getCustomerTimelinePage(id, {
      source: source as TimelineSource,
      cursor,
      limit,
    });

    return NextResponse.json({
      success: true,
      events:     page.events,
      nextCursor: page.nextCursor,
      total:      page.total,
    });
  } catch (err) {
    console.error("[GET /api/customers/:id/timeline]", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch timeline" },
      { status: 500 },
    );
  }
}
