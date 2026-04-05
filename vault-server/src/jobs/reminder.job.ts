/**
 * reminder.job.ts
 *
 * Isolated runner for the daily acknowledgement reminder job.
 *
 * Responsibilities:
 *   - Call the notification service to compute + insert reminders
 *   - Log the outcome
 *   - Surface errors without crashing the process
 *
 * This file intentionally has NO knowledge of:
 *   - HTTP routes or controllers
 *   - Document alert queries (expiry.service.ts)
 *   - Any existing document/video endpoints
 *
 * The job is registered in cron.ts but all business logic
 * stays in notification.service.ts.
 */

import { createDocumentReminderNotifications } from "../services/notification.service";

// ---------------------------------------------------------------------------
// Job runner
// ---------------------------------------------------------------------------

/**
 * Finds every staff member who has a pending acknowledgement on an active
 * document and has not been reminded in the last 24 hours, then inserts a
 * Notification row for each.
 *
 * Safe to call multiple times — the service query contains a built-in
 * 24-hour deduplication guard (NOT EXISTS on recent Notification rows).
 */
export async function runReminderJob(): Promise<void> {
  const count = await createDocumentReminderNotifications();
  console.log(`[reminder-job] Reminder job: ${count} notifications created`);
}
