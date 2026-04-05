import { notFound } from "next/navigation";
import { REPORTS_BY_SLUG } from "@/lib/reports-config";
import { ReportViewer } from "@/components/reports/ReportViewer";

interface PageProps {
  params: Promise<{ report: string }>;
}

export default async function ReportPage({ params }: PageProps) {
  const { report: slug } = await params;
  const reportMeta = REPORTS_BY_SLUG[slug];

  if (!reportMeta) notFound();

  return <ReportViewer report={reportMeta} />;
}

export async function generateStaticParams() {
  const { REPORTS } = await import("@/lib/reports-config");
  return REPORTS.map((r) => ({ report: r.slug }));
}
