"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { DuplicateWarningModal } from "./DuplicateWarningModal";
import type { DuplicateMatch } from "@/modules/crm/services/duplicate.service";

// ─── Static option lists ──────────────────────────────────────────────────────

const STAGE_OPTIONS = [
  { value: "NEW",       label: "New"       },
  { value: "CONTACTED", label: "Contacted" },
  { value: "QUALIFIED", label: "Qualified" },
  { value: "PROPOSAL",  label: "Proposal"  },
];

const SOURCE_OPTIONS = [
  { value: "WEBSITE",        label: "Website"        },
  { value: "REFERRAL",       label: "Referral"       },
  { value: "SOCIAL_MEDIA",   label: "Social Media"   },
  { value: "EMAIL_CAMPAIGN", label: "Email Campaign" },
  { value: "COLD_CALL",      label: "Cold Call"      },
  { value: "TRADE_SHOW",     label: "Trade Show"     },
  { value: "PARTNER",        label: "Partner"        },
  { value: "OTHER",          label: "Other"          },
];

const PRIORITY_OPTIONS = [
  { value: "LOW",    label: "Low"    },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH",   label: "High"   },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreateLeadModalProps {
  open:    boolean;
  onClose: () => void;
}

type FormState = {
  firstName: string; lastName: string;
  email:     string; phone: string;
  company:   string; jobTitle: string;
  source:    string; stage: string; priority: string;
  dealValue: string;
};

const EMPTY_FORM: FormState = {
  firstName: "", lastName: "", email: "", phone: "",
  company: "", jobTitle: "",
  source: "WEBSITE", stage: "NEW", priority: "MEDIUM",
  dealValue: "",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function CreateLeadModal({ open, onClose }: CreateLeadModalProps) {
  const router  = useRouter();
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");
  const [form,         setForm]         = useState<FormState>(EMPTY_FORM);
  const [dupMatches,   setDupMatches]   = useState<DuplicateMatch[]>([]);
  const [showDupModal, setShowDupModal] = useState(false);

  function set(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function buildBody(extra?: Record<string, unknown>) {
    return {
      firstName: form.firstName,
      lastName:  form.lastName,
      email:     form.email,
      phone:     form.phone    || undefined,
      company:   form.company  || undefined,
      jobTitle:  form.jobTitle || undefined,
      source:    form.source,
      stage:     form.stage,
      priority:  form.priority,
      dealValue: form.dealValue ? Number(form.dealValue) : undefined,
      ...extra,
    };
  }

  /**
   * Core submit helper — handles both normal and forced creation.
   *
   * `force=true`  bypasses the duplicate guard (logged as DUPLICATE_FLAGGED).
   * `duplicateIds` are the IDs of the known matches, used for the audit trail.
   */
  async function submit(force = false, duplicateIds: string[] = []) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/crm/leads", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(buildBody({ force, duplicateIds })),
      });

      const data = await res.json() as Record<string, unknown>;

      if (!res.ok) {
        // ── Duplicate detected — open the warning modal ───────────────
        if (res.status === 409 && data.duplicate === true) {
          setDupMatches(data.matches as DuplicateMatch[]);
          setShowDupModal(true);
          return; // keep create modal visible behind the dup modal
        }
        throw new Error(typeof data.error === "string" ? data.error : "Failed to create lead");
      }

      router.refresh();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submit(false);
  }

  /** User clicked "Create anyway" in the duplicate modal. */
  async function handleForceCreate(duplicateIds: string[]) {
    setShowDupModal(false);
    await submit(true, duplicateIds);
  }

  /**
   * User clicked "Merge into selected" in the duplicate modal.
   * Since the new lead hasn't been created yet, we navigate the user to the
   * selected existing lead so they can merge/update data there directly.
   */
  function handleMerge(targetId: string) {
    setShowDupModal(false);
    handleClose();
    router.push(`/crm/leads/${targetId}`);
  }

  function handleClose() {
    setForm(EMPTY_FORM);
    setError("");
    setDupMatches([]);
    setShowDupModal(false);
    onClose();
  }

  return (
    <>
      {/* ── Create Lead form modal ──────────────────────────────────── */}
      <Modal open={open} onClose={handleClose} title="Add New Lead" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First Name" required
              value={form.firstName}
              onChange={(e) => set("firstName", e.target.value)}
              placeholder="John"
            />
            <Input
              label="Last Name" required
              value={form.lastName}
              onChange={(e) => set("lastName", e.target.value)}
              placeholder="Smith"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Email" type="email" required
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="john@company.com"
            />
            <Input
              label="Phone"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+1 555 000 0000"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Company"
              value={form.company}
              onChange={(e) => set("company", e.target.value)}
              placeholder="Acme Corp"
            />
            <Input
              label="Job Title"
              value={form.jobTitle}
              onChange={(e) => set("jobTitle", e.target.value)}
              placeholder="CEO"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Select
              label="Source"
              value={form.source}
              options={SOURCE_OPTIONS}
              onChange={(e) => set("source", e.target.value)}
            />
            <Select
              label="Stage"
              value={form.stage}
              options={STAGE_OPTIONS}
              onChange={(e) => set("stage", e.target.value)}
            />
            <Select
              label="Priority"
              value={form.priority}
              options={PRIORITY_OPTIONS}
              onChange={(e) => set("priority", e.target.value)}
            />
          </div>

          <Input
            label="Deal Value (USD)" type="number" min="0"
            value={form.dealValue}
            onChange={(e) => set("dealValue", e.target.value)}
            placeholder="5000"
          />

          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <Button type="button" variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              Create Lead
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Duplicate warning modal ─────────────────────────────────── */}
      <DuplicateWarningModal
        open={showDupModal}
        matches={dupMatches}
        onClose={() => setShowDupModal(false)}
        onForceCreate={handleForceCreate}
        onMerge={handleMerge}
      />
    </>
  );
}
