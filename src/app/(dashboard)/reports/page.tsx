import Link from "next/link";
import { FileText, Users, Kanban, UserCheck, Wallet, Package, ArrowRight, BarChart3 } from "lucide-react";
import { REPORTS_BY_CATEGORY } from "@/lib/reports-config";
import type { ReportCategory, ReportMeta } from "@/lib/reports-config";

// ---------------------------------------------------------------------------
// Category config
// ---------------------------------------------------------------------------

const CATEGORY_CONFIG: Record<ReportCategory, { icon: React.ReactNode; gradient: string; accent: string }> = {
  CRM: {
    icon: <Users className="h-5 w-5 text-white" />,
    gradient: "from-indigo-500/30 to-blue-500/20",
    accent: "bg-indigo-500/30 border-indigo-400/30",
  },
  Projects: {
    icon: <Kanban className="h-5 w-5 text-white" />,
    gradient: "from-purple-500/30 to-violet-500/20",
    accent: "bg-purple-500/30 border-purple-400/30",
  },
  Staff: {
    icon: <UserCheck className="h-5 w-5 text-white" />,
    gradient: "from-teal-500/30 to-cyan-500/20",
    accent: "bg-teal-500/30 border-teal-400/30",
  },
  Finance: {
    icon: <Wallet className="h-5 w-5 text-white" />,
    gradient: "from-emerald-500/30 to-green-500/20",
    accent: "bg-emerald-500/30 border-emerald-400/30",
  },
  Inventory: {
    icon: <Package className="h-5 w-5 text-white" />,
    gradient: "from-orange-500/30 to-amber-500/20",
    accent: "bg-orange-500/30 border-orange-400/30",
  },
};

// ---------------------------------------------------------------------------
// Report card
// ---------------------------------------------------------------------------

function ReportCard({ report }: { report: ReportMeta }) {
  return (
    <Link
      href={`/reports/${report.slug}`}
      className="group block rounded-2xl border border-white/20 bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-lg p-5 shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:border-white/40 hover:from-white/20 hover:to-white/10"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/20">
              <FileText className="h-3.5 w-3.5 text-white" />
            </div>
            <p className="truncate text-sm font-semibold text-white transition-colors group-hover:text-white/90">
              {report.title}
            </p>
          </div>
          <p className="text-xs text-white/60 line-clamp-2 pl-8">{report.description}</p>
        </div>
        <ArrowRight className="ml-2 mt-0.5 h-4 w-4 shrink-0 text-white/30 transition-all duration-300 group-hover:text-white/80 group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Category section
// ---------------------------------------------------------------------------

function CategorySection({ cat, reports }: { cat: ReportCategory; reports: ReportMeta[] }) {
  const cfg = CATEGORY_CONFIG[cat];
  return (
    <div
      id={cat}
      className={`rounded-3xl border border-white/20 bg-gradient-to-br ${cfg.gradient} backdrop-blur-xl p-6 shadow-xl`}
    >
      {/* Section header */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${cfg.accent} backdrop-blur-sm`}>
            {cfg.icon}
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">{cat} Reports</h2>
            <p className="text-xs text-white/60">{reports.length} available report{reports.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((r) => (
          <ReportCard key={r.slug} report={r} />
        ))}
      </div>
    </div>
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
    <div className="mx-auto max-w-7xl space-y-8 px-8 py-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 shadow-lg">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Reports</h1>
          </div>
          <p className="mt-1 text-sm text-white/70 pl-13">
            {totalReports} reports across 5 modules — click any report to generate with filters.
          </p>
        </div>

        {/* Category quick-nav */}
        <div className="hidden sm:flex items-center gap-1 rounded-2xl border border-white/20 bg-white/10 backdrop-blur-lg px-4 py-2.5 shadow-lg">
          {CATEGORIES.map((cat) => (
            <a
              key={cat}
              href={`#${cat}`}
              className="rounded-lg px-2.5 py-1 text-xs font-medium text-white/70 transition-all duration-200 hover:bg-white/20 hover:text-white"
            >
              {cat} ({REPORTS_BY_CATEGORY[cat]?.length ?? 0})
            </a>
          ))}
        </div>
      </div>

      {/* Category sections */}
      {CATEGORIES.map((cat) => (
        <CategorySection
          key={cat}
          cat={cat}
          reports={REPORTS_BY_CATEGORY[cat] ?? []}
        />
      ))}
    </div>
  );
}
