/**
 * POST /api/email/send
 *
 * Sends a real email via SendGrid and logs the outbound EMAIL interaction
 * to the CustomerInteraction table so it appears in the Customer 360 timeline.
 *
 * Body:
 *   {
 *     clientId : string   — Customer 360 client record id
 *     to       : string   — recipient email address
 *     subject  : string
 *     message  : string   — plain-text body (also used as HTML fallback)
 *   }
 *
 * Auth: any STAFF member or above.
 * The interaction is auto-approved (outbound emails are factual system records).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withRole } from "@/lib/middleware/roleCheck";
import { sendEmail } from "@/lib/sendgrid";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const bodySchema = z.object({
  clientId: z.string().min(1, "clientId is required"),
  to:       z.string().email("to must be a valid email address"),
  subject:  z.string().min(1, "subject is required"),
  message:  z.string().min(1, "message is required"),
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

  const { clientId, to, subject, message } = parsed.data;

  // ── 2. Verify client exists ────────────────────────────────────────────────
  const client = await prisma.client.findUnique({
    where:  { id: clientId },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!client) {
    return NextResponse.json({ success: false, error: "Client not found" }, { status: 404 });
  }

  // ── 3. Send email via SendGrid ─────────────────────────────────────────────
  try {
    await sendEmail({ to, subject, text: message });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "SendGrid error";
    return NextResponse.json(
      { success: false, error: `Failed to send email: ${msg}` },
      { status: 502 },
    );
  }

  // ── 4. Log the interaction — auto-approved (it's a confirmed sent email) ───
  const interaction = await prisma.customerInteraction.create({
    data: {
      clientId,
      staffId:           user.sub,
      type:              "EMAIL",
      date:              new Date(),
      direction:         "OUTBOUND",
      messageSubject:    subject,
      messageContent:    message,
      counterpartyEmail: to,
      outcome:           "Email sent",
      // Auto-approved — the email was actually delivered, no review needed
      approved:  true,
      rejected:  false,
    },
  });

  return NextResponse.json(
    {
      success:       true,
      interactionId: interaction.id,
      message:       `Email sent to ${to} and logged to timeline`,
    },
    { status: 200 },
  );
});
