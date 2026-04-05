"use client";

// ---------------------------------------------------------------------------
// api-client.ts — Fetch wrapper with automatic token refresh on 401
//
// Usage:
//   import { apiClient } from "@/lib/api-client";
//   const data = await apiClient.get("/api/staff");
//   const result = await apiClient.post("/api/leads", body);
// ---------------------------------------------------------------------------

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestOptions {
  body?:    unknown;
  headers?: Record<string, string>;
  // Pass the token getter and refresher from AuthContext
  getToken:     () => string | null;
  refreshToken: () => Promise<string | null>;
  onAuthFailure?: () => void;   // called if refresh also fails (e.g. redirect to login)
}

async function request<T>(
  method:  HttpMethod,
  url:     string,
  options: RequestOptions
): Promise<T> {
  const { body, headers = {}, getToken, refreshToken, onAuthFailure } = options;

  const buildHeaders = (token: string | null): HeadersInit => ({
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  });

  // First attempt
  let res = await fetch(url, {
    method,
    headers: buildHeaders(getToken()),
    body:    body !== undefined ? JSON.stringify(body) : undefined,
  });

  // If 401 — try to refresh the token once, then retry
  if (res.status === 401) {
    const json = await res.json().catch(() => ({})) as { code?: string };
    const shouldRefresh = json.code === "TOKEN_EXPIRED" || json.code === "MISSING_TOKEN";

    if (shouldRefresh) {
      const newToken = await refreshToken();

      if (newToken) {
        // Retry original request with new token
        res = await fetch(url, {
          method,
          headers: buildHeaders(newToken),
          body:    body !== undefined ? JSON.stringify(body) : undefined,
        });
      } else {
        // Refresh failed — force logout
        onAuthFailure?.();
        throw new Error("Session expired. Please log in again.");
      }
    }
  }

  const data = await res.json() as T;

  if (!res.ok) {
    const errData = data as { error?: string };
    throw new Error(errData.error ?? `HTTP ${res.status}`);
  }

  return data;
}

// ---------------------------------------------------------------------------
// createApiClient — factory used inside components/hooks
//
// Usage inside a component:
//   const { getToken, refreshToken, logout } = useAuth();
//   const client = createApiClient(getToken, refreshToken, logout);
//   const staff  = await client.get("/api/staff");
// ---------------------------------------------------------------------------

export function createApiClient(
  getToken:     () => string | null,
  refreshToken: () => Promise<string | null>,
  onAuthFailure?: () => void
) {
  const opts = (extra?: Partial<RequestOptions>): RequestOptions => ({
    getToken,
    refreshToken,
    onAuthFailure,
    ...extra,
  });

  return {
    get: <T = unknown>(url: string, extra?: Partial<RequestOptions>) =>
      request<T>("GET",    url, opts(extra)),

    post: <T = unknown>(url: string, body?: unknown, extra?: Partial<RequestOptions>) =>
      request<T>("POST",   url, { ...opts(extra), body }),

    put: <T = unknown>(url: string, body?: unknown, extra?: Partial<RequestOptions>) =>
      request<T>("PUT",    url, { ...opts(extra), body }),

    patch: <T = unknown>(url: string, body?: unknown, extra?: Partial<RequestOptions>) =>
      request<T>("PATCH",  url, { ...opts(extra), body }),

    delete: <T = unknown>(url: string, extra?: Partial<RequestOptions>) =>
      request<T>("DELETE", url, opts(extra)),
  };
}

// ---------------------------------------------------------------------------
// useApiClient hook — convenience hook that wires up auth automatically
// ---------------------------------------------------------------------------

import { useAuth } from "@/contexts/AuthContext";
import { useMemo } from "react";

export function useApiClient() {
  const { getToken, refreshToken, logout } = useAuth();

  return useMemo(
    () => createApiClient(getToken, refreshToken, logout),
    [getToken, refreshToken, logout]
  );
}
