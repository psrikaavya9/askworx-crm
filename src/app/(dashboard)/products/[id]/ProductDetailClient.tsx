"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StockStatusBadge } from "@/components/inventory/StockStatusBadge";
import { StockMovementsTable } from "@/components/inventory/StockMovementsTable";
import { StockActionModal } from "@/components/inventory/StockActionModal";
import { getStockStatus } from "@/modules/inventory/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, Minus, SlidersHorizontal, ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { Product, StockMovement } from "@/generated/prisma/client";
import type { StockMovementWithProduct } from "@/modules/inventory/types";

interface ProductWithMovements extends Product {
  movements: StockMovement[];
}

interface ProductDetailClientProps {
  product: ProductWithMovements;
}

type ActionType = "in" | "out" | "adjust";

export function ProductDetailClient({ product }: ProductDetailClientProps) {
  const [action, setAction] = useState<ActionType | null>(null);
  const stockStatus = getStockStatus(product);

  // Cast movements for table (product field added below)
  const movements: StockMovementWithProduct[] = product.movements.map((m) => ({
    ...m,
    product: { id: product.id, name: product.name, sku: product.sku },
  }));

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {/* Back link */}
      <Link
        href="/products"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Products
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{product.name}</h1>
          <div className="mt-1 flex items-center gap-3">
            <span className="font-mono text-sm text-gray-500">{product.sku}</span>
            <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              {product.category}
            </span>
            <StockStatusBadge status={stockStatus} />
          </div>
          {product.description && (
            <p className="mt-2 text-sm text-gray-500">{product.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setAction("in")}
          >
            Add Stock
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Minus className="h-4 w-4" />}
            onClick={() => setAction("out")}
          >
            Remove Stock
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<SlidersHorizontal className="h-4 w-4" />}
            onClick={() => setAction("adjust")}
          >
            Adjust
          </Button>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <p className="text-xs text-gray-500">Current Stock</p>
          <p className={`mt-1 text-2xl font-bold ${stockStatus === "LOW_STOCK" ? "text-red-600" : "text-gray-900"}`}>
            {product.stockQuantity}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">units</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500">Minimum Stock</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{product.minimumStock}</p>
          <p className="mt-0.5 text-xs text-gray-400">units threshold</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500">Unit Price</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {formatCurrency(Number(product.unitPrice), "INR")}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">selling price</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500">Cost Price</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {formatCurrency(Number(product.costPrice), "INR")}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">purchase price</p>
        </Card>
      </div>

      {/* Inventory value */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">Total Inventory Value</p>
            <p className="mt-1 text-xl font-bold text-indigo-600">
              {formatCurrency(product.stockQuantity * Number(product.costPrice), "INR")}
            </p>
            <p className="mt-0.5 text-xs text-gray-400">
              {product.stockQuantity} units × {formatCurrency(Number(product.costPrice), "INR")} cost price
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Added</p>
            <p className="text-sm text-gray-600">{formatDate(product.createdAt)}</p>
          </div>
        </div>
      </Card>

      {/* Low stock alert */}
      {stockStatus === "LOW_STOCK" && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <span className="text-sm font-medium text-red-700">
            ⚠ Low Stock Alert — Current stock ({product.stockQuantity}) is at or below the minimum level ({product.minimumStock}).
          </span>
        </div>
      )}

      {/* Stock movement history */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900">Stock Movement History</h2>
        <StockMovementsTable data={movements} showProduct={false} />
      </div>

      {/* Stock action modals */}
      {action && (
        <StockActionModal
          open={true}
          onClose={() => setAction(null)}
          action={action}
          productId={product.id}
          productName={product.name}
          currentStock={product.stockQuantity}
        />
      )}
    </div>
  );
}
