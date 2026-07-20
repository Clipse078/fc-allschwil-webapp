"use client";

import { UploadCloud } from "lucide-react";
import { useTranslations } from "next-intl";

type WorkspaceEmptyStateProps = {
  isDragging?: boolean;
  onUploadClick?: () => void;
  canManage?: boolean;
};

export function WorkspaceDocumentEmptyState({
  isDragging = false,
  onUploadClick,
  canManage = false,
}: WorkspaceEmptyStateProps) {
  const t = useTranslations("Workspace.emptyState");

  return (
    <div
      className={`flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center transition-colors ${
        isDragging ? "bg-[var(--blue-light)]" : ""
      }`}
      aria-live="polite"
    >
      <div
        className={`flex h-16 w-16 items-center justify-center rounded-2xl transition-colors ${
          isDragging
            ? "bg-[var(--blue)] text-white"
            : "bg-[var(--surface-2)] text-[var(--blue)]"
        }`}
      >
        <UploadCloud className="h-8 w-8" aria-hidden="true" />
      </div>

      <h2 className="mt-5 text-base font-semibold text-[var(--text)]">
        {t("title")}
      </h2>

      {canManage ? (
        <p className="mt-2 max-w-xs text-sm leading-6 text-[var(--text-2)]">
          {t("description")}
        </p>
      ) : null}

      {canManage && onUploadClick ? (
        <button
          type="button"
          onClick={onUploadClick}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[var(--blue)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--blue-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)]"
        >
          <UploadCloud className="h-4 w-4" aria-hidden="true" />
          {t("uploadButton")}
        </button>
      ) : null}
    </div>
  );
}
