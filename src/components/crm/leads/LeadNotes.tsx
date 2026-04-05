"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StickyNote, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { timeAgo, getInitials } from "@/lib/utils";
import type { LeadNote } from "@/modules/crm/types";

interface LeadNotesProps {
  leadId: string;
  notes: LeadNote[];
}

export function LeadNotes({ leadId, notes }: LeadNotesProps) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setLoading(true);
    try {
      await fetch(`/api/crm/leads/${leadId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, createdBy: "admin" }),
      });
      setContent("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Add note */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <Textarea
          placeholder="Write a note..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={2}
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" loading={loading}
            icon={<Send className="h-3.5 w-3.5" />}>
            Add Note
          </Button>
        </div>
      </form>

      {/* Notes list */}
      {notes.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center text-gray-400">
          <StickyNote className="mb-2 h-8 w-8" />
          <p className="text-sm">No notes yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div key={note.id} className="rounded-lg bg-gray-50 p-3">
              <div className="mb-1.5 flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">
                  {getInitials("A", "D")}
                </div>
                <span className="text-xs font-medium text-gray-700">{note.createdBy}</span>
                <span className="ml-auto text-[11px] text-gray-400">{timeAgo(note.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-gray-700">{note.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
