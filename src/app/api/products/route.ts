import { NextRequest, NextResponse } from "next/server";
import * as productService from "@/modules/inventory/services/product.service";
import { createProductSchema, productFiltersSchema } from "@/modules/inventory/schemas/product.schema";
import { ZodError } from "zod";
import { serializePrisma } from "@/lib/serialize";

export async function GET(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const filters = productFiltersSchema.parse(params);
    const result = await productService.getProducts(filters);
    return NextResponse.json(serializePrisma(result));
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = createProductSchema.parse(body);
    const product = await productService.createProduct(data);
    return NextResponse.json(serializePrisma(product), { status: 201 });
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    if (err instanceof Error && err.message.includes("already exists"))
      return NextResponse.json({ error: err.message }, { status: 409 });
    if (err instanceof Error)
      return NextResponse.json({ error: err.message }, { status: 422 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
