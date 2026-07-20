"use client";

import { useState, useEffect } from "react";
import { Download, History } from "lucide-react";
import { useTranslations } from "next-intl";

import type { WorkspaceDocumentListItemDto } from "@/lib/workspace/document-dto";
import {
  resolveWorkspaceFileType,
  type WorkspaceFileCategory,
} from "@/lib/workspace/file-type-util";
import {
  formatWorkspaceDate,
  formatWorkspaceFileSize,
} from "@/components/admin/workspace/workspace-document-formatters";
import { WorkspaceFileIcon } from "@/components/admin/workspace/WorkspaceFileIcon";

type WorkspaceFilePreviewProps = {
  document: WorkspaceDocumentListItemDto;
  folderName?: string;
};

/* ─── Image preview ──────────────────────────────────────────────────── */

function ImagePreview({
  documentId,
  altText,
  notAvailableLabel,
}: {
  documentId: string;
  altText: string;
  notAvailableLabel: string;
}) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(
    "loading",
  );
  const previewUrl = `/api/workspace/documents/${encodeURIComponent(documentId)}/preview`;

  return (
    <div className="relative flex min-h-48 items-center justify-center overflow-hidden rounded-xl bg-[var(--surface-2)]">
      {status === "loading" ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--blue)]" />
        </div>
      ) : null}

      {status === "error" ? (
        <div className="flex flex-col items-center gap-2 p-6">
          <WorkspaceFileIcon category="image" size="xl" />
          <p className="text-xs text-[var(--muted)]">{notAvailableLabel}</p>
        </div>
      ) : null}

      <img
        src={previewUrl}
        alt={altText}
        className={`max-h-64 w-full object-contain transition-opacity duration-300 ${
          status === "loaded" ? "opacity-100" : "opacity-0"
        }`}
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("error")}
      />
    </div>
  );
}

/* ─── PDF preview ────────────────────────────────────────────────────── */

function PdfPreview({
  documentId,
  label,
  notAvailableHint,
}: {
  documentId: string;
  label: string;
  notAvailableHint: string;
}) {
  const [status, setStatus] = useState<"checking" | "available" | "unavailable">(
    "checking",
  );
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
      <div className="flex min-h-48 items-center justify-center rounded-xl bg-[var(--surface-2)]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--blue)]" />
      </div>
    );
  }

  if (status === "available") {
    return (
      <div className="overflow-hidden rounded-xl bg-[var(--surface-2)]">
        <iframe
          src={previewUrl}
          title={label}
          className="h-64 w-full"
          aria-label={`PDF-Vorschau: ${label}`}
          onError={() => setStatus("unavailable")}
        />
      </div>
    );
  }

  return (
    <DocumentPlaceholder
      category="pdf"
      label={label}
      hint={notAvailableHint}
    />
  );
}

/* ─── Premium document placeholder card ─────────────────────────────── */

function DocumentPlaceholder({
  category,
  label,
  hint,
  metaLine,
}: {
  category: WorkspaceFileCategory;
  label: string;
  hint: string;
  metaLine?: string;
}) {
  const CATEGORY_BG: Partial<Record<WorkspaceFileCategory, string>> = {
    pdf: "bg-red-50",
    word: "bg-blue-50",
    excel: "bg-green-50",
    powerpoint: "bg-orange-50",
    video: "bg-purple-50",
    audio: "bg-pink-50",
    archive: "bg-gray-50",
    text: "bg-slate-50",
    image: "bg-sky-50",
  };

  const bgClass = CATEGORY_BG[category] ?? "bg-[var(--surface-2)]";

  return (
    <div
      className={`flex flex-col items-center overflow-hidden rounded-xl border border-[var(--border)] ${bgClass}`}
    >
      {/* Icon zone */}
      <div className="flex flex-col items-center gap-2 px-6 py-7">
        <WorkspaceFileIcon category={category} size="xl" />
        <div className="text-center">
          <p className="text-sm font-semibold text-[var(--text)]">{label}</p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">{hint}</p>
        </div>
      </div>

      {/* Metadata strip */}
      {metaLine ? (
        <div className="w-full border-t border-[var(--border)] bg-white/60 px-5 py-2.5">
          <p className="text-center text-xs text-[var(--text-2)]">{metaLine}</p>
        </div>
      ) : null}
    </div>
  );
}

/* ─── Metadata row ───────────────────────────────────────────────────── */

function MetaRow({
  label,
  value,
  title,
}: {
  label: string;
  value: string;
  title?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
        {label}
      </dt>
      <dd className="text-xs font-medium text-[var(--text)]" title={title}>
        {value}
      </dd>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────── */

export function WorkspaceFilePreview({
  document,
  folderName,
}: WorkspaceFilePreviewProps) {
  const t = useTranslations("Workspace.preview");
  const ft = useTranslations("Workspace.fileTypes");

  const currentVersion = document.currentVersion;
  const mimeType = currentVersion?.mimeType ?? "application/octet-stream";
  const fileTypeInfo = resolveWorkspaceFileType(
    mimeType,
    currentVersion?.filename,
  );

  function getCategoryLabel(): string {
    switch (fileTypeInfo.category) {
      case "pdf":         return ft("pdf");
      case "word":        return ft("word");
      case "excel":       return ft("excel");
      case "powerpoint":  return ft("powerpoint");
      case "image":       return ft("image");
      case "video":       return ft("video");
      case "audio":       return ft("audio");
      case "archive":     return ft("archive");
      case "text":        return ft("text");
      default:            return ft("unknown");
    }
  }

  const categoryLabel = getCategoryLabel();
  const displayName = document.name;
  const versionLabel = currentVersion ? `v${currentVersion.versionNumber}` : "—";
  const sizeLabel = currentVersion
    ? formatWorkspaceFileSize(currentVersion.sizeBytes)
    : "—";
  const modifiedLabel = formatWorkspaceDate(document.updatedAt);
  const uploadedLabel = currentVersion
    ? formatWorkspaceDate(currentVersion.createdAt)
    : "—";

  const metaLine = currentVersion
    ? `${sizeLabel} · ${versionLabel} · ${modifiedLabel}`
    : undefined;

  function renderPreview() {
    if (fileTypeInfo.category === "image") {
      return (
        <ImagePreview
          documentId={document.id}
          altText={displayName}
          notAvailableLabel={t("previewNotAvailable")}
        />
      );
    }

    if (fileTypeInfo.category === "pdf") {
      return (
        <PdfPreview
          documentId={document.id}
          label={categoryLabel}
          notAvailableHint={t("previewNotAvailableHint")}
        />
      );
    }

    return (
      <DocumentPlaceholder
        category={fileTypeInfo.category}
        label={categoryLabel}
        hint={t("previewNotAvailableHint")}
        metaLine={metaLine}
      />
    );
  }

  function downloadDocument() {
    window.location.assign(
      `/api/workspace/documents/${encodeURIComponent(document.id)}/download`,
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Preview area */}
      <div className="shrink-0 px-4 pb-3 pt-4">{renderPreview()}</div>

      {/* Filename + type */}
      <div className="shrink-0 border-b border-[var(--border)] px-4 pb-3">
        <p
          className="break-words text-sm font-semibold leading-snug text-[var(--text)]"
          title={displayName}
        >
          {displayName}
        </p>
        <p className="mt-0.5 text-xs text-[var(--text-2)]">{categoryLabel}</p>
      </div>

      {/* Metadata */}
      <dl className="flex-1 overflow-y-auto px-4 py-3">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <MetaRow label={t("metaVersion")} value={versionLabel} />
            <MetaRow label={t("metaSize")} value={sizeLabel} />
            <MetaRow label={t("metaModified")} value={modifiedLabel} />
            <MetaRow label={t("metaUploaded")} value={uploadedLabel} />
          </div>

          {folderName ? (
            <MetaRow label={t("metaFolder")} value={folderName} />
          ) : null}

          {currentVersion?.filename &&
          currentVersion.filename !== document.name ? (
            <MetaRow
              label={t("metaFilename")}
              value={currentVersion.filename}
              title={currentVersion.filename}
            />
          ) : null}
        </div>
      </dl>

      {/* Actions */}
      <div className="shrink-0 border-t border-[var(--border)] px-4 pb-4 pt-3 space-y-2">
        <button
          type="button"
          disabled={!currentVersion}
          onClick={downloadDocument}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--blue)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-[var(--blue-hover)] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={`${t("downloadButton")}: ${displayName}`}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          {t("downloadButton")}
        </button>

        <button
          type="button"
          disabled
          title={t("versionHistoryHint")}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-xs font-medium text-[var(--muted)] transition-colors disabled:cursor-not-allowed"
          aria-label={t("versionHistoryHint")}
        >
          <History className="h-3.5 w-3.5" aria-hidden="true" />
          {t("versionHistoryButton")}
        </button>
      </div>
    </div>
  );
}
