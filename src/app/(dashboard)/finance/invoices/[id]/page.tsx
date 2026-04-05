import { notFound } from "next/navigation";
import { findInvoiceById } from "@/modules/finance/repositories/invoice.repository";
import { serializePrisma } from "@/lib/serialize";
import { InvoiceDetailClient } from "@/components/finance/InvoiceDetailClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function InvoiceDetailPage({ params }: PageProps) {
  const { id } = await params;
  const invoice = await findInvoiceById(id);

  if (!invoice) notFound();

  return (
    <div className="mx-auto max-w-7xl p-6">
      <InvoiceDetailClient invoice={serializePrisma(invoice) as never} />
    </div>
  );
}
