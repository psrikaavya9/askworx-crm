import { redirect } from "next/navigation";

// This page maps to "/" inside the (dashboard) route group.
// DashboardLayout (the group's layout.tsx) has already validated the session
// before this component runs — so we just forward to the dashboard home.
export default function DashboardRootPage() {
  redirect("/dashboard");
}
