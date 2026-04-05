import { Request } from "express";

// ---------------------------------------------------------------------------
// Domain enums
// ---------------------------------------------------------------------------

export type DocumentCategory =
  | "POLICY" | "CONTRACT" | "HANDBOOK"
  | "FORM"   | "SOP"      | "COMPLIANCE" | "OTHER";

export type DocumentStatus = "ACTIVE" | "ARCHIVED" | "EXPIRED";

export type VaultAccessLevel = "ALL" | "MANAGER_ONLY" | "HR_ONLY" | "CUSTOM";

export type VideoCategory =
  | "ONBOARDING" | "TRAINING" | "SAFETY" | "COMPLIANCE" | "GENERAL";

export type VideoStatus = "PROCESSING" | "READY" | "FAILED";

export type StaffRole = "ADMIN" | "MANAGER" | "STAFF";

// ---------------------------------------------------------------------------
// Auth / JWT
// ---------------------------------------------------------------------------

export interface JwtPayload {
  sub:   string;      // staff ID
  email: string;
  role:  StaffRole;
  iat?:  number;
  exp?:  number;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

// ---------------------------------------------------------------------------
// Domain models (mirror DB columns — camelCase)
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

  tags:        string[];
  metadata:    Record<string, unknown>;
  requiresAck: boolean;
  expiresAt:   Date | null;
  status:      DocumentStatus;
  warningLevel: "none" | "low" | "medium" | "high";

  employeeId: string | null;

  uploadedBy: string;
  isDeleted:  boolean;
  createdAt:  Date;
  updatedAt:  Date;
}

export interface DocAcknowledgement {
  id:             string;
  documentId:     string;
  staffId:        string;
  acknowledgedAt: Date;
  ipAddress:      string | null;
  userAgent:      string | null;
  signature:      string | null;
  notes:          string | null;
  isDeleted:      boolean;
  createdAt:      Date;
  updatedAt:      Date;
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
  fileSize:     bigint;
  duration:     number | null;

  status:       VideoStatus;
  accessLevel:  VaultAccessLevel;
  allowedRoles: string[];
  allowedStaff: string[];

  tags:        string[];
  metadata:    Record<string, unknown>;
  isRequired:  boolean;
  expiresAt:   Date | null;

  uploadedBy: string;
  isDeleted:  boolean;
  createdAt:  Date;
  updatedAt:  Date;
}

export interface VideoWatchLog {
  id:             string;
  videoId:        string;
  staffId:        string;
  watchedSeconds: number;
  totalSeconds:   number;
  percentage:     number;
  completed:      boolean;
  lastPosition:   number;
  sessionData:    Record<string, unknown>;
  isDeleted:      boolean;
  createdAt:      Date;
  updatedAt:      Date;
}

// ---------------------------------------------------------------------------
// Upload result from storage service
// ---------------------------------------------------------------------------

export interface StorageUploadResult {
  url:      string;
  key:      string;
  fileSize: number;
  fileType: string;
}

// ---------------------------------------------------------------------------
// FFmpeg processing result
// ---------------------------------------------------------------------------

export interface VideoProcessResult {
  processedPath: string;
  thumbnailPath: string;
  duration:      number;         // seconds
  metadata: {
    width:   number;
    height:  number;
    codec:   string;
    bitrate: number;
  };
}
