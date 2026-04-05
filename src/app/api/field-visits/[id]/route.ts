import { NextRequest, NextResponse } from "next/server";
import * as svc from "@/modules/staff/services/fieldvisit.service";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const visit = await svc.getFieldVisit(id);
    return NextResponse.json(visit);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 404 });
  }
}
