import { NextRequest, NextResponse } from "next/server";
import * as paymentService from "@/modules/finance/services/payment.service";
import { recordPaymentSchema, paymentFiltersSchema } from "@/modules/finance/schemas/payment.schema";
import { ZodError } from "zod";
import { serializePrisma } from "@/lib/serialize";

export async function GET(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const filters = paymentFiltersSchema.parse(params);
    const result = await paymentService.getPayments(filters);
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
    const data = recordPaymentSchema.parse(body);
    const payment = await paymentService.recordPayment(data);
    return NextResponse.json(serializePrisma(payment), { status: 201 });
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    if (err instanceof Error)
      return NextResponse.json({ error: err.message }, { status: 400 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
