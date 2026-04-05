import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { REFRESH_COOKIE, verifyRefreshToken } from "@/lib/auth";
import { validateSession } from "@/lib/session";

// Root page — validates the refresh token and active session server-side.
// Avoids relying on cookie presence alone: checks JWT signature/expiry and
// confirms the session has not been revoked or gone idle in the DB.
export default async function RootPage() {
  const jar = await cookies();
  const rawToken = jar.get(REFRESH_COOKIE)?.value;

  if (!rawToken) {
    // No cookie — safe to redirect directly (middleware won't loop with no cookie)
    redirect("/login");
  }

  console.log("[auth] root page — refresh_token present, verifying...");

  try {
    const payload = await verifyRefreshToken(rawToken);
    const session = await validateSession(payload.jti);

    if (!session.valid) {
      // Cookie present but session revoked/expired in DB — must clear cookie first
      // to prevent middleware from bouncing the user back here in a redirect loop.
      redirect("/api/auth/logout");
    }
  } catch {
    // Token tampered or expired — cookie is stale, clear it via the logout route
    redirect("/api/auth/logout");
  }

  redirect("/dashboard");
}
