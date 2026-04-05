"use client";

import type {
  HrDocument, DocAcknowledgement, HrVideo,
  VideoWatchLog, VaultListResponse, VaultSingleResponse,
  DocumentCategory, DocumentStatus, VideoCategory, VaultAccessLevel,
  WarningLevel, DocumentAlertsResult,
} from "@/types/vault";

// ---------------------------------------------------------------------------
// All requests go to the Next.js app itself — no external vault-server needed
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Token management
// Fetches from /api/vault/token (Next.js route) and caches in memory.
// ---------------------------------------------------------------------------

let _token: string | null = null;

export async function getVaultToken(): Promise<string> {
  if (_token) return _token;
  const res  = await fetch("/api/vault/token");
  const data = await res.json() as { token: string };
  _token = data.token;
  return _token;
}

export function clearVaultToken(): void {
  _token = null;
}

// ---------------------------------------------------------------------------
// Core fetch wrapper — relative paths, always with Bearer auth
// ---------------------------------------------------------------------------

async function vaultFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const token = await getVaultToken();

  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });

  const json = await res.json();

  if (!res.ok) {
    throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`);
  }

  return json as T;
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export interface ListDocumentsParams {
  category?:     DocumentCategory;
  status?:       DocumentStatus;
  warningLevel?: WarningLevel;
  requiresAck?:  boolean;
  search?:       string;
  page?:         number;
  limit?:        number;
  scope?:        "mine" | "company";
}

export async function listDocuments(
  params: ListDocumentsParams = {}
): Promise<VaultListResponse<HrDocument>> {
  const qs = new URLSearchParams();
  if (params.category)                  qs.set("category",     params.category);
  if (params.status)                    qs.set("status",       params.status);
  if (params.warningLevel)              qs.set("warningLevel", params.warningLevel);
  if (params.requiresAck !== undefined) qs.set("requiresAck",  String(params.requiresAck));
  if (params.search)                    qs.set("search",       params.search);
  if (params.page)                      qs.set("page",         String(params.page));
  if (params.limit)                     qs.set("limit",        String(params.limit));
  if (params.scope)                     qs.set("scope",        params.scope);
  const q = qs.toString();
  return vaultFetch(`/api/hr-documents${q ? `?${q}` : ""}`);
}

export async function getDocument(
  id: string
): Promise<VaultSingleResponse<HrDocument>> {
  return vaultFetch(`/api/hr-documents/${id}`);
}

export async function uploadDocument(
  file: File,
  fields: {
    title:        string;
    description?: string;
    category:     DocumentCategory;
    accessLevel?: VaultAccessLevel;
    requiresAck?: boolean;
    expiresAt?:   string;
    tags?:        string;
  }
): Promise<VaultSingleResponse<HrDocument>> {
  const token = await getVaultToken();
  const form  = new FormData();
  form.append("file", file);
  Object.entries(fields).forEach(([k, v]) => {
    if (v !== undefined && v !== "") form.append(k, String(v));
  });

  const res = await fetch("/api/hr-documents", {
    method:  "POST",
    headers: { Authorization: `Bearer ${token}` },
    body:    form,
  });
  const json = await res.json();
  if (!res.ok) throw new Error((json as { error?: string }).error ?? "Upload failed");
  return json as VaultSingleResponse<HrDocument>;
}

export async function acknowledgeDocument(
  documentId: string,
  opts?: { signature?: string; notes?: string }
): Promise<VaultSingleResponse<DocAcknowledgement>> {
  return vaultFetch("/api/hr-documents/acknowledge", {
    method: "POST",
    body:   JSON.stringify({ documentId, ...opts }),
  });
}

export async function getAckStatus(
  documentId: string
): Promise<VaultSingleResponse<{ acknowledgedCount: number; acknowledgements: DocAcknowledgement[] }>> {
  return vaultFetch(`/api/hr-documents/${documentId}/ack-status`);
}

export async function updateDocumentStatus(
  id:     string,
  status: DocumentStatus
): Promise<VaultSingleResponse<HrDocument>> {
  return vaultFetch("/api/hr-documents/status", {
    method: "PATCH",
    body:   JSON.stringify({ id, status }),
  });
}

export async function getDocumentAlerts(): Promise<
  VaultSingleResponse<DocumentAlertsResult>
> {
  return vaultFetch("/api/hr-documents/alerts");
}

// ---------------------------------------------------------------------------
// Videos
// ---------------------------------------------------------------------------

export interface ListVideosParams {
  category?:   VideoCategory;
  isRequired?: boolean;
  search?:     string;
  page?:       number;
  limit?:      number;
}

export async function listVideos(
  params: ListVideosParams = {}
): Promise<VaultListResponse<HrVideo>> {
  const qs = new URLSearchParams();
  if (params.category)   qs.set("category",   params.category);
  if (params.search)     qs.set("search",     params.search);
  if (params.isRequired !== undefined)
    qs.set("isRequired", String(params.isRequired));
  if (params.page)       qs.set("page",       String(params.page));
  if (params.limit)      qs.set("limit",      String(params.limit));
  const q = qs.toString();
  return vaultFetch(`/api/hr-videos${q ? `?${q}` : ""}`);
}

export async function getVideo(
  id: string
): Promise<VaultSingleResponse<HrVideo>> {
  return vaultFetch(`/api/hr-videos/${id}`);
}

export async function saveWatchProgress(p: {
  videoId:        string;
  watchedSeconds: number;
  totalSeconds:   number;
  lastPosition:   number;
}): Promise<VaultSingleResponse<VideoWatchLog>> {
  return vaultFetch("/api/hr-videos/progress", {
    method: "POST",
    body:   JSON.stringify(p),
  });
}

export async function getWatchProgress(
  videoId: string
): Promise<VaultSingleResponse<VideoWatchLog>> {
  return vaultFetch(`/api/hr-videos/${videoId}/progress`);
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export interface VaultNotification {
  id:          string;
  userId:      string;
  documentId:  string | null;
  type:        "DOCUMENT_REMINDER";
  message:     string;
  isRead:      boolean;
  createdAt:   string;
}

export interface ListNotificationsParams {
  unread?: boolean;
  page?:   number;
  limit?:  number;
}

export async function listNotifications(
  params: ListNotificationsParams = {}
): Promise<VaultListResponse<VaultNotification>> {
  const qs = new URLSearchParams();
  if (params.unread)  qs.set("unread", "true");
  if (params.page)    qs.set("page",   String(params.page));
  if (params.limit)   qs.set("limit",  String(params.limit));
  const q = qs.toString();
  return vaultFetch(`/api/hr-notifications${q ? `?${q}` : ""}`);
}

export async function getNotificationCount(): Promise<
  VaultSingleResponse<{ unreadCount: number }>
> {
  return vaultFetch("/api/hr-notifications/count");
}

export async function markNotificationRead(
  id: string
): Promise<VaultSingleResponse<{ id: string; isRead: boolean }>> {
  return vaultFetch(`/api/hr-notifications/${id}/read`, { method: "PATCH" });
}

export async function markAllNotificationsRead(): Promise<
  VaultSingleResponse<{ markedRead: number }>
> {
  return vaultFetch("/api/hr-notifications/read-all", { method: "PATCH" });
}
