// ---------------------------------------------------------------------------
// Module 7 — HR Document & Video Vault (frontend types)
// ---------------------------------------------------------------------------

export type DocumentCategory =
  | "POLICY" | "CONTRACT" | "HANDBOOK"
  | "FORM"   | "SOP"      | "COMPLIANCE" | "OTHER";

export type DocumentStatus = "ACTIVE" | "ARCHIVED" | "EXPIRED";

export type WarningLevel = "none" | "low" | "medium" | "high";

export type VaultAccessLevel =
  | "ALL" | "MANAGER_ONLY" | "HR_ONLY" | "CUSTOM";

export type VideoCategory =
  | "ONBOARDING" | "TRAINING" | "SAFETY" | "COMPLIANCE" | "GENERAL";

export type VideoStatus = "PROCESSING" | "READY" | "FAILED";

// ---------------------------------------------------------------------------

export interface HrDocument {
  id:          string;
  title:       string;
  description: string | null;
  category:    DocumentCategory;

  fileUrl:  string;
  fileKey:  string;
  fileType: string;
  fileSize: number;

  version:  number;
  parentId: string | null;
  isLatest: boolean;

  accessLevel:  VaultAccessLevel;
  allowedRoles: string[];
  allowedStaff: string[];

  tags:         string[];
  metadata:     Record<string, unknown>;
  requiresAck:  boolean;
  expiresAt:    string | null;
  status:       DocumentStatus;
  warningLevel: WarningLevel;

  employeeId: string | null;

  uploadedBy: string;
  isDeleted:  boolean;
  createdAt:  string;
  updatedAt:  string;

  // Injected client-side
  acknowledged?: boolean;
}

export interface DocAcknowledgement {
  id:             string;
  documentId:     string;
  staffId:        string;
  acknowledgedAt: string;
  ipAddress:      string | null;
  userAgent:      string | null;
  signature:      string | null;
  notes:          string | null;
  createdAt:      string;
}

export interface HrVideo {
  id:           string;
  title:        string;
  description:  string | null;
  category:     VideoCategory;
  originalUrl:  string;
  processedUrl: string | null;
  thumbnailUrl: string | null;
  fileKey:      string;
  fileSize:     number;
  duration:     number | null;
  status:       VideoStatus;
  accessLevel:  VaultAccessLevel;
  allowedRoles: string[];
  allowedStaff: string[];
  tags:         string[];
  metadata:     Record<string, unknown>;
  isRequired:   boolean;
  expiresAt:    string | null;
  uploadedBy:   string;
  createdAt:    string;
}

export interface VideoWatchLog {
  videoId:        string;
  staffId:        string;
  watchedSeconds: number;
  totalSeconds:   number;
  percentage:     number;
  completed:      boolean;
  lastPosition:   number;
  updatedAt:      string;
}

// ---------------------------------------------------------------------------
// API response shapes
// ---------------------------------------------------------------------------

export interface VaultListResponse<T> {
  success: boolean;
  data:    T[];
  meta: {
    total:      number;
    page:       number;
    limit:      number;
    totalPages: number;
  };
}

export interface VaultSingleResponse<T> {
  success: boolean;
  data:    T;
}

// ---------------------------------------------------------------------------
// Expiry alerts
// ---------------------------------------------------------------------------

export interface DocumentAlertSummary {
  id:           string;
  title:        string;
  expiresAt:    string;
  warningLevel: WarningLevel;
  category:     DocumentCategory;
  daysUntil:    number;
}

export interface DocumentAlertsResult {
  expiringSoon: DocumentAlertSummary[];
  critical:     DocumentAlertSummary[];
  expired:      DocumentAlertSummary[];
  counts: {
    expiringSoon: number;
    critical:     number;
    expired:      number;
  };
}

// ---------------------------------------------------------------------------
// Upload form input
// ---------------------------------------------------------------------------

export interface UploadDocumentForm {
  title:        string;
  description:  string;
  category:     DocumentCategory;
  accessLevel:  VaultAccessLevel;
  requiresAck:  boolean;
  expiresAt:    string;
  tags:         string;
  file:         File | null;
}
