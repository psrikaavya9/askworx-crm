"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn, formatCurrency } from "@/lib/utils";
import { StockStatusBadge } from "./StockStatusBadge";
import { getStockStatus } from "@/modules/inventory/types";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Package, AlertTriangle } from "lucide-react";
import type { Product } from "@/generated/prisma/client";

interface ProductsTableProps {
  data: Product[];
}

export function ProductsTable({ data }: ProductsTableProps) {
  const router = useRouter();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirmId) return;
    setDeleting(true);
    await fetch(`/api/products/${confirmId}`, { method: "DELETE" });
    setDeleting(false);
    setConfirmId(null);
    router.refresh();
  }

  if (data.length === 0) {
    return (
      <EmptyState
        icon={<Package className="h-6 w-6" />}
        title="No products found"
        description="Add your first product to get started."
        className="rounded-xl border border-slate-200 bg-white"
      />
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-md">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                Product
              </th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                SKU
              </th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                Category
              </th>
              <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                Stock
              </th>
              <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                Min Stock
              </th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                Unit
              </th>
              <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                Unit Price
              </th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                Status
              </th>
              <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.map((product) => {
              const status = getStockStatus(product);
              const isLow = status === "LOW_STOCK";
              return (
                <tr
                  key={product.id}
                  className={cn(
                    "group bg-white transition-colors",
                    isLow
                      ? "hover:bg-red-50/70"
                      : "hover:bg-gray-50"
                  )}
                >
                  <td className="px-5 py-4">
                    <Link
                      href={`/products/${product.id}`}
                      className="flex items-center gap-2 font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      {isLow && (
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                      )}
                      {product.name}
                    </Link>
                    {product.description && (
                      <p className="mt-0.5 truncate text-xs text-slate-400 max-w-[200px]">
                        {product.description}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <code className="rounded-md bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">
                      {product.sku}
                    </code>
                  </td>
                  <td className="px-5 py-4">
                    <span className="rounded-lg bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-gray-200">
                      {product.category}
                    </span>
                  </td>
                  <td className={cn("px-5 py-4 text-right font-bold", isLow ? "text-red-600" : "text-gray-900")}>
                    {product.stockQuantity}
                  </td>
                  <td className="px-5 py-4 text-right text-gray-500">
                    {product.minimumStock}
                  </td>
                  <td className="px-5 py-4 text-gray-500">
                    {(product as Product & { unit?: string }).unit ?? "pcs"}
                  </td>
                  <td className="px-5 py-4 text-right font-semibold text-gray-900">
                    {formatCurrency(Number(product.unitPrice), "INR")}
                  </td>
                  <td className="px-5 py-4">
                    <StockStatusBadge status={status} />
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => setConfirmId(product.id)}
                      className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-100 hover:border-red-300 transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-900/5">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-100 mb-4">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">Delete Product</h3>
            <p className="mt-2 text-sm text-gray-500">
              Are you sure you want to delete this product? This action cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => setConfirmId(null)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDelete}
                loading={deleting}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
