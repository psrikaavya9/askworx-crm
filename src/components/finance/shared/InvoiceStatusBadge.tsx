import { Badge } from "@/components/ui/Badge";
import type { InvoiceStatus } from "@/modules/finance/types";
import { INVOICE_STATUS_LABELS } from "@/modules/finance/types";

const variantMap: Record<InvoiceStatus, "gray" | "blue" | "green" | "red" | "yellow"> = {
  DRAFT: "gray",
  SENT: "blue",
  PAID: "green",
  OVERDUE: "red",
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <Badge variant={variantMap[status]}>{INVOICE_STATUS_LABELS[status]}</Badge>;
}
