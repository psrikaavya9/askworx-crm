"use client";

import { useState } from "react";
import {
  Clock,
  FolderKanban,
  ReceiptText,
  MessageSquareWarning,
  FolderLock,
  Phone,
  Navigation,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getInitials, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { IdentityCard } from "./IdentityCard";
import { RelationshipCard } from "./RelationshipCard";
import { TimelineTab } from "./tabs/TimelineTab";
import { ProjectsTab } from "./tabs/ProjectsTab";
import { FinancialTab } from "./tabs/FinancialTab";
import { ComplaintsTab } from "./tabs/ComplaintsTab";
import { DocumentsTab } from "./tabs/DocumentsTab";
import { LogCallModal } from "./LogCallModal";
import { LogVisitModal } from "./LogVisitModal";
import { LogNoteModal } from "./LogNoteModal";
import { LogEmailModal } from "./LogEmailModal";
import { LogWhatsAppModal } from "./LogWhatsAppModal";
import type {
  C360Client,
  C360Interaction,
  C360Project,
  C360Invoice,
  C360Complaint,
  C360HealthScore,
} from "./types";
import type { TimelineEvent } from "@/modules/customer360/types/timeline.types";

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

type TabId = "timeline" | "projects" | "financial" | "complaints" | "documents";

interface TabDef {
  id:    TabId;
  label: string;
  icon:  React.ReactNode;
  count?: number;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  client:       C360Client;
  interactions: C360Interaction[];
  projects:     C360Project[];
  invoices:     C360Invoice[];
  complaints:   C360Complaint[];
  healthScore:  C360HealthScore | null;
  timeline:     TimelineEvent[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Customer360Client({
  client,
  interactions,
  projects,
  invoices,
  complaints,
  healthScore,
  timeline,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("timeline");

  const openComplaints = complaints.filter(
    (c) => c.status === "OPEN" || c.status === "IN_PROGRESS",
  ).length;

  const TABS: TabDef[] = [
    {
      id:    "timeline",
      label: "Timeline",
      icon:  <Clock className="h-3.5 w-3.5" />,
      count: timeline.length,
    },
    {
      id:    "projects",
      label: "Projects",
      icon:  <FolderKanban className="h-3.5 w-3.5" />,
      count: projects.length,
    },
    {
      id:    "financial",
      label: "Financial",
      icon:  <ReceiptText className="h-3.5 w-3.5" />,
      count: invoices.length,
    },
    {
      id:    "complaints",
      label: "Complaints",
      icon:  <MessageSquareWarning className="h-3.5 w-3.5" />,
      count: openComplaints > 0 ? openComplaints : complaints.length,
    },
    {
      id:    "documents",
      label: "Documents",
      icon:  <FolderLock className="h-3.5 w-3.5" />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── Profile hero ──────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-xl font-bold text-white shadow-md">
            {getInitials(client.firstName, client.lastName)}
          </div>

          {/* Name block */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {client.firstName} {client.lastName}
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">
              {[client.jobTitle, client.company].filter(Boolean).join(" · ")}
            </p>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <Badge variant="green" dot>
                Active Client
              </Badge>
              <span className="text-xs text-gray-400">
                Since {formatDate(client.createdAt)}
              </span>
              {client.tags.map((tag) => (
                <Badge key={tag} variant="indigo">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <LogCallModal      clientId={client.id} />
          <LogNoteModal      clientId={client.id} />
          <LogEmailModal     clientId={client.id} />
          <LogWhatsAppModal  clientId={client.id} />
          <LogVisitModal     clientId={client.id} />
        </div>
      </div>

      {/* ── Two-column layout ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        {/* Left sidebar cards */}
        <div className="space-y-4">
          <IdentityCard client={client} />
          <RelationshipCard client={client} healthScore={healthScore} />
        </div>

        {/* Right: tabs */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          {/* Tab bar */}
          <div className="flex items-center gap-1 border-b border-gray-100 px-4 pt-3 overflow-x-auto">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const showAlert =
                tab.id === "complaints" && openComplaints > 0;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "relative flex items-center gap-1.5 whitespace-nowrap rounded-t-lg px-3.5 py-2.5 text-xs font-medium transition-colors",
                    isActive
                      ? "border-b-2 border-indigo-600 text-indigo-600"
                      : "text-gray-500 hover:text-gray-900",
                  )}
                >
                  {tab.icon}
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                        showAlert
                          ? "bg-red-100 text-red-700"
                          : isActive
                          ? "bg-indigo-100 text-indigo-700"
                          : "bg-gray-100 text-gray-600",
                      )}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div className="p-6">
            {activeTab === "timeline" && (
              <TimelineTab timeline={timeline} clientId={client.id} />
            )}
            {activeTab === "projects" && (
              <ProjectsTab projects={projects} />
            )}
            {activeTab === "financial" && (
              <FinancialTab invoices={invoices} />
            )}
            {activeTab === "complaints" && (
              <ComplaintsTab complaints={complaints} />
            )}
            {activeTab === "documents" && <DocumentsTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
