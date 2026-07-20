"use client";

import { useState, useEffect } from "react";
import { Download, History } from "lucide-react";

import type { WorkspaceDocumentListItemDto } from "@/lib/workspace/document-dto";
import {
  resolveWorkspaceFileType,
  type WorkspaceFileCategory,
} from "@/lib/workspace/file-type-util";
import {
  formatWorkspaceDate,
  formatWorkspaceFileSize,
} from "@/components/admin/workspace/workspace-document-formatters";
import { workspaceDE } from "@/lib/workspace/workspace-i18n";
import { WorkspaceFileIcon } from "@/components/admin/workspace/WorkspaceFileIcon";

type WorkspaceFilePreviewProps = {
  document: WorkspaceDocumentListItemDto;
  folderName?: string;
};

type PreviewAreaProps = {
  category: WorkspaceFileCategory;
  documentId: string;
  mimeType: string;
  altText: string;
  germanLabel: string;
};

function ImagePreview({
  documentId,
  altText,
}: {
  documentId: string;
  altText: string;
}) {
  const [status, setStatus] = useState<
    "loading" | "loaded" | "error"
  >("loading");
  const previewUrl = `/api/workspace/documents/${encodeURIComponent(documentId)}/preview`;

  if (status === "error") {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg bg-[var(--surface-2)] py-8">
        <WorkspaceFileIcon category="image" size="xl" />
        <p className="text-xs text-[var(--muted)]">
          {workspaceDE.preview.previewNotAvailable}
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex items-center justify-center overflow-hidden rounded-lg bg-[var(--surface-2)]">
      {status === "loading" ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--blue)]" />
        </div>
      ) : null}

      <img
        src={previewUrl}
        alt={altText}
        className={`max-h-56 w-full object-contain transition-opacity duration-200 ${
          status === "loaded" ? "opacity-100" : "opacity-0"
        }`}
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("error")}
      />
    </div>
  );
}

function PdfPreview({
  documentId,
  germanLabel,
}: {
  documentId: string;
  germanLabel: string;
}) {
  const [status, setStatus] = useState<
    "checking" | "available" | "unavailable"
  >("checking");
  const previewUrl = `/api/workspace/documents/${encodeURIComponent(documentId)}/preview`;

  useEffect(() => {
    let cancelled = false;

    fetch(previewUrl, { method: "HEAD" })
      .then((res) => {
        if (
          res.ok &&
          res.headers.get("content-type")?.startsWith("application/pdf")
        ) {
          if (!cancelled) setStatus("available");
        } else {
          if (!cancelled) setStatus("unavailable");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("unavailable");
      });

    return () => {
      cancelled = true;
    };
  }, [previewUrl]);

  if (status === "checking") {
    return (
      <div className="flex h-28 items-center justify-center rounded-lg bg-[var(--surface-2)]">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--blue)]" />
      </div>
    );
  }

  if (status === "unavailable") {
    return (
      <PlaceholderPreview
        category="pdf"
        germanLabel={germanLabel}
        hint={workspaceDE.preview.previewNotAvailableHint}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg bg-[var(--surface-2)]">
      <iframe
        src={previewUrl}
        title={germanLabel}
        className="h-56 w-full"
        aria-label={`PDF-Vorschau: ${germanLabel}`}
        onError={() => setStatus("unavailable")}
      />
    </div>
  );
}

function PlaceholderPreview({
  category,
  germanLabel,
  hint,
}: {
  category: WorkspaceFileCategory;
  germanLabel: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg bg-[var(--surface-2)] py-8">
      <WorkspaceFileIcon
        category={category}
        size="xl"
      />
      <div className="text-center">
        <p className="text-sm font-medium text-[var(--text)]">
          {germanLabel}
        </p>
        {hint ? (
          <p className="mt-1 text-xs text-[var(--muted)]">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function PreviewArea({
  category,
  documentId,
  mimeType,
  altText,
  germanLabel,
}: PreviewAreaProps) {
  if (category === "image") {
    return (
      <ImagePreview documentId={documentId} altText={altText} />
    );
  }

  if (category === "pdf") {
    return (
      <PdfPreview
        documentId={documentId}
        germanLabel={germanLabel}
      />
    );
  }

  return (
    <PlaceholderPreview
      category={category}
      germanLabel={germanLabel}
      hint={workspaceDE.preview.previewNotAvailableHint}
    />
  );
}

type MetaRowProps = {
  label: string;
  value: string;
  title?: string;
};

function MetaRow({ label, value, title }: MetaRowProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
        {label}
      </dt>
      <dd
        className="text-xs font-medium text-[var(--text)]"
        title={title}
      >
        {value}
      </dd>
    </div>
  );
}

function downloadDocument(documentId: string) {
  window.location.assign(
    `/api/workspace/documents/${encodeURIComponent(documentId)}/download`,
  );
}

export function WorkspaceFilePreview({
  document,
  folderName,
}: WorkspaceFilePreviewProps) {
  const t = workspaceDE.preview;
  const currentVersion = document.currentVersion;
  const mimeType =
    currentVersion?.mimeType ?? "application/octet-stream";
  const fileTypeInfo = resolveWorkspaceFileType(
    mimeType,
    currentVersion?.filename,
  );

  const displayName = document.name;
  const versionLabel = currentVersion
    ? `v${currentVersion.versionNumber}`
    : "—";
  const sizeLabel = currentVersion
    ? formatWorkspaceFileSize(currentVersion.sizeBytes)
    : "—";
  const modifiedLabel = formatWorkspaceDate(document.updatedAt);
  const uploadedLabel = currentVersion
    ? formatWorkspaceDate(currentVersion.createdAt)
    : "—";

  return (
    <div className="flex h-full flex-col">
      {/* Preview area */}
      <div className="shrink-0 px-4 pb-3 pt-4">
        <PreviewArea
          category={fileTypeInfo.category}
          documentId={document.id}
          mimeType={mimeType}
          altText={displayName}
          germanLabel={fileTypeInfo.germanLabel}
        />
      </div>

      {/* Filename */}
      <div className="shrink-0 border-b border-[var(--border)] px-4 pb-3">
        <p
          className="break-words text-sm font-semibold leading-tight text-[var(--text)]"
          title={displayName}
        >
          {displayName}
        </p>
        <p className="mt-0.5 text-xs text-[var(--text-2)]">
          {fileTypeInfo.germanLabel}
        </p>
      </div>

      {/* Metadata */}
      <dl className="flex-1 overflow-y-auto px-4 py-3">
        <div className="grid grid-cols-2 gap-3">
          <MetaRow
            label={t.labels.version}
            value={versionLabel}
          />
          <MetaRow
            label={t.labels.fileSize}
            value={sizeLabel}
          />
          <MetaRow
            label={t.labels.modified}
            value={modifiedLabel}
          />
          <MetaRow
            label={t.labels.uploaded}
            value={uploadedLabel}
          />
        </div>

        {folderName ? (
          <div className="mt-3">
            <MetaRow
              label={t.labels.folder}
              value={folderName}
            />
          </div>
        ) : null}

        {currentVersion?.filename &&
        currentVersion.filename !== document.name ? (
          <div className="mt-3">
            <MetaRow
              label={t.labels.filename}
              value={currentVersion.filename}
              title={currentVersion.filename}
            />
          </div>
        ) : null}
      </dl>

      {/* Actions */}
      <div className="shrink-0 border-t border-[var(--border)] px-4 pb-4 pt-3">
        <button
          type="button"
          disabled={!currentVersion}
          onClick={() => downloadDocument(document.id)}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--blue)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--blue-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={`${t.downloadButton}: ${displayName}`}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          {t.downloadButton}
        </button>

        {/* Future: version history (disabled placeholder) */}
        <button
          type="button"
          disabled
          title={t.futureActions.versionHistoryHint}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--muted)] transition-colors disabled:cursor-not-allowed"
          aria-label={t.futureActions.versionHistoryHint}
        >
          <History className="h-4 w-4" aria-hidden="true" />
          {t.futureActions.versionHistory}
        </button>
      </div>
    </div>
  );
}
