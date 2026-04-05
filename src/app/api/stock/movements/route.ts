import { NextRequest, NextResponse } from "next/server";
import * as stockService from "@/modules/inventory/services/stock.service";
import { movementFiltersSchema } from "@/modules/inventory/schemas/stock.schema";
import { ZodError } from "zod";
import { serializePrisma } from "@/lib/serialize";

export async function GET(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const filters = movementFiltersSchema.parse(params);
    const result = await stockService.getStockMovements(filters);
    return NextResponse.json(serializePrisma(result));
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
