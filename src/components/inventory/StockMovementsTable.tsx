import { formatDateTime } from "@/lib/utils";
import { MovementTypeBadge } from "./MovementTypeBadge";
import type { StockMovementWithProduct } from "@/modules/inventory/types";

interface StockMovementsTableProps {
  data: StockMovementWithProduct[];
  showProduct?: boolean;
}

export function StockMovementsTable({ data, showProduct = false }: StockMovementsTableProps) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-10 text-center">
        <p className="text-sm text-gray-500">No stock movements recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-md">
      <table className="min-w-full divide-y divide-gray-100">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              Type
            </th>
            {showProduct && (
              <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Product
              </th>
            )}
            <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
              Quantity
            </th>
            <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              Reference
            </th>
            <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              Notes
            </th>
            <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              Date
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map((m) => (
            <tr key={m.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-5 py-4">
                <MovementTypeBadge type={m.type} />
              </td>
              {showProduct && (
                <td className="px-5 py-4">
                  <p className="text-sm font-medium text-gray-900">{m.product.name}</p>
                  <p className="font-mono text-xs text-gray-400">{m.product.sku}</p>
                </td>
              )}
              <td className="px-5 py-4 text-right">
                <span className={`text-sm font-semibold ${m.type === "IN" ? "text-green-600" : m.type === "OUT" ? "text-red-600" : "text-yellow-600"}`}>
                  {m.type === "IN" ? "+" : m.type === "OUT" ? "-" : "~"}{m.quantity}
                </span>
              </td>
              <td className="px-5 py-4 text-sm text-gray-600">
                {m.reference ?? <span className="text-gray-300">—</span>}
              </td>
              <td className="px-5 py-4 text-sm text-gray-500 max-w-xs">
                <span className="line-clamp-1">{m.notes ?? <span className="text-gray-300">—</span>}</span>
              </td>
              <td className="px-5 py-4 text-sm text-gray-500 whitespace-nowrap">
                {formatDateTime(m.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
