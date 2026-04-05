import cron from "node-cron";
import { runExpiryJob }   from "./services/expiry.service";
import { runReminderJob } from "./jobs/reminder.job";
import { runCrmColdLeadJob } from "./jobs/crm-cold-lead.job";

/**
 * Schedules vault cron jobs and runs an initial pass on startup.
 */
export function startCronJobs(): void {
  // ── Job 1: Document expiry ────────────────────────────────────────────────
  // Run immediately so warning levels are fresh after every restart
  runExpiryJob().catch((err) => {
    console.error("[cron] Startup expiry job failed:", err);
  });

  // Daily at 00:05 UTC — catch docs that crossed the threshold overnight
  cron.schedule(
    "5 0 * * *",
    () => {
      console.log("[cron] Running daily expiry job…");
      runExpiryJob().catch((err) => {
        console.error("[cron] Daily expiry job failed:", err);
      });
    },
    { timezone: "UTC" }
  );

  // ── Job 2: Acknowledgement reminders ─────────────────────────────────────
  // Daily at 09:00 UTC — notify staff who have pending acknowledgements.
  // Fully isolated in jobs/reminder.job.ts — zero coupling to document alerts.
  cron.schedule(
    "0 9 * * *",
    () => {
      runReminderJob().catch((err) => {
        console.error("[cron] Acknowledgement reminder job failed:", err);
      });
    },
    { timezone: "UTC" }
  );

  // ── Job 3: CRM cold-lead detection ───────────────────────────────────────
  // Daily at 09:00 UTC — detects inactive leads and creates COLD_ALERT reminders.
  // Calls the main Next.js app via its secured cron endpoint.
  cron.schedule(
    "0 9 * * *",
    () => {
      runCrmColdLeadJob().catch((err) => {
        console.error("[cron] CRM cold-lead job failed:", err);
      });
    },
    { timezone: "UTC" }
  );

  console.log(
    "[vault-server] ✓ Cron jobs scheduled" +
    " (expiry: daily 00:05 UTC | reminders: daily 09:00 UTC | crm-cold-leads: daily 09:00 UTC)"
  );
}
