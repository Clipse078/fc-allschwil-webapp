"use client";

import { useRouter } from "next/navigation";
import { useState, useRef } from "react";
import { CalendarClock, FolderClosed, FileText } from "lucide-react";

import type { WorkspaceDocumentListItemDto } from "@/lib/workspace/document-dto";
import type { BreadcrumbItem } from "@/lib/workspace/breadcrumbs";
import { workspaceDE } from "@/lib/workspace/workspace-i18n";

import { WorkspaceBreadcrumbs } from "./WorkspaceBreadcrumbs";
import { WorkspaceDocumentTable } from "./WorkspaceDocumentTable";
import { WorkspaceDocumentEmptyState } from "./WorkspaceDocumentEmptyState";
import { WorkspaceUploadButton } from "./WorkspaceUploadButton";
import { WorkspaceUploadDropzone } from "./WorkspaceUploadDropzone";
import { WorkspaceFilePreview } from "./WorkspaceFilePreview";

type WorkspaceClientShellProps = {
  documents: WorkspaceDocumentListItemDto[];
  folderId: string;
  folderName: string;
  folderDescription?: string | null;
  folderCreatedAt: string;
  folderUpdatedAt: string;
  folderPath: BreadcrumbItem[];
  canManage: boolean;
  /** JSX for folder management actions (Rename, Move, Archive) rendered server-side */
  folderManagementSlot?: React.ReactNode;
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("de-CH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function WorkspaceClientShell({
  documents,
  folderId,
  folderName,
  folderDescription,
  folderCreatedAt,
  folderUpdatedAt,
  folderPath,
  canManage,
  folderManagementSlot,
}: WorkspaceClientShellProps) {
  const t = workspaceDE;
  const router = useRouter();
  const [selectedDocumentId, setSelectedDocumentId] = useState<
    string | null
  >(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const dropzoneRef = useRef<HTMLDivElement>(null);

  const selectedDocument = documents.find(
    (d) => d.id === selectedDocumentId,
  ) ?? null;

  function handleUploadComplete(documentId: string | null) {
    if (documentId) {
      setSelectedDocumentId(documentId);
    }
    router.refresh();
  }

  function handleSelectDocument(id: string) {
    setSelectedDocumentId((current) =>
      current === id ? null : id,
    );
  }

  const hasDocuments = documents.length > 0;

  return (
    <>
      {/* ── Centre panel (document area) ────────────────────────── */}
      <section className="flex min-h-[520px] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
          <div className="min-w-0">
            <WorkspaceBreadcrumbs path={folderPath} />
            <p className="mt-1 text-xs text-[var(--muted)]">
              {documents.length === 1
                ? t.documents.countSingular
                : t.documents.countPlural(documents.length)}
            </p>
          </div>

          {canManage && hasDocuments ? (
            <WorkspaceUploadButton
              folderId={folderId}
              onUploadComplete={handleUploadComplete}
            />
          ) : null}
        </div>

        {/* Content */}
        <div className="relative flex-1">
          {/* Invisible drag overlay when documents exist */}
          {canManage && hasDocuments ? (
            <WorkspaceUploadDropzone
              folderId={folderId}
              onUploadComplete={handleUploadComplete}
              onDragStateChange={setIsDragOver}
            />
          ) : null}

          {hasDocuments ? (
            <div
              ref={dropzoneRef}
              className={`relative transition-colors ${
                isDragOver ? "bg-[var(--blue-light)]" : ""
              }`}
            >
              <WorkspaceDocumentTable
                documents={documents}
                selectedDocumentId={selectedDocumentId}
                onSelectDocument={handleSelectDocument}
              />
            </div>
          ) : (
            <WorkspaceDocumentEmptyState
              isDragging={isDragOver}
              canManage={canManage}
              onUploadClick={
                canManage
                  ? () =>
                      dropzoneRef.current
                        ?.querySelector<HTMLInputElement>(
                          'input[type="file"]',
                        )
                        ?.click()
                  : undefined
              }
            />
          )}
        </div>
      </section>

      {/* ── Right panel (file preview or folder details) ─────────── */}
      <aside className="flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        {/* Panel header */}
        <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border)] px-5 py-3.5">
          {selectedDocument ? (
            <FileText
              className="h-4 w-4 text-[var(--muted)]"
              aria-hidden="true"
            />
          ) : (
            <FolderClosed
              className="h-4 w-4 text-[var(--muted)]"
              aria-hidden="true"
            />
          )}
          <h2 className="text-sm font-semibold text-[var(--text)]">
            {selectedDocument
              ? t.preview.panelTitle
              : t.folderDetails.panelTitle}
          </h2>
        </div>

        {/* Panel content */}
        <div className="flex-1 overflow-y-auto">
          {selectedDocument ? (
            <WorkspaceFilePreview
              document={selectedDocument}
              folderName={folderName}
            />
          ) : (
            <div className="px-5 py-5">
              <dl className="space-y-4">
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                    {t.folderDetails.nameLabelTitle}
                  </dt>

                  {folderManagementSlot ? (
                    <dd className="mt-2">
                      {folderManagementSlot}
                    </dd>
                  ) : (
                    <dd className="mt-1 text-sm font-medium text-[var(--text)]">
                      {folderName}
                    </dd>
                  )}
                </div>

                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                    {t.folderDetails.descriptionLabel}
                  </dt>
                  <dd className="mt-1 text-sm text-[var(--text-2)]">
                    {folderDescription ||
                      t.folderDetails.noDescription}
                  </dd>
                </div>

                <div>
                  <dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                    <CalendarClock
                      className="h-3 w-3"
                      aria-hidden="true"
                    />
                    {t.folderDetails.createdLabel}
                  </dt>
                  <dd className="mt-1 text-sm text-[var(--text-2)]">
                    {formatDate(folderCreatedAt)}
                  </dd>
                </div>

                <div>
                  <dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                    <CalendarClock
                      className="h-3 w-3"
                      aria-hidden="true"
                    />
                    {t.folderDetails.updatedLabel}
                  </dt>
                  <dd className="mt-1 text-sm text-[var(--text-2)]">
                    {formatDate(folderUpdatedAt)}
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
