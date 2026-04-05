import { prisma } from "@/lib/prisma";
import { Receipt } from "lucide-react";
import { ExpensesShell } from "@/components/expenses/ExpensesShell";

// ---------------------------------------------------------------------------
// Page — server component
//
// Fetches client + project options once at request time and passes them down
// as plain props so the client form never needs to make extra round-trips.
// ---------------------------------------------------------------------------

export default async function StaffExpensesPage() {
  const [clients, projects] = await Promise.all([
    prisma.client.findMany({
      select: { id: true, firstName: true, lastName: true, company: true },
      orderBy: { firstName: "asc" },
      take: 200,
    }),
    prisma.project.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
  ]);

  const clientOptions = clients.map((c) => ({
    id:   c.id,
    name: c.company
      ? `${c.firstName} ${c.lastName} (${c.company})`
      : `${c.firstName} ${c.lastName}`,
  }));

  const projectOptions = projects.map((p) => ({ id: p.id, name: p.name }));

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 py-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
          <Receipt className="h-5 w-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Expenses</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Submit expense claims and track their approval status
          </p>
        </div>
      </div>

      {/* Client shell — owns refreshKey state, renders form + list side by side */}
      <ExpensesShell clients={clientOptions} projects={projectOptions} />
    </div>
  );
}
