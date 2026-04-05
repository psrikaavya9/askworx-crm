import type {
  Lead,
  LeadNote,
  LeadActivity,
  FollowUpReminder,
  Client,
  LeadCaptureForm,
  LeadCaptureSubmission,
  PipelineStage,
  LeadSource,
  LeadPriority,
  ActivityType,
  ReminderStatus,
} from "@/generated/prisma/client";
import type { ScoreCategory, CompanySize } from "@/generated/prisma/enums";

// ---------------------------------------------------------------------------
// Re-export Prisma-generated types
// ---------------------------------------------------------------------------

export type {
  Lead,
  LeadNote,
  LeadActivity,
  FollowUpReminder,
  Client,
  LeadCaptureForm,
  LeadCaptureSubmission,
  PipelineStage,
  LeadSource,
  LeadPriority,
  ActivityType,
  ReminderStatus,
  ScoreCategory,
  CompanySize,
};

// ---------------------------------------------------------------------------
// Lead Score (mirrors LeadScore Prisma model)
// ---------------------------------------------------------------------------

export interface LeadScore {
  id:               string;
  leadId:           string;
  companySizeScore: number;
  industryScore:    number;
  sourceScore:      number;
  recencyScore:     number;
  engagementScore:  number;
  totalScore:       number;
  category:         ScoreCategory;
  calculatedAt:     Date | string;
  updatedAt:        Date | string;
}

export type LeadWithScore = Lead & { score: LeadScore | null };

// ---------------------------------------------------------------------------
// Dynamic Pipeline types
// ---------------------------------------------------------------------------

export interface PipelineTemplate {
  id:          string;
  name:        string;
  dealType:    string;
  description: string | null;
  isActive:    boolean;
  createdAt:   Date | string;
  updatedAt:   Date | string;
  stages:      PipelineStageConfig[];
}

export interface PipelineStageConfig {
  id:          string;
  templateId:  string;
  name:        string;
  order:       number;
  probability: number;
  color:       string;
  isWon:       boolean;
  isLost:      boolean;
  createdAt:   Date | string;
  updatedAt:   Date | string;
}

export interface LeadPipeline {
  id:             string;
  leadId:         string;
  templateId:     string;
  currentStageId: string;
  stageUpdatedAt: Date | string;
  template:       PipelineTemplate;
  currentStage:   PipelineStageConfig;
  history:        LeadStageHistory[];
}

export interface LeadStageHistory {
  id:             string;
  leadPipelineId: string;
  fromStageId:    string | null;
  toStageId:      string;
  changedBy:      string;
  reason:         string | null;
  createdAt:      Date | string;
  fromStage:      PipelineStageConfig | null;
  toStage:        PipelineStageConfig;
}

export interface KanbanColumn {
  stage:         PipelineStageConfig;
  leads:         (Lead & { score: LeadScore | null })[];
  totalValue:    number;
  weightedValue: number;
  count:         number;
}

export interface KanbanView {
  template:            PipelineTemplate;
  columns:             KanbanColumn[];
  totalPipelineValue:  number;
  forecastedValue:     number;
}

// ---------------------------------------------------------------------------
// Enriched / view types
// ---------------------------------------------------------------------------

export type LeadWithRelations = Lead & {
  notes: LeadNote[];
  activities: LeadActivity[];
  reminders: FollowUpReminder[];
  client: Client | null;
};

export type ClientWithLeads = Client & {
  leads: Lead[];
};

// ---------------------------------------------------------------------------
// Pipeline stage order & metadata
// ---------------------------------------------------------------------------

export const PIPELINE_STAGES: PipelineStage[] = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL",
  "WON",
  "LOST",
];

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  PROPOSAL: "Proposal Sent",
  WON: "Won",
  LOST: "Lost",
};

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  WEBSITE: "Website",
  REFERRAL: "Referral",
  SOCIAL_MEDIA: "Social Media",
  EMAIL_CAMPAIGN: "Email Campaign",
  COLD_CALL: "Cold Call",
  TRADE_SHOW: "Trade Show",
  PARTNER: "Partner",
  OTHER: "Other",
};

// ---------------------------------------------------------------------------
// KPI types
// ---------------------------------------------------------------------------

export interface PipelineKPI {
  stage: PipelineStage;
  label: string;
  count: number;
  totalValue: number;
  conversionRate: number | null; // % of leads that moved from prev stage
}

export interface SourceKPI {
  source: LeadSource;
  label: string;
  total: number;
  won: number;
  conversionRate: number;
  totalValue: number;
}

export interface CRMDashboardKPI {
  totalLeads: number;
  newThisPeriod: number;
  wonThisPeriod: number;
  lostThisPeriod: number;
  overallConversionRate: number;
  totalPipelineValue: number;
  avgDealValue: number;
  overdueReminders: number;
  pipeline: PipelineKPI[];
  bySource: SourceKPI[];
}

// ---------------------------------------------------------------------------
// Form field definition (stored in LeadCaptureForm.fields JSON)
// ---------------------------------------------------------------------------

export type FormFieldType =
  | "text"
  | "email"
  | "phone"
  | "textarea"
  | "select"
  | "checkbox";

export interface FormFieldDefinition {
  name: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  placeholder?: string;
  options?: string[]; // for select fields
}

// ---------------------------------------------------------------------------
// Pagination helpers
// ---------------------------------------------------------------------------

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
