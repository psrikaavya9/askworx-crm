import { prisma } from "@/lib/prisma";

/**
 * Fire-and-forget audit logger.
 *
 * NEVER awaited in the calling code — errors are swallowed and printed to
 * stderr so that a logging failure can never crash or slow down the main flow.
 *
 * @param userId     The staffId performing the action (null for anonymous/system events)
 * @param action     Upper-snake-case event name, e.g. "INVOICE_CREATED"
 * @param entityType The domain entity, e.g. "invoice", "expense", "auth"
 * @param entityId   The affected record's id (omit for events with no single target)
 * @param metadata   Any extra context that aids investigation (amounts, IPs, etc.)
 */
export function logAudit(
  userId:     string | null,
  action:     string,
  entityType: string,
  entityId?:  string | null,
  metadata?:  Record<string, unknown>,
): void {
  // Wrap in try/catch so a missing/stale Prisma model never throws into the caller.
  // The async rejection is also caught so this is truly fire-and-forget.
  try {
    prisma.auditLog
      .create({
        data: {
          userId,
          action,
          entityType,
          entityId:  entityId  ?? undefined,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          metadata:  (metadata as any) ?? undefined,
        },
      })
      .catch((err) => console.error("[audit] Failed to write log:", err instanceof Error ? err.message : err));
  } catch (err) {
    console.error("[audit] Sync error writing audit log:", err instanceof Error ? err.message : err);
  }
}
