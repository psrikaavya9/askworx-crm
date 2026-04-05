/**
 * Thin SendGrid client wrapper.
 *
 * The client is initialised lazily on first use so that the module can be
 * imported in edge/serverless contexts without blowing up at build time if
 * SENDGRID_API_KEY is not yet set.
 *
 * Usage:
 *   import { sendEmail } from "@/lib/sendgrid";
 *   await sendEmail({ to, subject, text, html });
 */
import sgMail from "@sendgrid/mail";

let initialised = false;

function init() {
  if (initialised) return;
  const key = process.env.SENDGRID_API_KEY;
  if (!key) throw new Error("SENDGRID_API_KEY is not set in environment variables");
  sgMail.setApiKey(key);
  initialised = true;
}

export interface SendEmailOptions {
  to:       string;
  subject:  string;
  /** Plain-text body — always required (used as fallback for email clients that don't render HTML) */
  text:     string;
  /** Optional HTML body */
  html?:    string;
}

/**
 * Sends a transactional email via SendGrid.
 * Throws if SENDGRID_API_KEY or SENDGRID_FROM_EMAIL are missing.
 */
export async function sendEmail(opts: SendEmailOptions): Promise<void> {
  init();

  const from = process.env.SENDGRID_FROM_EMAIL;
  if (!from) throw new Error("SENDGRID_FROM_EMAIL is not set in environment variables");

  await sgMail.send({
    to:      opts.to,
    from,
    subject: opts.subject,
    text:    opts.text,
    html:    opts.html ?? `<p>${opts.text.replace(/\n/g, "<br>")}</p>`,
  });
}
