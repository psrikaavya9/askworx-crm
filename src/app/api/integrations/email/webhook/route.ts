/**
 * POST /api/integrations/email/webhook
 *
 * Receives inbound email events from your email service provider
 * (Postmark, Mailgun, SendGrid — all use similar JSON shapes).
 *
 * Security:
 *   Requests must include the shared secret:
 *     ?token=<WEBHOOK_EMAIL_SECRET>   (query param)
 *   OR
 *     X-Webhook-Token: <WEBHOOK_EMAIL_SECRET>  (header)
 *
 *   Set WEBHOOK_EMAIL_SECRET in your environment variables.
 *   Rotate it whenever you suspect it has been compromised.
 *
 * Idempotent — duplicate webhook deliveries (same MessageID) are silently
 * ignored and return 200 to prevent the provider from retrying.
 *
 * Example request body (Postmark):
 * {
 *   "MessageID": "<unique@mail.domain.com>",
 *   "From": "rep@yourcompany.com",
 *   "To": "client@customer.com",
 *   "Subject": "Follow-up on our meeting",
 *   "TextBody": "Hi Jane, just following up...",
 *   "Date": "2026-04-01T10:00:00Z"
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { processInboundEmail, type InboundEmailPayload } from "@/modules/integrations/services/email-webhook.service";

export async function POST(req: NextRequest) {
  // ── Authenticate ──────────────────────────────────────────────────────────
  const secret = process.env.WEBHOOK_EMAIL_SECRET;
  if (!secret) {
    console.error("[email-webhook] WEBHOOK_EMAIL_SECRET is not set — rejecting all requests");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const tokenFromQuery  = req.nextUrl.searchParams.get("token");
  const tokenFromHeader = req.headers.get("x-webhook-token");
  const provided        = tokenFromQuery ?? tokenFromHeader ?? "";

  if (provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Basic shape validation
  const payload = body as Record<string, unknown>;
  if (
    typeof payload.MessageID !== "string" || !payload.MessageID ||
    typeof payload.From      !== "string" || !payload.From      ||
    typeof payload.To        !== "string" || !payload.To
  ) {
    return NextResponse.json(
      { error: "Missing required fields: MessageID, From, To" },
      { status: 400 },
    );
  }

  // ── Process ───────────────────────────────────────────────────────────────
  try {
    const result = await processInboundEmail(payload as unknown as InboundEmailPayload);

    // Always return 200 for duplicates to stop provider retries
    if (result.status === "duplicate") {
      return NextResponse.json({ status: "duplicate", interactionId: result.interactionId });
    }

    // Unmatched or no-staff: return 200 (don't cause retries) but log a warning
    if (result.status === "unmatched" || result.status === "no_staff") {
      console.warn(`[email-webhook] ${result.status}: ${result.message}`);
      return NextResponse.json(result);
    }

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error("[email-webhook] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
