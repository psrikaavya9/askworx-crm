import crypto from "crypto";

const QR_SECRET = process.env.QR_SECRET ?? "askworx-qr-default-secret";
export const OFFICE_ID = process.env.OFFICE_ID ?? "ASKWORX_HQ";

/** Returns today's date string in UTC: "YYYY-MM-DD" */
export function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Core token functions (used internally + re-exported with canonical names)
// ---------------------------------------------------------------------------

/** Deterministic daily token — changes every calendar day (UTC). */
export function generateDailyToken(date: string): string {
  return crypto.createHmac("sha256", QR_SECRET).update(date).digest("hex").slice(0, 32);
}

/**
 * Generate today's QR token for a given office ID.
 * Token = HMAC-SHA256(QR_SECRET, officeId + ":" + YYYY-MM-DD).slice(0,32)
 * Changes every calendar day (UTC). Never stored in DB.
 */
export function generateTodayQRToken(officeId: string): string {
  const date = getTodayDateString();
  return crypto
    .createHmac("sha256", QR_SECRET)
    .update(`${officeId}:${date}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Validate a scanned token against today's expected token for the given office.
 * Returns true only when the token matches today's value exactly.
 */
export function validateQRToken(token: string, officeId: string): boolean {
  const expected = generateTodayQRToken(officeId);
  // Constant-time comparison via HMAC to prevent timing attacks
  const expectedBuf = Buffer.from(expected, "hex");
  const tokenBuf    = Buffer.from(token.padEnd(expected.length, "\0").slice(0, expected.length), "hex");
  try {
    return crypto.timingSafeEqual(expectedBuf, tokenBuf) && token === expected;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// QR content helpers (encode/decode full "OFFICE_ID:TOKEN" payload)
// ---------------------------------------------------------------------------

/** QR content encoded into the code: "OFFICE_ID:TOKEN" */
export function buildQRContent(officeId: string = OFFICE_ID): string {
  const token = generateTodayQRToken(officeId);
  return `${officeId}:${token}`;
}

/** Parse and validate a scanned QR string against today's expected token. */
export function validateQRContent(content: string): { valid: boolean; token: string | null } {
  const colonIdx = content.indexOf(":");
  if (colonIdx === -1) return { valid: false, token: null };
  const officeId    = content.slice(0, colonIdx);
  const scannedToken = content.slice(colonIdx + 1);
  if (!validateQRToken(scannedToken, officeId)) return { valid: false, token: null };
  return { valid: true, token: scannedToken };
}
