"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import type { CategoryDataPoint } from "@/modules/finance/repositories/expenseAnalytics.repository";

interface Props {
  data:    CategoryDataPoint[];
  height?: number;
}

function shortINR(v: number) {
  if (v >= 100_000) return `₹${(v / 100_000).toFixed(1)}L`;
  if (v >= 1_000)   return `₹${(v / 1_000).toFixed(0)}K`;
  return `₹${Math.round(v)}`;
}

const COLORS = [
  "#6366f1", "#f97316", "#22c55e", "#ec4899",
  "#14b8a6", "#eab308", "#8b5cf6", "#3b82f6",
  "#ef4444", "#06b6d4",
];

export function CategoryBarChart({ data, height = 260 }: Props) {
  if (!data?.length) {
    return (
      <div className="flex items-center justify-center text-sm text-gray-400" style={{ height }}>
        No category data
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Spend by Category
      </p>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -10, bottom: 30 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="category"
            tick={{ fontSize: 10 }}
            angle={-35}
            textAnchor="end"
            interval={0}
          />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={shortINR} width={56} />
          <Tooltip
            formatter={(value: unknown, _: unknown, props: { payload?: CategoryDataPoint }) => [
              `${shortINR(Number(value))} (${props.payload?.count ?? 0} expenses)`,
              "Total",
            ]}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
          />
          <Bar dataKey="total" name="Total" radius={[4, 4, 0, 0]} maxBarSize={48}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
