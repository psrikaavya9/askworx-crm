import Link from "next/link";
import { FileText, Users, Kanban, UserCheck, Wallet, Package, ArrowRight } from "lucide-react";
import { SectionBlock } from "@/components/ui/SectionBlock";
import { REPORTS_BY_CATEGORY } from "@/lib/reports-config";
import type { ReportCategory, ReportMeta } from "@/lib/reports-config";

// ---------------------------------------------------------------------------
// Category icon map
// ---------------------------------------------------------------------------

const CATEGORY_ICONS: Record<ReportCategory, React.ReactNode> = {
  CRM: <Users className="h-4.5 w-4.5 text-indigo-600" />,
  Projects: <Kanban className="h-4.5 w-4.5 text-purple-600" />,
  Staff: <UserCheck className="h-4.5 w-4.5 text-teal-600" />,
  Finance: <Wallet className="h-4.5 w-4.5 text-emerald-600" />,
  Inventory: <Package className="h-4.5 w-4.5 text-orange-600" />,
};

// ---------------------------------------------------------------------------
// Report card
// ---------------------------------------------------------------------------

function ReportCard({ report }: { report: ReportMeta }) {
  return (
    <Link
      href={`/reports/${report.slug}`}
      className="group block rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-indigo-300 hover:shadow-md hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <FileText className="h-4 w-4 shrink-0 text-gray-400 transition-colors group-hover:text-indigo-500" />
            <p className="truncate text-sm font-semibold text-gray-800 transition-colors group-hover:text-indigo-700">
              {report.title}
            </p>
          </div>
          <p className="text-xs text-gray-500 line-clamp-2">{report.description}</p>
        </div>
        <ArrowRight className="ml-2 mt-0.5 h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-indigo-400" />
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const CATEGORIES: ReportCategory[] = ["CRM", "Projects", "Staff", "Finance", "Inventory"];

export default function ReportsPage() {
  const totalReports = Object.values(REPORTS_BY_CATEGORY).reduce(
    (s, arr) => s + arr.length,
    0
  );

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-8 py-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="mt-1 text-sm text-gray-500">
            {totalReports} reports across 5 modules — click any report to generate with filters.
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-2.5 shadow-sm text-sm">
          {CATEGORIES.map((cat) => (
            <a key={cat} href={`#${cat}`} className="text-gray-500 hover:text-indigo-600 transition-colors">
              {cat} ({REPORTS_BY_CATEGORY[cat]?.length ?? 0})
            </a>
          ))}
        </div>
      </div>

      {/* Category sections */}
      {CATEGORIES.map((cat) => (
        <div key={cat} id={cat}>
          <SectionBlock
            title={`${cat} Reports`}
            subtitle={`${REPORTS_BY_CATEGORY[cat]?.length ?? 0} available reports`}
            icon={CATEGORY_ICONS[cat]}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(REPORTS_BY_CATEGORY[cat] ?? []).map((r) => (
                <ReportCard key={r.slug} report={r} />
              ))}
            </div>
          </SectionBlock>
        </div>
      ))}
    </div>
  );
}
