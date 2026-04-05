import { cookies }    from "next/headers";
import { redirect }   from "next/navigation";
import { Sidebar }    from "@/components/layout/Sidebar";
import { Header }     from "@/components/layout/Header";
import { Toaster }    from "@/components/ui/Toaster";
import { verifyRefreshToken } from "@/lib/auth";
import { prisma }     from "@/lib/prisma";
import { REFRESH_COOKIE } from "@/lib/auth";

// Server Component — validates the refresh token from the httpOnly cookie.
// If missing or invalid → redirect to /login before rendering anything.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jar          = await cookies();
  const refreshToken = jar.get(REFRESH_COOKIE)?.value;

  if (!refreshToken) redirect("/login");

  console.log("[auth] dashboard layout — refresh_token present, verifying...");

  try {
    const payload = await verifyRefreshToken(refreshToken);

    // Check token is not revoked in DB
    const stored = await prisma.refreshToken.findUnique({
      where:  { jti: payload.jti },
      select: { revokedAt: true, expiresAt: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      // Cookie present but DB session revoked/expired — clear cookie via logout
      // route to prevent the middleware from bouncing the user in a redirect loop.
      redirect("/api/auth/logout");
    }
  } catch {
    // JWT invalid or expired — stale cookie, clear it via the logout route
    redirect("/api/auth/logout");
  }

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: "linear-gradient(135deg, #d25cf6 0%, #a855f7 100%)" }}
    >
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
      <Toaster />
    </div>
  );
}
