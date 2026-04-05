"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useRouter } from "next/navigation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthUser {
  id:         string;
  firstName:  string;
  lastName:   string;
  email:      string;
  role:       "OWNER" | "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "STAFF";
  department: string | null;
}

/** Discriminated union returned by login() — lets the caller branch on result. */
export type LoginResult =
  | { status: "success" }
  | { status: "mfa_required";          mfaPendingToken: string }
  | { status: "force_password_reset";  mfaPendingToken: string }
  | { status: "password_expired";      mfaPendingToken: string };

interface AuthState {
  user:        AuthUser | null;
  isLoading:   boolean;
  isLoggedIn:  boolean;
}

interface AuthContextValue extends AuthState {
  login:        (identifier: string, password: string, usePhone?: boolean) => Promise<LoginResult>;
  verifyOtp:    (mfaPendingToken: string, otp: string, trustDevice?: boolean) => Promise<void>;
  logout:       () => Promise<void>;
  getToken:     () => string | null;
  refreshToken: () => Promise<string | null>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  // Access token lives only in memory — never in localStorage/sessionStorage
  const tokenRef = useRef<string | null>(null);

  const [state, setState] = useState<AuthState>({
    user:       null,
    isLoading:  true,
    isLoggedIn: false,
  });

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  const setLoggedIn = useCallback((user: AuthUser, token: string) => {
    tokenRef.current = token;
    setState({ user, isLoading: false, isLoggedIn: true });
  }, []);

  const setLoggedOut = useCallback(() => {
    tokenRef.current = null;
    setState({ user: null, isLoading: false, isLoggedIn: false });
  }, []);

  // -------------------------------------------------------------------------
  // getToken — read the in-memory access token (used by api-client)
  // -------------------------------------------------------------------------

  const getToken = useCallback((): string | null => tokenRef.current, []);

  // -------------------------------------------------------------------------
  // refreshToken — silently restore session via httpOnly cookie
  // -------------------------------------------------------------------------

  const refreshToken = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch("/api/auth/refresh", { method: "POST" });
      if (!res.ok) return null;
      const json = await res.json() as {
        success:      boolean;
        accessToken?: string;
        user?:        AuthUser;
      };
      if (!json.success || !json.accessToken || !json.user) return null;
      setLoggedIn(json.user, json.accessToken);
      return json.accessToken;
    } catch {
      return null;
    }
  }, [setLoggedIn]);

  // -------------------------------------------------------------------------
  // On mount — two-step session restore:
  //   1. Exchange refresh cookie for a new access token
  //   2. Validate the full session via /api/auth/me (checks inactivity,
  //      account lock, and revocation — things the refresh route skips)
  //
  // Only setLoggedIn when BOTH steps succeed.
  // If step 2 fails the refresh cookie is cleared so the user is fully out.
  // -------------------------------------------------------------------------

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        // ── Step 1: refresh cookie → access token ──────────────────────────
        const refreshRes = await fetch("/api/auth/refresh", { method: "POST" });
        if (!active) return;

        if (!refreshRes.ok) { setLoggedOut(); return; }

        const refreshData = await refreshRes.json() as {
          success:      boolean;
          accessToken?: string;
        };
        if (!active) return;
        if (!refreshData.success || !refreshData.accessToken) { setLoggedOut(); return; }

        const token = refreshData.accessToken;

        // ── Step 2: validate full session via /api/auth/me ─────────────────
        // withAuth checks session inactivity + revocation + account lock/status.
        // A valid refresh token alone does NOT guarantee a usable session.
        const meRes = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!active) return;

        if (!meRes.ok) {
          // Session unusable — clear the cookie so next page load starts clean
          await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
          setLoggedOut();
          return;
        }

        const meData = await meRes.json() as { success: boolean; data?: AuthUser };
        if (!active) return;
        if (!meData.success || !meData.data) { setLoggedOut(); return; }

        setLoggedIn(meData.data, token);
      } catch {
        if (active) setLoggedOut();
      }
    })();

    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------------------------------------------------------
  // login — returns a LoginResult so the UI can branch (MFA, password reset…)
  // -------------------------------------------------------------------------

  const login = useCallback(
    async (identifier: string, password: string, usePhone = false): Promise<LoginResult> => {
      const res = await fetch("/api/auth/login", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ identifier, password, isPhone: usePhone }),
      });

      const json = await res.json() as {
        success:          boolean;
        code?:            string;
        error?:           string;
        mfaRequired?:     boolean;
        mfaPendingToken?: string;
        accessToken?:     string;
        user?:            AuthUser;
      };

      // ── Success ────────────────────────────────────────────────────────────
      if (res.ok && json.success && json.accessToken && json.user) {
        setLoggedIn(json.user, json.accessToken);
        return { status: "success" };
      }

      // ── MFA required (202) ─────────────────────────────────────────────────
      if (res.status === 202 && json.mfaRequired && json.mfaPendingToken) {
        return { status: "mfa_required", mfaPendingToken: json.mfaPendingToken };
      }

      // ── Force password reset ───────────────────────────────────────────────
      if (json.code === "FORCE_PASSWORD_RESET" && json.mfaPendingToken) {
        return { status: "force_password_reset", mfaPendingToken: json.mfaPendingToken };
      }

      // ── Password expired ───────────────────────────────────────────────────
      if (json.code === "PASSWORD_EXPIRED" && json.mfaPendingToken) {
        return { status: "password_expired", mfaPendingToken: json.mfaPendingToken };
      }

      // ── All other errors — surface message to UI ───────────────────────────
      throw new Error(json.error ?? "Login failed. Please try again.");
    },
    [setLoggedIn]
  );

  // -------------------------------------------------------------------------
  // verifyOtp — called after MFA_REQUIRED, issues final tokens on success
  // -------------------------------------------------------------------------

  const verifyOtp = useCallback(
    async (mfaPendingToken: string, otp: string, trustDevice = false): Promise<void> => {
      const res = await fetch("/api/auth/verify-otp", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ mfaPendingToken, otp, trustDevice }),
      });

      const json = await res.json() as {
        success:           boolean;
        error?:            string;
        code?:             string;
        attemptsRemaining?: number;
        accessToken?:      string;
        user?:             AuthUser;
      };

      if (res.ok && json.success && json.accessToken && json.user) {
        setLoggedIn(json.user, json.accessToken);
        return;
      }

      // Build a human-readable error, include remaining attempts if provided
      let message = json.error ?? "OTP verification failed";
      if (json.attemptsRemaining !== undefined) {
        message += ` (${json.attemptsRemaining} attempt${json.attemptsRemaining === 1 ? "" : "s"} remaining)`;
      }
      throw new Error(message);
    },
    [setLoggedIn]
  );

  // -------------------------------------------------------------------------
  // logout
  //
  // Order of operations:
  //   1. Tell the server to revoke the refresh token + session in DB and
  //      clear the httpOnly cookie via Set-Cookie in the response.
  //   2. Wipe all client-side state (in-memory token, React state).
  //   3. Clear localStorage and sessionStorage so no app state leaks.
  //   4. router.refresh() — invalidates the Next.js App Router RSC cache so
  //      stale dashboard pages are not served from memory on back-navigation.
  //   5. router.replace("/login") — replaces the current history entry so the
  //      browser Back button cannot return to /dashboard after logout.
  // -------------------------------------------------------------------------

  const logout = useCallback(async () => {
    // Step 1: server-side revocation + cookie clear
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Network error — still clear everything client-side.
      // The cookie will remain until the server processes the next request,
      // at which point DashboardLayout will catch the revoked session.
    }

    // Step 2: clear in-memory token + React state
    setLoggedOut();

    // Step 3: clear any localStorage / sessionStorage the app may have used
    if (typeof window !== "undefined") {
      localStorage.clear();
      sessionStorage.clear();
    }

    // Step 4: bust the Next.js router cache so stale RSC payloads are gone
    router.refresh();

    // Step 5: navigate to /login without adding dashboard to history
    router.replace("/login");
  }, [setLoggedOut, router]);

  // -------------------------------------------------------------------------
  // Value
  // -------------------------------------------------------------------------

  return (
    <AuthContext.Provider
      value={{ ...state, login, verifyOtp, logout, getToken, refreshToken }}
    >
      {children}
    </AuthContext.Provider>
  );
}
