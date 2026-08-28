"use client";

import { useRouter } from "next/navigation";
import {
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import {
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  FolderClosed,
  FolderOpen,
  Pencil,
  Trash2,
  Upload,
  UploadCloud,
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { WorkspaceFileIcon } from "@/components/admin/workspace/WorkspaceFileIcon";
import {
  deleteTeamDocument,
  getTeamDocumentDownloadPath,
  renameTeamDocument,
  TeamDocumentClientError,
  uploadTeamDocument,
} from "@/lib/teams/team-document-client";
import type { TeamDocumentListItem } from "@/lib/teams/team-document-list";

type Props = {
  teamId: string;
  documents: TeamDocumentListItem[];
  canManageDocuments: boolean;
};

function documentCountLabel(count: number): string {
  if (count === 1) return "1 Dokument";
  return `${count} Dokumente`;
}

function resolveClientError(error: unknown, fallback: string): string {
  if (error instanceof TeamDocumentClientError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

function TeamDocumentDesktopRow({
  document,
  isSelected,
  onSelect,
}: {
  document: TeamDocumentListItem;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  function handleRowClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.closest("button") || target.closest('[role="menu"]')) return;
    onSelect(document.id);
  }

  function handleRowKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(document.id);
    }
  }

  return (
    <tr
      data-testid={`team-document-row-${document.id}`}
      role="row"
      aria-selected={isSelected}
      tabIndex={0}
      className={[
        "cursor-pointer outline-none transition-colors duration-100",
        "border-t border-[var(--border)]",
        "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--sce-primary)]",
        isSelected
          ? "border-l-2 border-l-[var(--blue)] bg-[var(--blue-light)]"
          : "hover:bg-[var(--surface-2)]",
      ].join(" ")}
      onClick={handleRowClick}
      onKeyDown={handleRowKeyDown}
    >
      <td className="w-10 pl-4 pr-1 py-2.5">
        <WorkspaceFileIcon category={document.fileTypeCategory} size="md" />
      </td>
      <td className="min-w-0 px-2 py-2.5 align-top">
        <div className="min-w-0 space-y-0.5">
          <p
            className={[
              "text-sm font-medium leading-snug",
              isSelected ? "text-[var(--blue)]" : "text-[var(--text)]",
            ].join(" ")}
          >
            {document.title}
          </p>
          {document.showOriginalFilename ? (
            <p
              className="text-xs text-[var(--muted)]"
              data-testid={`team-document-filename-${document.id}`}
            >
              {document.originalFilename}
            </p>
          ) : (
            <p
              className="text-xs text-[var(--muted)]"
              data-testid={`team-document-type-${document.id}`}
            >
              {document.fileTypeLabel}
            </p>
          )}
        </div>
      </td>
      <td
        className="whitespace-nowrap px-4 py-2.5 text-xs text-[var(--text-2)]"
        data-testid={`team-document-date-${document.id}`}
      >
        {document.uploadedAtLabel}
      </td>
      <td
        className="whitespace-nowrap px-4 py-2.5 text-xs tabular-nums text-[var(--text-2)]"
        data-testid={`team-document-size-${document.id}`}
      >
        {document.sizeLabel}
      </td>
      <td
        className="px-4 py-2.5 text-xs text-[var(--text-2)]"
        data-testid={`team-document-uploader-${document.id}`}
      >
        {document.uploadedByLabel ?? "—"}
      </td>
    </tr>
  );
}

function TeamDocumentMobileItem({
  document,
  isSelected,
  onSelect,
}: {
  document: TeamDocumentListItem;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <li
      className={[
        "rounded-xl border bg-[var(--surface)] px-4 py-3 transition-colors",
        isSelected
          ? "border-[var(--blue)] bg-[var(--blue-light)]"
          : "border-[var(--border)]",
      ].join(" ")}
      data-testid={`team-document-mobile-${document.id}`}
    >
      <button
        type="button"
        className="w-full text-left"
        aria-pressed={isSelected}
        onClick={() => onSelect(document.id)}
        data-testid={`team-document-mobile-select-${document.id}`}
      >
        <article className="flex gap-3">
          <WorkspaceFileIcon
            category={document.fileTypeCategory}
            size="md"
            className="mt-0.5 shrink-0"
          />
          <div className="min-w-0 space-y-1.5">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">
              {document.title}
            </h3>
            {document.showOriginalFilename ? (
              <p
                className="text-xs text-[var(--muted)]"
                data-testid={`team-document-mobile-filename-${document.id}`}
              >
                {document.originalFilename}
              </p>
            ) : null}
            <p
              className="text-sm text-[var(--text-2)]"
              data-testid={`team-document-mobile-meta-${document.id}`}
            >
              <span data-testid={`team-document-mobile-type-${document.id}`}>
                {document.fileTypeLabel}
              </span>
              <span aria-hidden="true"> · </span>
              <span data-testid={`team-document-mobile-size-${document.id}`}>
                {document.sizeLabel}
              </span>
            </p>
            <p
              className="text-sm text-[var(--text-2)]"
              data-testid={`team-document-mobile-date-${document.id}`}
            >
              {document.uploadedAtLabel}
            </p>
            {document.uploadedByLabel ? (
              <p
                className="text-sm text-[var(--muted)]"
                data-testid={`team-document-mobile-uploader-${document.id}`}
              >
                Hochgeladen von {document.uploadedByLabel}
              </p>
            ) : null}
          </div>
        </article>
      </button>
    </li>
  );
}

function TeamDocumentsEmptyState({
  canManage,
  isUploading,
  isDragging,
  uploadError,
  onBrowse,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  canManage: boolean;
  isUploading: boolean;
  isDragging: boolean;
  uploadError: string | null;
  onBrowse: () => void;
  onDragEnter: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      className={[
        "flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center transition-colors",
        isDragging ? "bg-[var(--blue-light)]" : "",
      ].join(" ")}
      data-testid="team-documents-empty"
      onDragEnter={canManage ? onDragEnter : undefined}
      onDragOver={canManage ? onDragOver : undefined}
      onDragLeave={canManage ? onDragLeave : undefined}
      onDrop={canManage ? onDrop : undefined}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--surface-2)] text-[var(--blue)]">
        {canManage ? (
          <UploadCloud className="h-8 w-8" aria-hidden="true" />
        ) : (
          <FileText className="h-8 w-8" aria-hidden="true" />
        )}
      </div>
      <h3 className="mt-5 text-base font-semibold text-[var(--text)]">
        Keine Dokumente vorhanden.
      </h3>
      <p className="mt-2 max-w-xs text-sm leading-6 text-[var(--text-2)]">
        {canManage
          ? "Laden Sie die erste Datei für dieses Team hoch."
          : "Dateien für dieses Team werden hier angezeigt."}
      </p>
      {canManage ? (
        <div className="mt-6">
          <Button
            type="button"
            variant="primary"
            loading={isUploading}
            iconLeft={!isUploading ? <Upload className="h-4 w-4" /> : undefined}
            onClick={onBrowse}
            data-testid="team-documents-empty-upload-button"
          >
            {isUploading ? "Wird hochgeladen…" : "Datei hochladen"}
          </Button>
        </div>
      ) : null}
      {uploadError ? (
        <p
          role="alert"
          className="mt-4 max-w-sm text-sm text-[var(--sce-danger)]"
          data-testid="team-documents-upload-error"
        >
          {uploadError}
        </p>
      ) : null}
    </div>
  );
}

function TeamDocumentDetailsContent({
  document,
  canManageDocuments,
  onDownload,
  onRename,
  onDelete,
}: {
  document: TeamDocumentListItem;
  canManageDocuments: boolean;
  onDownload: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-5 px-5 py-5" data-testid="team-document-details-content">
      <div className="flex items-start gap-3">
        <WorkspaceFileIcon
          category={document.fileTypeCategory}
          size="lg"
          className="shrink-0"
        />
        <div className="min-w-0 space-y-1">
          <h4
            className="text-base font-semibold text-[var(--foreground)]"
            data-testid="team-document-details-title"
          >
            {document.title}
          </h4>
          {document.showOriginalFilename ? (
            <p className="text-xs text-[var(--muted)]">{document.originalFilename}</p>
          ) : null}
        </div>
      </div>

      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Dateityp
          </dt>
          <dd className="mt-1 text-[var(--text-2)]">{document.fileTypeLabel}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Grösse
          </dt>
          <dd className="mt-1 text-[var(--text-2)]">{document.sizeLabel}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Hochgeladen
          </dt>
          <dd className="mt-1 text-[var(--text-2)]">{document.uploadedAtLabel}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Von
          </dt>
          <dd className="mt-1 text-[var(--text-2)]">
            {document.uploadedByLabel ?? "—"}
          </dd>
        </div>
      </dl>

      <div className="space-y-2 border-t border-[var(--border)] pt-4">
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          iconLeft={<Download className="h-4 w-4" />}
          onClick={onDownload}
          data-testid="team-document-download-button"
        >
          Herunterladen / Öffnen
        </Button>

        {canManageDocuments ? (
          <>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              iconLeft={<Pencil className="h-4 w-4" />}
              onClick={onRename}
              data-testid="team-document-rename-button"
            >
              Umbenennen
            </Button>
            <Button
              type="button"
              variant="danger"
              className="w-full"
              iconLeft={<Trash2 className="h-4 w-4" />}
              onClick={onDelete}
              data-testid="team-document-delete-button"
            >
              Löschen
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}

/**
 * TEAM-COCKPIT-PREMIUM-01J-C — interactive team document workspace.
 */
export default function TeamDocumentsClientShell({
  teamId,
  documents,
  canManageDocuments,
}: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTitle, setRenameTitle] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const selectedDocument =
    documents.find((document) => document.id === selectedDocumentId) ?? null;

  function handleSelectDocument(id: string) {
    setSelectedDocumentId((current) => (current === id ? null : id));
  }

  function triggerUploadSuccess() {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    setUploadSuccess(true);
    successTimerRef.current = setTimeout(() => setUploadSuccess(false), 3000);
  }

  async function handleUpload(file: File) {
    if (isUploading) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const uploaded = await uploadTeamDocument(teamId, file);
      setSelectedDocumentId(uploaded.id);
      triggerUploadSuccess();
      router.refresh();
    } catch (error) {
      setUploadError(resolveClientError(error, "Upload fehlgeschlagen."));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    await handleUpload(file);
  }

  function openFilePicker() {
    if (!isUploading) fileInputRef.current?.click();
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (canManageDocuments && !isUploading) setIsDragging(true);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setIsDragging(false);
  }

  async function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    await handleUpload(file);
  }

  function handleDownload(documentId: string) {
    window.location.assign(getTeamDocumentDownloadPath(teamId, documentId));
  }

  function openRenameDialog() {
    if (!selectedDocument) return;
    setRenameTitle(selectedDocument.title);
    setRenameError(null);
    setRenameOpen(true);
  }

  async function handleRenameConfirm() {
    if (!selectedDocument) return;

    setIsRenaming(true);
    setRenameError(null);

    try {
      await renameTeamDocument(teamId, selectedDocument.id, renameTitle);
      setRenameOpen(false);
      router.refresh();
    } catch (error) {
      setRenameError(resolveClientError(error, "Umbenennen fehlgeschlagen."));
    } finally {
      setIsRenaming(false);
    }
  }

  function openDeleteDialog() {
    setDeleteError(null);
    setDeleteOpen(true);
  }

  async function handleDeleteConfirm() {
    if (!selectedDocument) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deleteTeamDocument(teamId, selectedDocument.id);
      setDeleteOpen(false);
      setSelectedDocumentId(null);
      router.refresh();
    } catch (error) {
      setDeleteError(resolveClientError(error, "Löschen fehlgeschlagen."));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-5" data-testid="team-documents-view">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--muted)]">
          Team Workspace
        </p>
        <h2
          className="text-lg font-semibold text-[var(--foreground)]"
          data-testid="team-documents-page-heading"
        >
          Dokumente
        </h2>
        <p className="text-sm text-[var(--muted)]">
          Teaminterne Dokumente und Dateien.
        </p>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        className="sr-only"
        aria-hidden="true"
        disabled={!canManageDocuments || isUploading}
        onChange={handleFileChange}
        data-testid="team-documents-file-input"
      />

      <div
        className="grid min-h-[620px] gap-4 xl:grid-cols-[240px_minmax(0,1fr)_340px]"
        data-testid="team-documents-workspace-grid"
      >
        <aside
          className="hidden flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] xl:flex"
          data-testid="team-documents-nav-panel"
        >
          <div className="shrink-0 border-b border-[var(--border)] px-3 py-3">
            <div className="flex items-center gap-2">
              <FolderClosed
                className="h-4 w-4 text-[var(--muted)]"
                aria-hidden="true"
              />
              <h3 className="text-sm font-semibold text-[var(--text)]">Ansicht</h3>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-2">
            <div
              className="flex items-center gap-2 rounded-md bg-[var(--blue)] px-2 py-1.5 text-sm font-semibold text-white"
              data-testid="team-documents-nav-all"
            >
              <FolderOpen className="h-3.5 w-3.5 shrink-0 text-white/80" aria-hidden="true" />
              <span>Alle Dokumente</span>
            </div>
          </div>
        </aside>

        <section
          className="flex min-h-[520px] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]"
          data-testid="team-documents-center-panel"
          onDragEnter={canManageDocuments ? handleDragEnter : undefined}
          onDragOver={canManageDocuments ? handleDragOver : undefined}
          onDragLeave={canManageDocuments ? handleDragLeave : undefined}
          onDrop={canManageDocuments ? handleDrop : undefined}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
            <div className="flex items-center gap-2">
              <p className="text-xs text-[var(--muted)]">
                {documentCountLabel(documents.length)}
              </p>
              {uploadSuccess ? (
                <span
                  className="flex items-center gap-1 text-xs font-medium text-[var(--sce-success)]"
                  data-testid="team-documents-upload-success"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Datei hochgeladen
                </span>
              ) : null}
            </div>

            {canManageDocuments && documents.length > 0 ? (
              <div>
                <Button
                  type="button"
                  variant="primary"
                  loading={isUploading}
                  disabled={isUploading}
                  iconLeft={!isUploading ? <Upload className="h-4 w-4" /> : undefined}
                  onClick={openFilePicker}
                  data-testid="team-documents-upload-button"
                >
                  {isUploading ? "Wird hochgeladen…" : "Datei hochladen"}
                </Button>
                {uploadError ? (
                  <p
                    role="alert"
                    className="mt-2 max-w-72 text-xs leading-5 text-[var(--sce-danger)]"
                    data-testid="team-documents-upload-error"
                  >
                    {uploadError}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div
            className={[
              "relative flex-1 transition-colors",
              isDragging ? "bg-[var(--blue-light)]" : "",
            ].join(" ")}
          >
            {isDragging ? (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2 rounded-xl bg-white/90 px-6 py-4 shadow-lg ring-1 ring-[var(--blue)]/20">
                  <p className="text-sm font-semibold text-[var(--blue)]">
                    Datei hier ablegen
                  </p>
                </div>
              </div>
            ) : null}

            {documents.length === 0 ? (
              <TeamDocumentsEmptyState
                canManage={canManageDocuments}
                isUploading={isUploading}
                isDragging={isDragging}
                uploadError={uploadError}
                onBrowse={openFilePicker}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              />
            ) : (
              <>
                <div
                  className="hidden overflow-x-auto xl:block"
                  data-testid="team-documents-table-wrapper"
                >
                  <table
                    className="w-full border-collapse text-left"
                    data-testid="team-documents-table"
                    role="grid"
                    aria-label="Teamdokumente"
                  >
                    <thead>
                      <tr className="border-b border-[var(--border)] text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                        <th className="w-10 pl-4 pr-2 py-2.5">
                          <span className="sr-only">Dateityp</span>
                        </th>
                        <th className="px-2 py-2.5" scope="col">
                          Name
                        </th>
                        <th className="px-4 py-2.5" scope="col">
                          Hochgeladen
                        </th>
                        <th className="px-4 py-2.5" scope="col">
                          Grösse
                        </th>
                        <th className="px-4 py-2.5" scope="col">
                          Von
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.map((document) => (
                        <TeamDocumentDesktopRow
                          key={document.id}
                          document={document}
                          isSelected={selectedDocumentId === document.id}
                          onSelect={handleSelectDocument}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                <ul
                  className="space-y-3 p-4 xl:hidden"
                  data-testid="team-documents-mobile-list"
                  aria-label="Teamdokumente"
                >
                  {documents.map((document) => (
                    <TeamDocumentMobileItem
                      key={document.id}
                      document={document}
                      isSelected={selectedDocumentId === document.id}
                      onSelect={handleSelectDocument}
                    />
                  ))}
                </ul>
              </>
            )}
          </div>
        </section>

        <aside
          className="hidden flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] xl:flex"
          data-testid="team-documents-details-panel"
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border)] px-5 py-3.5">
            {selectedDocument ? (
              <FileText className="h-4 w-4 text-[var(--muted)]" aria-hidden="true" />
            ) : (
              <FolderClosed className="h-4 w-4 text-[var(--muted)]" aria-hidden="true" />
            )}
            <h3 className="text-sm font-semibold text-[var(--text)]">Details</h3>
          </div>

          <div className="flex-1 overflow-y-auto">
            {selectedDocument ? (
              <TeamDocumentDetailsContent
                document={selectedDocument}
                canManageDocuments={canManageDocuments}
                onDownload={() => handleDownload(selectedDocument.id)}
                onRename={openRenameDialog}
                onDelete={openDeleteDialog}
              />
            ) : (
              <div className="flex flex-1 items-center justify-center px-5 py-8">
                <p
                  className="text-sm text-[var(--text-2)]"
                  data-testid="team-documents-no-selection"
                >
                  Kein Dokument ausgewählt.
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {selectedDocument ? (
        <section
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] xl:hidden"
          data-testid="team-documents-mobile-details"
        >
          <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
            <ExternalLink className="h-4 w-4 text-[var(--muted)]" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-[var(--text)]">Details & Aktionen</h3>
          </div>
          <TeamDocumentDetailsContent
            document={selectedDocument}
            canManageDocuments={canManageDocuments}
            onDownload={() => handleDownload(selectedDocument.id)}
            onRename={openRenameDialog}
            onDelete={openDeleteDialog}
          />
        </section>
      ) : null}

      <Dialog
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        title="Dokument umbenennen"
        description="Nur der Anzeigetitel wird geändert. Der Dateiname bleibt unverändert."
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenameOpen(false)}>
              Abbrechen
            </Button>
            <Button
              variant="primary"
              loading={isRenaming}
              onClick={handleRenameConfirm}
              data-testid="team-document-rename-confirm"
            >
              Speichern
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <label className="block text-sm font-medium text-[var(--text)]" htmlFor="team-document-rename-input">
            Titel
          </label>
          <input
            id="team-document-rename-input"
            type="text"
            value={renameTitle}
            onChange={(event) => setRenameTitle(event.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)]"
            data-testid="team-document-rename-input"
          />
          {renameError ? (
            <p role="alert" className="text-sm text-[var(--sce-danger)]">
              {renameError}
            </p>
          ) : null}
        </div>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={selectedDocument ? `„${selectedDocument.title}" löschen?` : "Dokument löschen?"}
        description="Diese Aktion kann nicht rückgängig gemacht werden."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
              Abbrechen
            </Button>
            <Button
              variant="danger"
              loading={isDeleting}
              onClick={handleDeleteConfirm}
              data-testid="team-document-delete-confirm"
            >
              Löschen
            </Button>
          </>
        }
      >
        {deleteError ? (
          <p role="alert" className="text-sm text-[var(--sce-danger)]">
            {deleteError}
          </p>
        ) : (
          <p className="text-sm text-[var(--text-2)]">
            Das Dokument wird dauerhaft aus dem Team-Workspace entfernt.
          </p>
        )}
      </Dialog>
    </div>
  );
}
