import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { withAuth } from "@/lib/middleware/authMiddleware";
import * as expenseService from "@/modules/finance/services/expense.service";
import { createExpenseSchema } from "@/modules/finance/schemas/expense.schema";
import { validateAttendance, validateGPS, validateReceipt } from "@/modules/finance/services/expenseValidation";
import { determineApprovalStatus } from "@/modules/finance/services/approvalRouting";
import { serializePrisma } from "@/lib/serialize";

// ---------------------------------------------------------------------------
// POST /api/expenses/staff
//
// Authenticated staff expense submission.
// staffId is always taken from the JWT — never trusted from the request body.
//
// Validation pipeline:
//   1. Parse + validate request body (Zod)
//   2. Layer 1 — Attendance:  hard-reject if absent / no record
//   3. Layer 2 — GPS:         flag only (never rejects)
//   4. Layer 3 — Receipt:     reject or flag based on amount tier
//   5. Persist expense with merged isFlagged / flagReason
// ---------------------------------------------------------------------------

export const POST = withAuth(async (req: NextRequest, user) => {
  const body = await req.json();

  // Strip staffId from body — it must come from the verified JWT only
  const { staffId: _ignored, ...rest } = body as Record<string, unknown>;

  let data;
  try {
    data = createExpenseSchema.parse(rest);
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ success: false, error: err.flatten() }, { status: 400 });
    throw err;
  }

  // ── Layer 1: Attendance validation ────────────────────────────────────────
  // staffId from JWT, expenseDate from validated body.
  // Returns immediately with a human-readable reason if invalid.
  const attendance = await validateAttendance(user.sub, data.date);
  if (!attendance.valid) {
    return NextResponse.json(
      { success: false, error: attendance.reason },
      { status: 400 },
    );
  }

  // ── Layer 2: GPS validation ───────────────────────────────────────────────
  // Flags only — never rejects.
  const gps = await validateGPS({
    gpsLat:   data.gpsLat,
    gpsLng:   data.gpsLng,
    clientId: data.clientId,
  });

  // ── Layer 3: Receipt validation ───────────────────────────────────────────
  // Can reject (amount-tier rules) or flag (missing optional receipt / weak desc).
  const receipt = await validateReceipt({
    staffId:     user.sub,
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

  // ── Merge flags from Layer 2 + Layer 3 ────────────────────────────────────
  // Both layers can independently set a flag; combine their reasons.
  const flagReasons: string[] = [];
  if (gps.isFlagged)                         flagReasons.push(gps.flagReason);
  if (receipt.flagged && receipt.reason)      flagReasons.push(receipt.reason);
  const isFlagged  = flagReasons.length > 0;
  const flagReason = isFlagged ? flagReasons.join(" + ") : undefined;

  // ── Layer 4: Approval routing ──────────────────────────────────────────────
  // Pure function — derives initial status from amount + flag state.
  // Flagged expenses ALWAYS route to PENDING_OWNER regardless of amount.
  const status = determineApprovalStatus(Number(data.amount), isFlagged);

  // ── Debug log (temp) ────────────────────────────────────────────────────
  console.log({
    attendance,
    gps,
    receipt,
    is_flagged: isFlagged,
    finalStatus: status,
  });

  // ── All layers passed — persist expense ───────────────────────────────────
  await expenseService.createExpense({
    ...data,
    staffId: user.sub,   // always from JWT
    status,
    isFlagged,
    flagReason,
  });

  return NextResponse.json({ success: true, status, is_flagged: isFlagged }, { status: 201 });
});

// ---------------------------------------------------------------------------
// GET /api/expenses/staff
//
// Returns all expenses submitted by the currently authenticated staff member.
// ---------------------------------------------------------------------------

export const GET = withAuth(async (_req: NextRequest, user) => {
  const expenses = await expenseService.getMyExpenses(user.sub);
  return NextResponse.json({ success: true, expenses: serializePrisma(expenses) });
});
