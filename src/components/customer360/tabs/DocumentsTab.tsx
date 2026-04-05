import { FolderLock, ExternalLink } from "lucide-react";
import Link from "next/link";

// Documents for customers are managed through the HR Vault.
// Client-scoped document storage is a planned enhancement.

export function DocumentsTab() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-purple-50">
        <FolderLock className="h-7 w-7 text-purple-500" />
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-700">
          Client Documents
        </p>
        <p className="mt-1 max-w-xs text-xs leading-relaxed text-gray-400">
          Client-specific document management is coming soon. For now, company-wide
          documents are stored in the Document Vault.
        </p>
      </div>
      <Link
        href="/vault"
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 shadow-sm transition-colors hover:bg-gray-50"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Open Document Vault
      </Link>
    </div>
  );
}
