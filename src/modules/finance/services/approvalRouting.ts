/**
 * approvalRouting.ts — Layer 4: Approval Routing
 *
 * Determines the correct approval status for an expense after all validation
 * layers have passed.  This is a pure function — no DB writes, no side
 * effects — so it is easy to test and reason about in isolation.
 *
 * Routing rules
 * ─────────────────────────────────────────────────────────────────────────────
 *  Flagged (any amount)  → PENDING_OWNER
 *    A flag means manual review is required regardless of amount.
 *
 *  Amount < ₹500         → APPROVED  (auto-approved, no review needed)
 *  Amount ₹500 – ₹2000   → PENDING_ACCOUNTS
 *  Amount > ₹2000        → PENDING_OWNER
 *    (Pre-approval for ≥ ₹5000 was already verified in Layer 3.)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { ExpenseStatus } from "@/generated/prisma/client";

// Amount tier boundaries (₹) — mirrors Layer 3 thresholds for consistency
const TIER_AUTO_APPROVE  =  500;   // < 500    → auto-approved
const TIER_ACCOUNTS      = 2000;   // 500–2000 → accounts team
// > 2000 → owner

/**
 * Determine the initial approval status for a validated expense.
 *
 * @param amount     The expense amount as a plain JS number (Decimal already
 *                   converted by the caller).
 * @param isFlagged  True when Layer 2 (GPS) or Layer 3 (receipt) set a flag.
 *
 * @returns One of:
 *   - `APPROVED`         — auto-approved, no further action needed
 *   - `PENDING_ACCOUNTS` — routed to accounts team
 *   - `PENDING_OWNER`    — routed to owner for manual review
 */
export function determineApprovalStatus(
  amount:    number,
  isFlagged: boolean,
): ExpenseStatus {
  // Flagged expenses always go to the owner regardless of amount
  if (isFlagged) return "PENDING_OWNER";

  if (amount < TIER_AUTO_APPROVE) return "APPROVED";
  if (amount <= TIER_ACCOUNTS)    return "PENDING_ACCOUNTS";
  return "PENDING_OWNER";
}
