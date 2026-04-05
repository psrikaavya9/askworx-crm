/**
 * email-webhook.service.ts
 *
 * Processes inbound email webhooks (Postmark-compatible format).
 * Works with the BCC logging method:
 *   - Staff member BCCs `{staffId}@crm.yourdomain.com` when emailing a client
 *   - Email service routes it to POST /api/integrations/email/webhook
 *
 * Direction logic:
 *   - OUTBOUND: From = staff member → To = client (normal BCC scenario)
 *   - INBOUND:  From = client → To = staff member (client replied to rep)
 *
 * On success, creates:
 *   1. CustomerInteraction (type=EMAIL, auto-approved)
 *   2. LeadActivity (type=EMAIL_SENT) if the email maps to a lead → triggers rescoring
 */

import { prisma } from "@/lib/prisma";
import {
  matchByEmail,
  findStaffByEmail,
  findFallbackStaff,
} from "./contact-matcher.service";
import { createWebhookInteraction } from "@/modules/customer360/repositories/interaction.repository";
import { scheduleScore } from "@/modules/crm/services/scoring.service";

// ---------------------------------------------------------------------------
// Payload — Postmark-compatible inbound email format
// (Mailgun: map `sender`→From, `recipient`→To, `subject`→Subject, `body-plain`→TextBody)
// (SendGrid: map `from`→From, `to`→To, `subject`→Subject, `text`→TextBody)
// ---------------------------------------------------------------------------

export interface InboundEmailPayload {
  /** Globally unique message ID, e.g. "<unique-id@mail.example.com>" */
  MessageID:  string;
  /** "Name <email>" or plain "email" */
  From:       string;
  /** "Name <email>" or plain "email" */
  To:         string;
  Subject:    string;
  TextBody:   string;
  HtmlBody?:  string;
  /** ISO-8601 date string from the email headers */
  Date?:      string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function extractEmail(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return (match ? match[1] : raw).trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export type EmailWebhookResult =
  | { status: "logged";      interactionId: string }
  | { status: "lead_only";   leadId: string | null; message: string }
  | { status: "duplicate";   interactionId: string }
  | { status: "unmatched";   message: string; fromEmail: string; toEmail: string }
  | { status: "no_staff";    message: string };

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function processInboundEmail(
  payload: InboundEmailPayload,
): Promise<EmailWebhookResult> {
  // ── 1. Deduplication ──────────────────────────────────────────────────────
  const existing = await prisma.customerInteraction.findFirst({
    where:  { externalId: payload.MessageID },
    select: { id: true },
  });
  if (existing) return { status: "duplicate", interactionId: existing.id };

  const fromEmail   = extractEmail(payload.From);
  const toEmail     = extractEmail(payload.To);
  const date        = payload.Date ? new Date(payload.Date) : new Date();
  const messageText = (payload.TextBody ?? "").slice(0, 5000);

  // ── 2. Direction + client email resolution ────────────────────────────────
  //
  // If the From address belongs to a staff member → OUTBOUND (rep emailed client)
  // Otherwise assume INBOUND (client emailed rep)

  let staffId:     string | null;
  let clientEmail: string;
  let direction:   "INBOUND" | "OUTBOUND";

  const staffFromSender = await findStaffByEmail(fromEmail);
  if (staffFromSender) {
    direction    = "OUTBOUND";
    clientEmail  = toEmail;
    staffId      = staffFromSender;
  } else {
    direction   = "INBOUND";
    clientEmail = fromEmail;
    staffId     = await findStaffByEmail(toEmail);
  }

  // ── 3. Contact lookup ─────────────────────────────────────────────────────
  const match = await matchByEmail(clientEmail);

  // ── 4. Staff fallback ─────────────────────────────────────────────────────
  if (!staffId) {
    staffId = match.staffId ?? await findFallbackStaff();
  }
  if (!staffId) {
    return {
      status:  "no_staff",
      message: "Could not resolve a staff member for this email. Set WEBHOOK_FALLBACK_STAFF_ID.",
    };
  }

  // ── 5. Unmatched contact ──────────────────────────────────────────────────
  if (!match.clientId && !match.leadId) {
    return { status: "unmatched", message: `No client or lead for: ${clientEmail}`, fromEmail, toEmail };
  }

  // ── 6. Lead-only path (lead not yet converted to client) ──────────────────
  if (!match.clientId && match.leadId) {
    await prisma.$transaction([
      prisma.leadActivity.create({
        data: {
          leadId:      match.leadId,
          type:        "EMAIL_SENT",
          description: payload.Subject
            ? `Email: ${payload.Subject.slice(0, 200)}`
            : "Email exchanged",
          metadata:    { direction, from: fromEmail, to: toEmail, messageId: payload.MessageID },
          performedBy: staffId,
        },
      }),
      prisma.lead.update({
        where: { id: match.leadId },
        data:  { lastActivityAt: new Date() },
      }),
    ]);
    scheduleScore(match.leadId);
    return {
      status:  "lead_only",
      leadId:  match.leadId,
      message: "Email logged as lead activity. Lead has no linked client yet.",
    };
  }

  // ── 7. Create CustomerInteraction ─────────────────────────────────────────
  const interaction = await createWebhookInteraction(
    {
      clientId:          match.clientId!,
      type:              "EMAIL",
      date,
      messageContent:    messageText,
      messageSubject:    payload.Subject?.slice(0, 500) ?? null,
      direction,
      externalId:        payload.MessageID,
      counterpartyEmail: clientEmail,
    },
    staffId,
  );

  // ── 8. Lead activity + rescore ────────────────────────────────────────────
  if (match.leadId) {
    await prisma.$transaction([
      prisma.leadActivity.create({
        data: {
          leadId:      match.leadId,
          type:        "EMAIL_SENT",
          description: payload.Subject
            ? `Email: ${payload.Subject.slice(0, 200)}`
            : "Email exchanged",
          metadata:    {
            direction,
            from:          fromEmail,
            to:            toEmail,
            messageId:     payload.MessageID,
            interactionId: interaction.id,
          },
          performedBy: staffId,
        },
      }),
      prisma.lead.update({
        where: { id: match.leadId },
        data:  { lastActivityAt: new Date() },
      }),
    ]);
    scheduleScore(match.leadId);
  }

  return { status: "logged", interactionId: interaction.id };
}
