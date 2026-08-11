"use client";

import { useTranslations } from "next-intl";

import type { WorkspaceDocumentListItemDto } from "@/lib/workspace/document-dto";

import { WorkspaceDocumentRow } from "./WorkspaceDocumentRow";

type WorkspaceDocumentTableProps = {
  documents: WorkspaceDocumentListItemDto[];
  selectedDocumentId?: string | null;
  onSelectDocument?: (id: string) => void;
  /** ADMIN-DELETE-03A: resolved server-side from PERMISSIONS.WORKSPACE_DELETE. */
  canDelete?: boolean;
};

export function WorkspaceDocumentTable({
  documents,
  selectedDocumentId,
  onSelectDocument,
  canDelete = false,
}: WorkspaceDocumentTableProps) {
  const t = useTranslations("Workspace.table");

  if (documents.length === 0) {
    return null;
  }

  return (
    <div className="overflow-x-auto">
      <table
        className="w-full border-collapse text-left"
        role="grid"
        aria-label={t("tableAriaLabel")}
      >
        <thead>
          <tr className="border-b border-[var(--border)] text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            <th
              className="w-10 pl-4 pr-2 py-2.5"
            >
              <span className="sr-only">{t("fileTypeLabel")}</span>
            </th>
            <th className="px-2 py-2.5">{t("nameHeader")}</th>
            <th className="px-4 py-2.5">{t("modifiedHeader")}</th>
            <th className="px-4 py-2.5">{t("sizeHeader")}</th>
            <th className="px-4 py-2.5">{t("versionHeader")}</th>
            <th className="py-2.5 pl-2 pr-4 text-right">
              <span className="sr-only">{t("actionsHeader")}</span>
            </th>
          </tr>
        </thead>

        <tbody>
          {documents.map((document) => (
            <WorkspaceDocumentRow
              key={document.id}
              document={document}
              isSelected={selectedDocumentId === document.id}
              onSelect={onSelectDocument}
              canDelete={canDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
