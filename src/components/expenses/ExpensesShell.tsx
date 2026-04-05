"use client";

import { useState } from "react";
import { ExpenseForm } from "./ExpenseForm";
import { MyExpenses } from "./MyExpenses";

interface ClientOption  { id: string; name: string; }
interface ProjectOption { id: string; name: string; }

interface Props {
  clients:  ClientOption[];
  projects: ProjectOption[];
}

// ---------------------------------------------------------------------------
// ExpensesShell
//
// Thin client wrapper that owns the refreshKey counter.
// When the form successfully submits, incrementing refreshKey causes MyExpenses
// to re-fetch the latest list — no prop-drilling of mutation logic needed.
// ---------------------------------------------------------------------------

export function ExpensesShell({ clients, projects }: Props) {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="grid grid-cols-1 gap-8 xl:grid-cols-[480px_1fr]">
      {/* Left: submission form */}
      <div>
        <ExpenseForm
          clients={clients}
          projects={projects}
          onSuccess={() => setRefreshKey((k) => k + 1)}
        />
      </div>

      {/* Right: my expense history */}
      <div>
        <h2 className="mb-3 text-base font-bold text-gray-900">My Submissions</h2>
        <MyExpenses refreshKey={refreshKey} />
      </div>
    </div>
  );
}
