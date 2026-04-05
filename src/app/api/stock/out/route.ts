import { NextRequest, NextResponse } from "next/server";
import * as stockService from "@/modules/inventory/services/stock.service";
import { removeStockSchema } from "@/modules/inventory/schemas/stock.schema";
import { ZodError } from "zod";
import { serializePrisma } from "@/lib/serialize";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = removeStockSchema.parse(body);
    const result = await stockService.removeStock(data);
    return NextResponse.json(serializePrisma(result), { status: 201 });
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    if (err instanceof Error)
      return NextResponse.json({ error: err.message }, { status: 400 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
