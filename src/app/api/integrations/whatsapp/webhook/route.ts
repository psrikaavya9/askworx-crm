/**
 * POST /api/integrations/whatsapp/webhook
 *
 * Receives Twilio WhatsApp message webhooks.
 * Twilio sends application/x-www-form-urlencoded POST requests.
 *
 * Security:
 *   Every request is authenticated with Twilio's HMAC-SHA1 signature
 *   (X-Twilio-Signature header).  Requests without a valid signature
 *   are rejected with 403.
 *
 * Required environment variables:
 *   TWILIO_AUTH_TOKEN       — from Twilio console
 *   TWILIO_PHONE            — your WhatsApp-enabled Twilio number, e.g. "+15005550006"
 *   TWILIO_DEFAULT_STAFF_ID — fallback Staff.id when the Twilio number
 *                             doesn't match any staff member's phone
 *
 * Twilio webhook URL to configure in console:
 *   https://yourdomain.com/api/integrations/whatsapp/webhook
 *
 * Idempotent — duplicate MessageSid events are silently ignored.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  validateTwilioSignature,
  processWhatsAppMessage,
  type TwilioWhatsAppPayload,
} from "@/modules/integrations/services/whatsapp-webhook.service";

export async function POST(req: NextRequest) {
  // ── Parse form body ───────────────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected application/x-www-form-urlencoded" }, { status: 400 });
  }

  const params: Record<string, string> = {};
  formData.forEach((value, key) => {
    if (typeof value === "string") params[key] = value;
  });

  // ── Validate Twilio signature ─────────────────────────────────────────────
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    console.error("[whatsapp-webhook] TWILIO_AUTH_TOKEN is not set — rejecting all requests");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const signature = req.headers.get("x-twilio-signature") ?? "";
  // Reconstruct the full URL Twilio signed (must match exactly what Twilio sees)
  const url = `${req.nextUrl.protocol}//${req.nextUrl.host}${req.nextUrl.pathname}`;

  if (!validateTwilioSignature(authToken, url, params, signature)) {
    return NextResponse.json({ error: "Invalid Twilio signature" }, { status: 403 });
  }

  // ── Basic field validation ────────────────────────────────────────────────
  const { MessageSid, AccountSid, From, To, Body } = params;
  if (!MessageSid || !AccountSid || !From || !To) {
    return NextResponse.json({ error: "Missing required Twilio fields" }, { status: 400 });
  }

  // ── Process ───────────────────────────────────────────────────────────────
  try {
    const result = await processWhatsAppMessage({
      MessageSid,
      AccountSid,
      From,
      To,
      Body:         Body ?? "",
      NumMedia:     params.NumMedia,
      ProfileName:  params.ProfileName,
    } as TwilioWhatsAppPayload);

    if (result.status === "duplicate") {
      return NextResponse.json(result);
    }

    if (result.status === "unmatched" || result.status === "no_staff") {
      console.warn(`[whatsapp-webhook] ${result.status}: ${result.message}`);
      return NextResponse.json(result);
    }

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error("[whatsapp-webhook] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
