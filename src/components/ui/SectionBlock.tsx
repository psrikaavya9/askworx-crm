import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SectionBlockProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  href?: string;
  hrefLabel?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function SectionBlock({
  children,
  title,
  subtitle,
  href,
  hrefLabel = "View all",
  icon,
  action,
  className,
}: SectionBlockProps) {
  const hasHeader = title || href || action;

  return (
    <div
      className={cn(
        "rounded-xl border border-gray-200 bg-white p-6 shadow-lg",
        className
      )}
    >
      {hasHeader && (
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-50 border border-purple-100">
                {icon}
              </div>
            )}
            {title && (
              <div>
                <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
                {subtitle && (
                  <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>
                )}
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {action}
            {href && (
              <Link
                href={href}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-purple-600 transition-colors hover:bg-purple-50 hover:text-purple-700"
              >
                {hrefLabel}
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
