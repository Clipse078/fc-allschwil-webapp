"use client";

import { useTranslations } from "next-intl";

import type { WorkspaceDocumentListItemDto } from "@/lib/workspace/document-dto";
import { resolveWorkspaceFileType } from "@/lib/workspace/file-type-util";

import { WorkspaceDocumentActions } from "./WorkspaceDocumentActions";
import { WorkspaceFileIcon } from "./WorkspaceFileIcon";
import {
  formatWorkspaceDate,
  formatWorkspaceFileSize,
} from "./workspace-document-formatters";

type WorkspaceDocumentRowProps = {
  document: WorkspaceDocumentListItemDto;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  /** ADMIN-DELETE-03A: resolved server-side from PERMISSIONS.WORKSPACE_DELETE. */
  canDelete?: boolean;
};

export function WorkspaceDocumentRow({
  document,
  isSelected = false,
  onSelect,
  canDelete = false,
}: WorkspaceDocumentRowProps) {
  const ft = useTranslations("Workspace.fileTypes");
  const currentVersion = document.currentVersion;
  const mimeType = currentVersion?.mimeType ?? "application/octet-stream";
  const fileTypeInfo = resolveWorkspaceFileType(mimeType, currentVersion?.filename);

  const displayName = document.name;

  function getCategoryLabel(): string {
    switch (fileTypeInfo.category) {
      case "pdf":        return ft("pdf");
      case "word":       return ft("word");
      case "excel":      return ft("excel");
      case "powerpoint": return ft("powerpoint");
      case "image":      return ft("image");
      case "video":      return ft("video");
      case "audio":      return ft("audio");
      case "archive":    return ft("archive");
      case "text":       return ft("text");
      default:           return ft("unknown");
    }
  }

  function handleRowClick(event: React.MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.closest("button") || target.closest('[role="menu"]')) return;
    onSelect?.(document.id);
  }

  function handleRowKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect?.(document.id);
    }
  }

  return (
    <tr
      role="row"
      aria-selected={isSelected}
      tabIndex={0}
      className={[
        "group cursor-pointer outline-none transition-colors duration-100",
        "border-t border-[var(--border)]",
        "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--sce-primary)]",
        isSelected
          ? "border-l-2 border-l-[var(--blue)] bg-[var(--blue-light)]"
          : "hover:bg-[var(--surface-2)]",
      ].join(" ")}
      onClick={handleRowClick}
      onKeyDown={handleRowKeyDown}
    >
      {/* Icon */}
      <td className="w-10 pl-4 pr-1 py-2.5">
        <WorkspaceFileIcon category={fileTypeInfo.category} size="md" />
      </td>

      {/* Name + subtext */}
      <td className="min-w-0 px-2 py-2.5">
        <div className="min-w-0">
          <p
            className={[
              "max-w-64 truncate text-sm font-medium leading-snug transition-colors duration-100",
              isSelected ? "text-[var(--blue)]" : "text-[var(--text)] group-hover:text-[var(--blue)]",
            ].join(" ")}
            title={displayName.length > 36 ? displayName : undefined}
          >
            {displayName}
          </p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            {getCategoryLabel()}
          </p>
        </div>
      </td>

      {/* Modified */}
      <td className="whitespace-nowrap px-4 py-2.5 text-xs text-[var(--text-2)]">
        {formatWorkspaceDate(document.updatedAt)}
      </td>

      {/* Size */}
      <td className="whitespace-nowrap px-4 py-2.5 text-xs tabular-nums text-[var(--text-2)]">
        {currentVersion ? formatWorkspaceFileSize(currentVersion.sizeBytes) : "—"}
      </td>

      {/* Version */}
      <td className="whitespace-nowrap px-4 py-2.5 text-xs tabular-nums text-[var(--muted)]">
        {currentVersion ? `v${currentVersion.versionNumber}` : "—"}
      </td>

      {/* Actions */}
      <td
        className="py-2.5 pl-2 pr-4 text-right"
        onClick={(e) => e.stopPropagation()}
      >
        <WorkspaceDocumentActions
          document={document}
          onSelect={() => onSelect?.(document.id)}
          canDelete={canDelete}
        />
      </td>
    </tr>
  );
}
