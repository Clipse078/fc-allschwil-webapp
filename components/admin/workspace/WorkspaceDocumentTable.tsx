import type { WorkspaceDocumentListItemDto } from "@/lib/workspace/document-dto";
import { workspaceDE } from "@/lib/workspace/workspace-i18n";

import { WorkspaceDocumentRow } from "./WorkspaceDocumentRow";

const t = workspaceDE.table;

type WorkspaceDocumentTableProps = {
  documents: WorkspaceDocumentListItemDto[];
  selectedDocumentId?: string | null;
  onSelectDocument?: (id: string) => void;
};

export function WorkspaceDocumentTable({
  documents,
  selectedDocumentId,
  onSelectDocument,
}: WorkspaceDocumentTableProps) {
  if (documents.length === 0) {
    return null;
  }

  return (
    <div className="overflow-x-auto">
      <table
        className="w-full border-collapse text-left"
        role="grid"
        aria-label="Dokumente"
      >
        <thead>
          <tr className="border-b border-[var(--border)] text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            <th
              className="w-10 pl-4 pr-2 py-2.5"
              aria-label={t.fileTypeLabel}
            >
              <span className="sr-only">{t.fileTypeLabel}</span>
            </th>
            <th className="px-2 py-2.5">{t.name}</th>
            <th className="px-4 py-2.5">{t.modified}</th>
            <th className="px-4 py-2.5">{t.size}</th>
            <th className="px-4 py-2.5">{t.version}</th>
            <th className="py-2.5 pl-2 pr-4 text-right">
              <span className="sr-only">{t.actions}</span>
            </th>
          </tr>
        </thead>

        <tbody>
          {documents.map((document) => (
            <WorkspaceDocumentRow
              key={document.id}
              document={document}
              isSelected={
                selectedDocumentId === document.id
              }
              onSelect={onSelectDocument}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
