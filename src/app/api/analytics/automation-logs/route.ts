import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export interface AutomationLogEntry {
  id: string;
  action: string;
  leadId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

/**
 * GET /api/analytics/automation-logs
 *
 * Returns the last 50 automation rule events from the AuditLog table.
 * Filtered to entityType = "automation_rule".
 */
export async function GET() {
  const logs = await prisma.auditLog.findMany({
    where: { entityType: "automation_rule" },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      action: true,
      entityId: true,
      metadata: true,
      createdAt: true,
    },
  });

  const data: AutomationLogEntry[] = logs.map((log) => ({
    id: log.id,
    action: log.action,
    leadId: log.entityId,
    metadata: (log.metadata as Record<string, unknown>) ?? {},
    createdAt: log.createdAt.toISOString(),
  }));

  return NextResponse.json(data);
}
