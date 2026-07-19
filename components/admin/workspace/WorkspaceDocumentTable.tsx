import type { WorkspaceDocumentListItemDto } from "@/lib/workspace/document-dto";

import { WorkspaceDocumentEmptyState } from "./WorkspaceDocumentEmptyState";
import { WorkspaceDocumentRow } from "./WorkspaceDocumentRow";

type WorkspaceDocumentTableProps = {
  documents: WorkspaceDocumentListItemDto[];
};

export function WorkspaceDocumentTable({
  documents,
}: WorkspaceDocumentTableProps) {
  if (documents.length === 0) {
    return <WorkspaceDocumentEmptyState />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            <th className="w-12 px-4 py-3">
              <span className="sr-only">File type</span>
            </th>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Version</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Size</th>
            <th className="px-4 py-3">Updated</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>

        <tbody>
          {documents.map((document) => (
            <WorkspaceDocumentRow
              key={document.id}
              document={document}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}