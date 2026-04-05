"use client";

import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { MonthlyDataPoint } from "@/modules/finance/repositories/expenseAnalytics.repository";

interface Props {
  data:    MonthlyDataPoint[];
  height?: number;
}

function shortINR(v: number) {
  if (v >= 100_000) return `₹${(v / 100_000).toFixed(1)}L`;
  if (v >= 1_000)   return `₹${(v / 1_000).toFixed(0)}K`;
  return `₹${Math.round(v)}`;
}

export function MonthlyLineChart({ data, height = 260 }: Props) {
  if (!data?.length) {
    return (
      <div className="flex items-center justify-center text-sm text-gray-400" style={{ height }}>
        No monthly data
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Monthly Expense Trend
      </p>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="approvedGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.12} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={shortINR} width={56} />
          <Tooltip
            formatter={(v: unknown, name: unknown) => [shortINR(Number(v)), String(name)]}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
          />
          <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          <Area
            type="monotone" dataKey="total" name="Total"
            stroke="#6366f1" strokeWidth={2}
            fill="url(#totalGrad)"
            dot={{ r: 3, fill: "#6366f1" }} activeDot={{ r: 5 }}
          />
          <Area
            type="monotone" dataKey="approved" name="Approved"
            stroke="#22c55e" strokeWidth={2}
            fill="url(#approvedGrad)"
            dot={{ r: 3, fill: "#22c55e" }} activeDot={{ r: 5 }}
          />
          <Line
            type="monotone" dataKey="rejected" name="Rejected"
            stroke="#ef4444" strokeWidth={2} strokeDasharray="4 2"
            dot={{ r: 3, fill: "#ef4444" }} activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
