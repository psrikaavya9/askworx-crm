import { productFiltersSchema } from "@/modules/inventory/schemas/product.schema";
import * as productService from "@/modules/inventory/services/product.service";
import * as stockService from "@/modules/inventory/services/stock.service";
import { StatCard } from "@/components/ui/Card";
import { SectionBlock } from "@/components/ui/SectionBlock";
import { ProductsPageClient } from "./ProductsPageClient";
import { Package, AlertTriangle, DollarSign, Activity } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { serializePrisma } from "@/lib/serialize";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ProductsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = productFiltersSchema.parse(params);

  const [result, kpi, categories] = await Promise.all([
    productService.getProducts(filters),
    stockService.getInventoryKPI(),
    productService.getCategories(),
  ]);

  const safe = serializePrisma({ result, kpi, categories });
  const safeResult = safe.result;
  const safeKpi = safe.kpi;
  const safeCategories = safe.categories;

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-8 py-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Products</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your product catalogue, stock levels, and movements</p>
      </div>

      {/* KPI Section */}
      <SectionBlock
        title="Inventory Overview"
        subtitle="Stock health, low stock alerts, and total inventory value"
        icon={<Package className="h-4.5 w-4.5 text-orange-600" />}
        href="/analytics"
        hrefLabel="View analytics"
      >
        <div className="grid grid-cols-4 gap-6">
          <StatCard
            label="Total Products"
            value={safeKpi.totalProducts}
            icon={<Package className="h-5 w-5" />}
            color="indigo"
          />
          <StatCard
            label="Low Stock Items"
            value={safeKpi.lowStockItems}
            icon={<AlertTriangle className="h-5 w-5" />}
            color="red"
          />
          <StatCard
            label="Inventory Value"
            value={formatCurrency(safeKpi.totalInventoryValue, "INR")}
            icon={<DollarSign className="h-5 w-5" />}
            color="green"
          />
          <StatCard
            label="Movements (7 days)"
            value={safeKpi.recentMovementsCount}
            icon={<Activity className="h-5 w-5" />}
            color="yellow"
          />
        </div>
      </SectionBlock>

      {/* Table Section */}
      <SectionBlock
        title="Product Catalogue"
        subtitle="Search, filter, and manage all products and stock levels"
        icon={<Activity className="h-4.5 w-4.5 text-orange-600" />}
      >
        <ProductsPageClient
          data={safeResult.data}
          total={safeResult.total}
          page={safeResult.page}
          pageSize={safeResult.pageSize}
          totalPages={safeResult.totalPages}
          categories={safeCategories}
        />
      </SectionBlock>
    </div>
  );
}
