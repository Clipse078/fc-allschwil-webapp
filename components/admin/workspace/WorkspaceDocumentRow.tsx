import {
  File,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  Presentation,
} from "lucide-react";

import type { WorkspaceDocumentListItemDto } from "@/lib/workspace/document-dto";

import { WorkspaceDocumentActions } from "./WorkspaceDocumentActions";
import {
  formatWorkspaceDate,
  formatWorkspaceFileSize,
  getWorkspaceFileTypeLabel,
} from "./workspace-document-formatters";

type WorkspaceDocumentRowProps = {
  document: WorkspaceDocumentListItemDto;
};

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
            ? getWorkspaceFileTypeLabel(
                currentVersion.mimeType,
              )
            : "Unknown"}
        </span>
      </td>

      <td className="whitespace-nowrap px-4 py-3 text-sm text-[var(--text-2)]">
        {currentVersion
          ? formatWorkspaceFileSize(
              currentVersion.sizeBytes,
            )
          : "—"}
      </td>

      <td className="whitespace-nowrap px-4 py-3 text-sm text-[var(--text-2)]">
        {formatWorkspaceDate(document.updatedAt)}
      </td>

      <td className="px-4 py-3 text-right">
        <WorkspaceDocumentActions document={document} />
      </td>
    </tr>
  );
}