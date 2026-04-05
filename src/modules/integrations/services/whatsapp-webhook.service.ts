/**
 * whatsapp-webhook.service.ts
 *
 * Processes inbound Twilio WhatsApp webhooks.
 *
 * Twilio sends application/x-www-form-urlencoded POSTs when a WhatsApp message
 * is sent or received on your Twilio number.
 *
 * Direction:
 *   - INBOUND:  From = customer's WhatsApp → To = our Twilio number
 *   - OUTBOUND: From = our Twilio number  → To = customer's WhatsApp
 *     (only emitted when Twilio status callbacks are enabled)
 *
 * Environment variables required:
 *   TWILIO_AUTH_TOKEN       — used to validate webhook signatures
 *   TWILIO_PHONE            — your Twilio WhatsApp number, e.g. "+15005550006"
 *   TWILIO_DEFAULT_STAFF_ID — fallback staff ID when no rep matches the number
 *
 * On success, creates:
 *   1. CustomerInteraction (type=WHATSAPP, auto-approved)
 *   2. LeadActivity (type=NOTE_ADDED) if the phone maps to a lead
 */

import { createHmac } from "crypto";
import { prisma } from "@/lib/prisma";
import {
  matchByPhone,
  findStaffByPhone,
  findFallbackStaff,
} from "./contact-matcher.service";
import { createWebhookInteraction } from "@/modules/customer360/repositories/interaction.repository";

// ---------------------------------------------------------------------------
// Twilio payload (form-encoded keys)
// ---------------------------------------------------------------------------

export interface TwilioWhatsAppPayload {
  MessageSid:   string;
  AccountSid:   string;
  /** "whatsapp:+1234567890" */
  From:         string;
  /** "whatsapp:+0987654321" */
  To:           string;
  Body:         string;
  NumMedia?:    string;
  ProfileName?: string;
}

// ---------------------------------------------------------------------------
// Twilio signature validation (HMAC-SHA1)
// https://www.twilio.com/docs/usage/webhooks/webhooks-security
// ---------------------------------------------------------------------------

export function validateTwilioSignature(
  authToken:  string,
  url:        string,
  params:     Record<string, string>,
  signature:  string,
): boolean {
  // Append sorted POST params to the URL
  const paramStr = Object.keys(params)
    .sort()
    .reduce((acc, k) => acc + k + params[k], url);

  const expected = createHmac("sha1", authToken)
    .update(paramStr)
    .digest("base64");

  // Constant-time comparison to prevent timing attacks
  if (expected.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export type WhatsAppWebhookResult =
  | { status: "logged";     interactionId: string }
  | { status: "lead_only";  leadId: string | null; message: string }
  | { status: "duplicate";  interactionId: string }
  | { status: "unmatched";  message: string; customerPhone: string }
  | { status: "no_staff";   message: string };

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function processWhatsAppMessage(
  payload: TwilioWhatsAppPayload,
): Promise<WhatsAppWebhookResult> {
  // ── 1. Deduplication ──────────────────────────────────────────────────────
  const existing = await prisma.customerInteraction.findFirst({
    where:  { externalId: payload.MessageSid },
    select: { id: true },
  });
  if (existing) return { status: "duplicate", interactionId: existing.id };

  // ── 2. Direction ──────────────────────────────────────────────────────────
  const ourPhone       = (process.env.TWILIO_PHONE ?? "").replace(/^whatsapp:/i, "").trim();
  const fromClean      = payload.From.replace(/^whatsapp:/i, "").trim();
  const toClean        = payload.To.replace(/^whatsapp:/i, "").trim();

  let direction:     "INBOUND" | "OUTBOUND";
  let customerPhone: string;
  let repPhone:      string;

  if (fromClean === ourPhone) {
    direction     = "OUTBOUND";
    customerPhone = toClean;
    repPhone      = fromClean;
  } else {
    direction     = "INBOUND";
    customerPhone = fromClean;
    repPhone      = toClean;
  }

  // ── 3. Staff resolution ───────────────────────────────────────────────────
  let staffId: string | null = await findStaffByPhone(repPhone);
  if (!staffId) {
    staffId =
      process.env.TWILIO_DEFAULT_STAFF_ID?.trim() ||
      (await findFallbackStaff());
  }
  if (!staffId) {
    return {
      status:  "no_staff",
      message: "Could not resolve a staff member. Set TWILIO_DEFAULT_STAFF_ID.",
    };
  }

  // ── 4. Contact lookup ─────────────────────────────────────────────────────
  const match = await matchByPhone(customerPhone);

  if (!match.clientId && !match.leadId) {
    return {
      status: "unmatched",
      message: `No client or lead found for phone: ${customerPhone}`,
      customerPhone,
    };
  }

  // ── 5. Lead-only path ────────────────────────────────────────────────────
  if (!match.clientId && match.leadId) {
    const preview = payload.Body.slice(0, 200);
    await prisma.$transaction([
      prisma.leadActivity.create({
        data: {
          leadId:      match.leadId,
          type:        "NOTE_ADDED",
          description: `WhatsApp ${direction.toLowerCase()}: ${preview}`,
          metadata:    {
            direction,
            from:       payload.From,
            to:         payload.To,
            messageSid: payload.MessageSid,
          },
          performedBy: staffId,
        },
      }),
      prisma.lead.update({
        where: { id: match.leadId },
        data:  { lastActivityAt: new Date() },
      }),
    ]);
    return {
      status:  "lead_only",
      leadId:  match.leadId,
      message: "WhatsApp logged as lead activity. Lead has no linked client yet.",
    };
  }

  // ── 6. Create CustomerInteraction ─────────────────────────────────────────
  const interaction = await createWebhookInteraction(
    {
      clientId:          match.clientId!,
      type:              "WHATSAPP",
      date:              new Date(),
      messageContent:    payload.Body.slice(0, 5000),
      direction,
      externalId:        payload.MessageSid,
      counterpartyPhone: customerPhone,
    },
    staffId,
  );

  // ── 7. Lead activity ──────────────────────────────────────────────────────
  if (match.leadId) {
    const preview = payload.Body.slice(0, 200);
    await prisma.$transaction([
      prisma.leadActivity.create({
        data: {
          leadId:      match.leadId,
          type:        "NOTE_ADDED",
          description: `WhatsApp ${direction.toLowerCase()}: ${preview}`,
          metadata:    {
            direction,
            from:          payload.From,
            to:            payload.To,
            messageSid:    payload.MessageSid,
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
  }

  return { status: "logged", interactionId: interaction.id };
}
