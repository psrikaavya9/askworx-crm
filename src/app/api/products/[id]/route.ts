import { NextRequest, NextResponse } from "next/server";
import * as productService from "@/modules/inventory/services/product.service";
import { updateProductSchema } from "@/modules/inventory/schemas/product.schema";
import { ZodError } from "zod";
import { serializePrisma } from "@/lib/serialize";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const product = await productService.getProductById(id);
    return NextResponse.json(serializePrisma(product));
  } catch (err) {
    if (err instanceof Error && err.message.includes("not found"))
      return NextResponse.json({ error: err.message }, { status: 404 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const data = updateProductSchema.parse(body);
    const product = await productService.updateProduct(id, data);
    return NextResponse.json(serializePrisma(product));
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    if (err instanceof Error && err.message.includes("not found"))
      return NextResponse.json({ error: err.message }, { status: 404 });
    if (err instanceof Error)
      return NextResponse.json({ error: err.message }, { status: 409 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await productService.deleteProduct(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof Error && err.message.includes("not found"))
      return NextResponse.json({ error: err.message }, { status: 404 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
