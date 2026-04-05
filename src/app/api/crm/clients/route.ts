import { NextRequest, NextResponse } from "next/server";
import * as clientService from "@/modules/crm/services/client.service";
import { createClientSchema, clientFiltersSchema } from "@/modules/crm/schemas/client.schema";
import { ZodError } from "zod";
import { serializePrisma } from "@/lib/serialize";

export async function GET(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const filters = clientFiltersSchema.parse(params);
    const result = await clientService.getClients(filters);
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
    const data = createClientSchema.parse(body);
    const client = await clientService.createClient(data);
    return NextResponse.json(serializePrisma(client), { status: 201 });
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    if (err instanceof Error)
      return NextResponse.json({ error: err.message }, { status: 409 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
