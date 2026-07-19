import { FileText } from "lucide-react";

export function WorkspaceDocumentEmptyState() {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-2)]">
        <FileText className="h-7 w-7 text-[var(--blue)]" />
      </div>

      <h2 className="mt-5 text-lg font-semibold text-[var(--text)]">
        No documents yet
      </h2>

      <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--text-2)]">
        Documents uploaded to this folder will appear here.
      </p>
    </div>
  );
}