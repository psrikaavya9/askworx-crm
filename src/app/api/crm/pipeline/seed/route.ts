/**
 * POST /api/crm/pipeline/seed
 *
 * Creates the three default pipeline templates (PRODUCT, SERVICE, AMC)
 * if they do not already exist. Safe to call multiple times — idempotent.
 *
 * Response: { created: string[], skipped: string[] }
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const TEMPLATES = [
  {
    name: "Product Sales",
    dealType: "PRODUCT",
    description: "Standard pipeline for one-time product deals",
    stages: [
      { name: "Inquiry",       order: 0, probability: 10,  color: "#6366f1", isWon: false, isLost: false },
      { name: "Demo",          order: 1, probability: 25,  color: "#8b5cf6", isWon: false, isLost: false },
      { name: "Proposal Sent", order: 2, probability: 50,  color: "#f59e0b", isWon: false, isLost: false },
      { name: "Negotiation",   order: 3, probability: 75,  color: "#f97316", isWon: false, isLost: false },
      { name: "Won",           order: 4, probability: 100, color: "#10b981", isWon: true,  isLost: false },
      { name: "Lost",          order: 5, probability: 0,   color: "#ef4444", isWon: false, isLost: true  },
    ],
  },
  {
    name: "Service Delivery",
    dealType: "SERVICE",
    description: "Pipeline for recurring or project-based service engagements",
    stages: [
      { name: "Inquiry",      order: 0, probability: 10,  color: "#6366f1", isWon: false, isLost: false },
      { name: "Consultation", order: 1, probability: 30,  color: "#8b5cf6", isWon: false, isLost: false },
      { name: "Scoping",      order: 2, probability: 50,  color: "#0ea5e9", isWon: false, isLost: false },
      { name: "Proposal",     order: 3, probability: 65,  color: "#f59e0b", isWon: false, isLost: false },
      { name: "Contracted",   order: 4, probability: 90,  color: "#f97316", isWon: false, isLost: false },
      { name: "Completed",    order: 5, probability: 100, color: "#10b981", isWon: true,  isLost: false },
      { name: "Lost",         order: 6, probability: 0,   color: "#ef4444", isWon: false, isLost: true  },
    ],
  },
  {
    name: "AMC / Maintenance",
    dealType: "AMC",
    description: "Annual maintenance contract pipeline with renewal tracking",
    stages: [
      { name: "Prospect",    order: 0, probability: 10,  color: "#6366f1", isWon: false, isLost: false },
      { name: "Site Survey", order: 1, probability: 30,  color: "#8b5cf6", isWon: false, isLost: false },
      { name: "Quotation",   order: 2, probability: 50,  color: "#f59e0b", isWon: false, isLost: false },
      { name: "Agreement",   order: 3, probability: 80,  color: "#f97316", isWon: false, isLost: false },
      { name: "Active",      order: 4, probability: 100, color: "#10b981", isWon: true,  isLost: false },
      { name: "Renewal Due", order: 5, probability: 70,  color: "#0ea5e9", isWon: false, isLost: false },
      { name: "Expired",     order: 6, probability: 0,   color: "#ef4444", isWon: false, isLost: true  },
    ],
  },
] as const;

export async function POST() {
  const created: string[] = [];
  const skipped: string[] = [];

  for (const tmpl of TEMPLATES) {
    const existing = await prisma.pipelineTemplate.findFirst({
      where: { dealType: tmpl.dealType },
    });

    if (existing) {
      skipped.push(tmpl.dealType);
      continue;
    }

    await prisma.pipelineTemplate.create({
      data: {
        name:        tmpl.name,
        dealType:    tmpl.dealType,
        description: tmpl.description,
        isActive:    true,
        stages: {
          create: tmpl.stages.map((s) => ({
            name:        s.name,
            order:       s.order,
            probability: s.probability,
            color:       s.color,
            isWon:       s.isWon,
            isLost:      s.isLost,
          })),
        },
      },
    });
    created.push(tmpl.dealType);
  }

  return NextResponse.json({ created, skipped });
}
