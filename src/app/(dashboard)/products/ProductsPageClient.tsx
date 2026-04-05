"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ProductsTable } from "@/components/inventory/ProductsTable";
import { AddProductModal } from "@/components/inventory/AddProductModal";
import { Plus } from "lucide-react";
import type { Product } from "@/generated/prisma/client";

interface ProductsPageClientProps {
  data: Product[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  categories: string[];
}

export function ProductsPageClient({
  data,
  total,
  categories,
}: ProductsPageClientProps) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Product Catalogue</h2>
          <p className="text-sm text-slate-500">{total} product{total !== 1 ? "s" : ""} total</p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setAddOpen(true)}>
          Add Product
        </Button>
      </div>

      <ProductsTable data={data} />

      <AddProductModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        categories={categories}
      />
    </div>
  );
}
