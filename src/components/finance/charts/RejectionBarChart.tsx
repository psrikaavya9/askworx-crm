"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import type { RejectionDataPoint } from "@/modules/finance/repositories/expenseAnalytics.repository";

interface Props {
  data:    RejectionDataPoint[];
  height?: number;
}

/** Truncate long reasons for the axis label */
function shortLabel(s: string, max = 28): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

export function RejectionBarChart({ data, height = 220 }: Props) {
  if (!data?.length) {
    return (
      <div className="flex items-center justify-center text-sm text-gray-400" style={{ height }}>
        No rejections in this period
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Rejection Frequency by Reason
      </p>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="reason"
            tick={{ fontSize: 10 }}
            tickFormatter={shortLabel}
            width={180}
          />
          <Tooltip
            formatter={(value: unknown) => [String(value), "Count"]}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
          />
          <Bar dataKey="count" name="Count" radius={[0, 4, 4, 0]} maxBarSize={24}>
            {data.map((_, i) => (
              <Cell key={i} fill={i === 0 ? "#ef4444" : i === 1 ? "#f97316" : "#fbbf24"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
