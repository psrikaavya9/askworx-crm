/**
 * POST /api/whatsapp/send
 *
 * Sends a real WhatsApp message via Twilio and logs the outbound WHATSAPP
 * interaction to CustomerInteraction so it appears in the Customer 360 timeline.
 *
 * Body:
 *   {
 *     clientId : string  — Customer 360 client record id
 *     phone    : string  — recipient phone in E.164 format (+919876543210)
 *     message  : string  — message body
 *   }
 *
 * Auth: any STAFF member or above.
 * The interaction is auto-approved (outbound messages are confirmed system records).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withRole } from "@/lib/middleware/roleCheck";
import { sendWhatsApp } from "@/lib/twilio";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const bodySchema = z.object({
  clientId: z.string().min(1, "clientId is required"),
  phone: z
    .string()
    .min(7, "phone is required")
    .regex(/^\+[1-9]\d{6,14}$/, "phone must be in E.164 format, e.g. +919876543210"),
  message: z.string().min(1, "message is required"),
});

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export const POST = withRole("STAFF", async (req: NextRequest, user) => {
  // ── 1. Parse + validate ────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { clientId, phone, message } = parsed.data;

  // ── 2. Verify client exists ────────────────────────────────────────────────
  const client = await prisma.client.findUnique({
    where:  { id: clientId },
    select: { id: true },
  });
  if (!client) {
    return NextResponse.json({ success: false, error: "Client not found" }, { status: 404 });
  }

  // ── 3. Send via Twilio ─────────────────────────────────────────────────────
  let twilioSid: string;
  try {
    twilioSid = await sendWhatsApp({ to: phone, body: message });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Twilio error";
    return NextResponse.json(
      { success: false, error: `Failed to send WhatsApp: ${msg}` },
      { status: 502 },
    );
  }

  // ── 4. Log interaction — auto-approved (confirmed sent message) ────────────
  const interaction = await prisma.customerInteraction.create({
    data: {
      clientId,
      staffId:           user.sub,
      type:              "WHATSAPP",
      date:              new Date(),
      direction:         "OUTBOUND",
      messageContent:    message,
      counterpartyPhone: phone,
      outcome:           "WhatsApp sent",
      externalId:        twilioSid,   // store Twilio SID for deduplication
      approved:          true,
      rejected:          false,
    },
  });

  return NextResponse.json(
    {
      success:       true,
      interactionId: interaction.id,
      twilioSid,
      message:       `WhatsApp sent to ${phone} and logged to timeline`,
    },
    { status: 200 },
  );
});
