import {
  Download,
  File,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  History,
  Pencil,
  Presentation,
  Trash2,
} from "lucide-react";

import type { WorkspaceDocumentListItemDto } from "@/lib/workspace/document-dto";

type WorkspaceDocumentRowProps = {
  document: WorkspaceDocumentListItemDto;
};

function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  const units = ["KB", "MB", "GB", "TB"];
  let size = sizeBytes / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const precision = size >= 10 ? 0 : 1;

  return `${size.toFixed(precision)} ${units[unitIndex]}`;
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("de-CH", {
    dateStyle: "medium",
  }).format(value);
}

function renderFileIcon(mimeType: string) {
  const className = "h-5 w-5 text-[var(--blue)]";

  if (mimeType.startsWith("image/")) {
    return <FileImage className={className} />;
  }

  if (
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    mimeType === "text/csv"
  ) {
    return <FileSpreadsheet className={className} />;
  }

  if (
    mimeType.includes("presentation") ||
    mimeType.includes("powerpoint")
  ) {
    return <Presentation className={className} />;
  }

  if (
    mimeType.includes("zip") ||
    mimeType.includes("compressed") ||
    mimeType.includes("archive")
  ) {
    return <FileArchive className={className} />;
  }

  if (
    mimeType.includes("pdf") ||
    mimeType.startsWith("text/") ||
    mimeType.includes("word") ||
    mimeType.includes("document")
  ) {
    return <FileText className={className} />;
  }

  return <File className={className} />;
}

function getTypeLabel(mimeType: string): string {
  const parts = mimeType.split("/");

  return parts.at(-1)?.replaceAll(".", " ").toUpperCase() || mimeType;
}

const disabledActionClassName =
  "inline-flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted)] opacity-50";

export function WorkspaceDocumentRow({
  document,
}: WorkspaceDocumentRowProps) {
  const currentVersion = document.currentVersion;
  const mimeType =
    currentVersion?.mimeType ?? "application/octet-stream";

  return (
    <tr className="border-t border-[var(--border)]">
      <td className="px-4 py-3">
        {renderFileIcon(mimeType)}
      </td>

      <td className="min-w-56 px-4 py-3">
        <p className="font-medium text-[var(--text)]">
          {document.name}
        </p>

        {currentVersion?.filename &&
        currentVersion.filename !== document.name ? (
          <p className="mt-0.5 max-w-72 truncate text-xs text-[var(--muted)]">
            {currentVersion.filename}
          </p>
        ) : null}
      </td>

      <td className="whitespace-nowrap px-4 py-3 text-sm text-[var(--text-2)]">
        {currentVersion
          ? `v${currentVersion.versionNumber}`
          : "—"}
      </td>

      <td className="max-w-48 px-4 py-3 text-sm text-[var(--text-2)]">
        <span title={currentVersion?.mimeType}>
          {currentVersion
            ? getTypeLabel(currentVersion.mimeType)
            : "Unknown"}
        </span>
      </td>

      <td className="whitespace-nowrap px-4 py-3 text-sm text-[var(--text-2)]">
        {currentVersion
          ? formatFileSize(currentVersion.sizeBytes)
          : "—"}
      </td>

      <td className="whitespace-nowrap px-4 py-3 text-sm text-[var(--text-2)]">
        {formatDate(document.updatedAt)}
      </td>

      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            disabled
            title="Download"
            aria-label={`Download ${document.name}`}
            className={disabledActionClassName}
          >
            <Download className="h-4 w-4" />
          </button>

          <button
            type="button"
            disabled
            title="Version history"
            aria-label={`Version history for ${document.name}`}
            className={disabledActionClassName}
          >
            <History className="h-4 w-4" />
          </button>

          <button
            type="button"
            disabled
            title="Rename"
            aria-label={`Rename ${document.name}`}
            className={disabledActionClassName}
          >
            <Pencil className="h-4 w-4" />
          </button>

          <button
            type="button"
            disabled
            title="Delete"
            aria-label={`Delete ${document.name}`}
            className={disabledActionClassName}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}