/**
 * Thin Twilio client wrapper for WhatsApp messaging.
 *
 * The client is initialised lazily on first use so that missing env vars
 * at build time don't cause a crash — they throw at call time instead.
 *
 * Usage:
 *   import { sendWhatsApp } from "@/lib/twilio";
 *   await sendWhatsApp({ to: "+919876543210", body: "Hello!" });
 */
import twilio from "twilio";

let client: ReturnType<typeof twilio> | null = null;

function getClient(): ReturnType<typeof twilio> {
  if (client) return client;

  const sid   = process.env.TWILIO_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;

  if (!sid)   throw new Error("TWILIO_SID is not set in environment variables");
  if (!token) throw new Error("TWILIO_AUTH_TOKEN is not set in environment variables");

  client = twilio(sid, token);
  return client;
}

export interface SendWhatsAppOptions {
  /** Recipient phone number in E.164 format, e.g. "+919876543210" */
  to:   string;
  body: string;
}

/**
 * Sends a WhatsApp message via Twilio.
 *
 * The sender number is read from TWILIO_WHATSAPP_FROM (must be a
 * Twilio WhatsApp-enabled number or the Sandbox number).
 * For the Sandbox: +14155238886
 *
 * Throws if env vars are missing or if Twilio returns an error.
 * Returns the Twilio message SID on success.
 */
export async function sendWhatsApp(opts: SendWhatsAppOptions): Promise<string> {
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!from) throw new Error("TWILIO_WHATSAPP_FROM is not set in environment variables");

  const msg = await getClient().messages.create({
    from: `whatsapp:${from}`,
    to:   `whatsapp:${opts.to}`,
    body: opts.body,
  });

  return msg.sid;
}
