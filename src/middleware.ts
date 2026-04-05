import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/signup"];

// ---------------------------------------------------------------------------
// Lightweight JWT expiry check — no crypto, no DB.
//
// The middleware runs on every request in the Edge runtime.  It cannot use
// Node.js crypto or Prisma, so we do a minimal structural decode to catch
// obviously expired or malformed tokens quickly — before the request reaches
// the DashboardLayout server component, which does the full DB-backed check.
//
// This is a FAST-PATH rejection only.  The authoritative check is in
// DashboardLayout (signature + DB revocation).  Never trust a token solely
// because this check passes.
// ---------------------------------------------------------------------------

function isTokenStructurallyValid(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;

    // Use atob() instead of Buffer.from() for Edge Runtime compatibility.
    // base64url → base64: replace - with + and _ with /
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(base64)) as { exp?: number; type?: string };

    // Must be a refresh token and must not be past its expiry
    if (payload.type !== "refresh") return false;
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return false;

    return true;
  } catch {
    return false;
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  const cookieValue = req.cookies.get("refresh_token")?.value ?? null;

  // A session is considered "present" only if the cookie exists AND passes
  // a basic structural / expiry check.  Malformed or expired cookies are
  // treated as no-session so stale cookies don't redirect users to /dashboard.
  const hasValidSession = !!cookieValue && isTokenStructurallyValid(cookieValue);

  if (isPublic) {
    // Logged-in user hitting /login → send to dashboard
    if (hasValidSession) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // Protected route — no valid session → redirect to /login, preserving the
  // intended destination so the login page can redirect back after success.
  if (!hasValidSession) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);

    const res = NextResponse.redirect(url);

    // If the cookie exists but is invalid/expired, delete it here so the
    // browser doesn't keep sending a useless cookie on every request.
    if (cookieValue && !hasValidSession) {
      res.cookies.set("refresh_token", "", {
        httpOnly: true,
        secure:   process.env.NODE_ENV === "production",
        sameSite: "lax",
        path:     "/",
        maxAge:   0,
        expires:  new Date(0),
      });
    }

    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|favicon.ico).*)"],
};
