"use client";

import {
  Pencil,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  Globe,
  GlobeLock,
  MoreHorizontal,
} from "lucide-react";
import type { HomepageSectionAdminItem } from "@/lib/homepage/admin-queries";
import {
  APPROVAL_PUBLISH_ALLOWED,
  APPROVAL_STATUS_LABELS,
  type ApprovalStatus,
} from "@/lib/homepage/approval-constants";

type Props = {
  section: HomepageSectionAdminItem;
  isFirst: boolean;
  isLast: boolean;
  isPending: boolean;
  isAnyPending: boolean;
  onStartEdit: () => void;
  onToggle: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
};

export function HomepageCanvasToolbar({
  section,
  isFirst,
  isLast,
  isPending,
  isAnyPending,
  onStartEdit,
  onToggle,
  onMoveUp,
  onMoveDown,
  onPublish,
  onUnpublish,
}: Props) {
  const isBusy = isPending || isAnyPending;
  const approvalStatus = section.approvalStatus as ApprovalStatus;
  const canPublish = APPROVAL_PUBLISH_ALLOWED.has(approvalStatus);
  const isPublished = section.publishStatus === "PUBLISHED";

  return (
    <div
      className="flex items-center gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-md px-1.5 py-1"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Edit */}
      <button
        type="button"
        onClick={onStartEdit}
        disabled={isBusy}
        className="sce-icon-button text-[var(--text-2)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]"
        title="Bearbeiten"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>

      <span className="h-4 w-px bg-[var(--border)] mx-0.5" />

      {/* Visibility toggle */}
      <button
        type="button"
        onClick={onToggle}
        disabled={isBusy}
        className={`sce-icon-button hover:bg-[var(--surface-2)] ${
          section.isEnabled
            ? "text-emerald-600 hover:text-emerald-800"
            : "text-[var(--muted)] hover:text-[var(--foreground)]"
        }`}
        title={section.isEnabled ? "Deaktivieren" : "Aktivieren"}
      >
        {section.isEnabled ? (
          <Eye className="h-3.5 w-3.5" />
        ) : (
          <EyeOff className="h-3.5 w-3.5" />
        )}
      </button>

      <span className="h-4 w-px bg-[var(--border)] mx-0.5" />

      {/* Move up */}
      <button
        type="button"
        onClick={onMoveUp}
        disabled={isFirst || isBusy}
        className="sce-icon-button text-[var(--text-2)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)] disabled:opacity-30"
        title="Nach oben"
      >
        <ChevronUp className="h-3.5 w-3.5" />
      </button>

      {/* Move down */}
      <button
        type="button"
        onClick={onMoveDown}
        disabled={isLast || isBusy}
        className="sce-icon-button text-[var(--text-2)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)] disabled:opacity-30"
        title="Nach unten"
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </button>

      <span className="h-4 w-px bg-[var(--border)] mx-0.5" />

      {/* Publish / Unpublish */}
      {isPublished ? (
        <button
          type="button"
          onClick={onUnpublish}
          disabled={isBusy}
          className="sce-icon-button text-blue-600 hover:text-blue-800 hover:bg-[var(--surface-2)]"
          title="Aus Publikation zurückziehen"
        >
          <GlobeLock className="h-3.5 w-3.5" />
        </button>
      ) : (
        <button
          type="button"
          onClick={onPublish}
          disabled={isBusy || !canPublish}
          className={`sce-icon-button hover:bg-[var(--surface-2)] ${
            canPublish
              ? "text-[var(--muted)] hover:text-blue-600"
              : "text-rose-300 cursor-not-allowed"
          }`}
          title={
            !canPublish
              ? `Veröffentlichung blockiert: ${APPROVAL_STATUS_LABELS[approvalStatus]}`
              : "Veröffentlichen"
          }
        >
          <Globe className="h-3.5 w-3.5" />
        </button>
      )}

      <span className="h-4 w-px bg-[var(--border)] mx-0.5" />

      {/* More placeholder */}
      <button
        type="button"
        disabled
        className="sce-icon-button text-[var(--muted)] opacity-40 cursor-default"
        title="Weitere Aktionen (folgt in Slice E)"
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
