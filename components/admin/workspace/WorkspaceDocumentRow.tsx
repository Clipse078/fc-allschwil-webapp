"use client";

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
};

export function WorkspaceDocumentRow({
  document,
  isSelected = false,
  onSelect,
}: WorkspaceDocumentRowProps) {
  const currentVersion = document.currentVersion;
  const mimeType =
    currentVersion?.mimeType ?? "application/octet-stream";
  const fileTypeInfo = resolveWorkspaceFileType(
    mimeType,
    currentVersion?.filename,
  );

  const displayName = document.name;
  const hasLongName = displayName.length > 40;

  function handleRowClick(event: React.MouseEvent) {
    // Do not trigger row selection when clicking actions button
    const target = event.target as HTMLElement;

    if (
      target.closest("button") ||
      target.closest('[role="menu"]')
    ) {
      return;
    }

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
      className={`group cursor-pointer border-t border-[var(--border)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--sce-primary)] ${
        isSelected
          ? "bg-[var(--blue-light)]"
          : "hover:bg-[var(--surface-2)]"
      }`}
      onClick={handleRowClick}
      onKeyDown={handleRowKeyDown}
    >
      {/* Icon */}
      <td className="w-10 pl-4 pr-2 py-3">
        <WorkspaceFileIcon
          category={fileTypeInfo.category}
          size="md"
        />
      </td>

      {/* Name + subtext */}
      <td className="min-w-0 flex-1 px-2 py-3">
        <div className="min-w-0">
          <p
            className={`max-w-64 truncate text-sm font-medium leading-snug transition-colors ${
              isSelected
                ? "text-[var(--blue)]"
                : "text-[var(--text)]"
            }`}
            title={hasLongName ? displayName : undefined}
          >
            {displayName}
          </p>
          <p className="mt-0.5 text-xs text-[var(--text-2)]">
            {fileTypeInfo.germanLabel}
          </p>
        </div>
      </td>

      {/* Modified */}
      <td className="whitespace-nowrap px-4 py-3 text-xs text-[var(--text-2)]">
        {formatWorkspaceDate(document.updatedAt)}
      </td>

      {/* Size */}
      <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums text-[var(--text-2)]">
        {currentVersion
          ? formatWorkspaceFileSize(currentVersion.sizeBytes)
          : "—"}
      </td>

      {/* Version */}
      <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums text-[var(--muted)]">
        {currentVersion ? `v${currentVersion.versionNumber}` : "—"}
      </td>

      {/* Actions */}
      <td
        className="py-3 pl-2 pr-4 text-right"
        onClick={(e) => e.stopPropagation()}
      >
        <WorkspaceDocumentActions
          document={document}
          onSelect={() => onSelect?.(document.id)}
        />
      </td>
    </tr>
  );
}
