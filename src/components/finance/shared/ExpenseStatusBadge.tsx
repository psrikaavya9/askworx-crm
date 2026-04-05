import { Badge } from "@/components/ui/Badge";
import type { ExpenseStatus } from "@/modules/finance/types";
import { EXPENSE_STATUS_LABELS } from "@/modules/finance/types";

const variantMap: Record<ExpenseStatus, "gray" | "green" | "red" | "yellow"> = {
  PENDING:          "yellow",
  DRAFT:            "gray",
  VALIDATING:       "gray",
  AUTO_REJECTED:    "red",
  PENDING_ACCOUNTS: "yellow",
  PENDING_OWNER:    "yellow",
  APPROVED:         "green",
  REJECTED:         "red",
  REIMBURSED:       "green",
};

export function ExpenseStatusBadge({ status }: { status: ExpenseStatus }) {
  return <Badge variant={variantMap[status]}>{EXPENSE_STATUS_LABELS[status]}</Badge>;
}
