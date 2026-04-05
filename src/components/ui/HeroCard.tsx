"use client";

import { cn } from "@/lib/utils";

interface HeroStat {
  label: string;
  value: string | number;
  sub?: string;
}

interface HeroCardProps {
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: "green" | "blue" | "yellow" | "red";
  initials?: string;
  stats?: HeroStat[];
  className?: string;
}

const badgeColors = {
  green: "bg-green-50 text-green-700 ring-1 ring-green-200",
  blue:  "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  yellow: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  red:   "bg-red-50 text-red-700 ring-1 ring-red-200",
};

export function HeroCard({
  title,
  subtitle,
  badge,
  badgeColor = "green",
  initials = "A",
  stats = [],
  className,
}: HeroCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg",
        className
      )}
    >
      {/* Subtle purple top accent */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-purple-500 to-violet-500 rounded-t-2xl" />

      <div className="relative px-8 py-7">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">

          {/* Left — Identity */}
          <div className="flex items-center gap-5">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 text-xl font-bold text-white shadow-md shadow-purple-200">
                <img
  src="/icon-192.png"
  alt="logo"
  className="h-12 w-12 rounded-xl object-cover"
/>
              </div>
              {/* Online dot */}
              <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white ring-2 ring-white">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-green-500" />
              </span>
            </div>

            {/* Name block */}
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-bold tracking-tight text-gray-900">{title}</h2>
                {badge && (
                  <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider", badgeColors[badgeColor])}>
                    {badge}
                  </span>
                )}
              </div>
              {subtitle && (
                <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>
              )}
            </div>
          </div>

          {/* Right — Stats row (NBA-style) */}
          {stats.length > 0 && (
            <div className="flex items-center gap-1 md:gap-0">
              {stats.map((stat, i) => (
                <div key={stat.label} className="flex items-center">
                  {i > 0 && (
                    <div className="mx-4 h-10 w-px bg-gray-200 md:mx-6" />
                  )}
                  <div className="text-center min-w-[64px]">
                    <p className="text-2xl font-extrabold leading-none tracking-tight text-gray-900">
                      {stat.value}
                    </p>
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                      {stat.label}
                    </p>
                    {stat.sub && (
                      <p className="mt-0.5 text-[10px] text-purple-500">{stat.sub}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
