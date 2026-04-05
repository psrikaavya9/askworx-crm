import { NextRequest, NextResponse } from "next/server";
import * as expenseService from "@/modules/finance/services/expense.service";
import { createExpenseSchema, expenseFiltersSchema } from "@/modules/finance/schemas/expense.schema";
import { ZodError } from "zod";
import { serializePrisma } from "@/lib/serialize";
import {
  validateAttendance,
  validateGPS,
  validateReceipt,
} from "@/modules/finance/services/expenseValidation";
import { determineApprovalStatus } from "@/modules/finance/services/approvalRouting";
import { logAudit } from "@/lib/audit";
import { withAuth } from "@/lib/middleware/authMiddleware";
import { withRole, hasRole } from "@/lib/middleware/roleCheck";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// GET /api/expenses
//
// ADMIN+ → all expenses
// STAFF  → their own expenses only (scoped to user.sub)
// ---------------------------------------------------------------------------

export const GET = withAuth(async (req: NextRequest, user) => {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const filters = expenseFiltersSchema.parse(params);

    // Staff see only their own expenses; admins see everything
    if (!hasRole(user.role, "ADMIN")) {
      filters.staffId = user.sub;
    }

    const result = await expenseService.getExpenses(filters);
    return NextResponse.json(serializePrisma(result));
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

// ---------------------------------------------------------------------------
// POST /api/expenses  (minimum role: STAFF)
//
// staffId is derived from the JWT (user.sub) — never trusted from the body.
// This prevents any staff member from submitting an expense on behalf of
// another person.
//
// Strict validation order:
//   1. Zod schema parse
//   2. Layer 1 — Attendance   → hard-reject on failure
//   3. Layer 2 — GPS          → flag only, never rejects
//   4. Layer 3 — Receipt      → hard-reject on failure; flag on soft rule
//   5. Layer 4 — Approval routing → derives status from amount + flag state
//   6. Persist ONLY after all layers pass
// ---------------------------------------------------------------------------

export const POST = withRole("STAFF", async (req: NextRequest, user) => {
  try {
    const body = await req.json();
    const data = createExpenseSchema.parse(body);

    // Always use the authenticated user's id — ignore any staffId in the body
    const staffId = user.sub;

    // ── Optional relation validation ─────────────────────────────────────────
    if (data.clientId) {
      const client = await prisma.client.findUnique({ where: { id: data.clientId }, select: { id: true } });
      if (!client) {
        return NextResponse.json({ success: false, error: `Client not found: ${data.clientId}` }, { status: 422 });
      }
    }

    if (data.projectId) {
      const project = await prisma.project.findUnique({ where: { id: data.projectId }, select: { id: true } });
      if (!project) {
        return NextResponse.json({ success: false, error: `Project not found: ${data.projectId}` }, { status: 422 });
      }
    }

    // ── Layer 1: Attendance validation ───────────────────────────────────────
    const attendance = await validateAttendance(staffId, data.date);
    if (!attendance.valid) {
      return NextResponse.json(
        { success: false, error: attendance.reason },
        { status: 400 },
      );
    }

    // ── Layer 2: GPS validation ──────────────────────────────────────────────
    const gps = await validateGPS({
      gpsLat:   data.gpsLat,
      gpsLng:   data.gpsLng,
      clientId: data.clientId,
    });

    // ── Layer 3: Receipt validation ──────────────────────────────────────────
    const receipt = await validateReceipt({
      staffId,
      amount:      Number(data.amount),
      description: data.description,
      receiptUrl:  data.receiptUrl,
      date:        data.date,
    });

    if (!receipt.valid) {
      return NextResponse.json(
        { success: false, error: receipt.reason },
        { status: 400 },
      );
    }

    // ── Merge flags from Layer 2 + Layer 3 ──────────────────────────────────
    const flagReasons: string[] = [];
    if (gps.isFlagged)                    flagReasons.push(gps.flagReason);
    if (receipt.flagged && receipt.reason) flagReasons.push(receipt.reason);

    const isFlagged  = flagReasons.length > 0;
    const flagReason = isFlagged ? flagReasons.join(" + ") : undefined;

    // ── Layer 4: Approval routing ────────────────────────────────────────────
    const status = determineApprovalStatus(Number(data.amount), isFlagged);

    // ── Persist ONLY after all validations pass ──────────────────────────────
    const expense = await expenseService.createExpense({
      ...data,
      staffId,
      status,
      isFlagged,
      flagReason,
    });

    logAudit(staffId, "EXPENSE_CREATED", "expense", expense.id, {
      amount: Number(data.amount),
      category: data.category,
      status,
      isFlagged,
    });

    return NextResponse.json(serializePrisma(expense), { status: 201 });
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ success: false, error: err.flatten() }, { status: 400 });
    if (err instanceof Error)
      return NextResponse.json({ success: false, error: err.message }, { status: 400 });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
});
