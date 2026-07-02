"use client";

import {
  Pencil,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  Globe,
  GlobeLock,
  Copy,
  Trash2,
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
  /** Duplicate the section (creates a copy as DRAFT below this one). */
  onDuplicate?: () => void;
  /** Delete the section (caller handles confirmation). */
  onDelete?: () => void;
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
  onDuplicate,
  onDelete,
}: Props) {
  const isBusy = isPending || isAnyPending;
  const approvalStatus = section.approvalStatus as ApprovalStatus;
  const canPublish = APPROVAL_PUBLISH_ALLOWED.has(approvalStatus);
  const isPublished = section.publishStatus === "PUBLISHED";

  return (
    <div
      className="flex items-center gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-md px-1.5 py-1"
      role="toolbar"
      aria-label={`Aktionen für ${section.label}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Edit */}
      <button
        type="button"
        onClick={onStartEdit}
        disabled={isBusy}
        className="sce-icon-button text-[var(--text-2)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]"
        title="Bearbeiten"
        aria-label="Sektion bearbeiten"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>

      <span className="h-4 w-px bg-[var(--border)] mx-0.5" aria-hidden="true" />

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
        aria-label={section.isEnabled ? "Sektion deaktivieren" : "Sektion aktivieren"}
        aria-pressed={section.isEnabled}
      >
        {section.isEnabled ? (
          <Eye className="h-3.5 w-3.5" />
        ) : (
          <EyeOff className="h-3.5 w-3.5" />
        )}
      </button>

      <span className="h-4 w-px bg-[var(--border)] mx-0.5" aria-hidden="true" />

      {/* Move up */}
      <button
        type="button"
        onClick={onMoveUp}
        disabled={isFirst || isBusy}
        className="sce-icon-button text-[var(--text-2)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)] disabled:opacity-30"
        title="Nach oben verschieben"
        aria-label="Sektion nach oben verschieben"
        aria-disabled={isFirst || isBusy}
      >
        <ChevronUp className="h-3.5 w-3.5" />
      </button>

      {/* Move down */}
      <button
        type="button"
        onClick={onMoveDown}
        disabled={isLast || isBusy}
        className="sce-icon-button text-[var(--text-2)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)] disabled:opacity-30"
        title="Nach unten verschieben"
        aria-label="Sektion nach unten verschieben"
        aria-disabled={isLast || isBusy}
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </button>

      <span className="h-4 w-px bg-[var(--border)] mx-0.5" aria-hidden="true" />

      {/* Publish / Unpublish */}
      {isPublished ? (
        <button
          type="button"
          onClick={onUnpublish}
          disabled={isBusy}
          className="sce-icon-button text-blue-600 hover:text-blue-800 hover:bg-[var(--surface-2)]"
          title="Aus Publikation zurückziehen"
          aria-label="Sektion aus Publikation zurückziehen"
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
          aria-label={
            !canPublish
              ? `Veröffentlichung blockiert: ${APPROVAL_STATUS_LABELS[approvalStatus]}`
              : "Sektion veröffentlichen"
          }
          aria-disabled={!canPublish}
        >
          <Globe className="h-3.5 w-3.5" />
        </button>
      )}

      {onDuplicate && (
        <>
          <span className="h-4 w-px bg-[var(--border)] mx-0.5" aria-hidden="true" />

          {/* Duplicate */}
          <button
            type="button"
            onClick={onDuplicate}
            disabled={isBusy}
            className="sce-icon-button text-[var(--text-2)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]"
            title="Sektion duplizieren"
            aria-label="Sektion duplizieren"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </>
      )}

      {onDelete && (
        <>
          {!onDuplicate && (
            <span className="h-4 w-px bg-[var(--border)] mx-0.5" aria-hidden="true" />
          )}

          {/* Delete — styled as destructive */}
          <button
            type="button"
            onClick={onDelete}
            disabled={isBusy}
            className="sce-icon-button text-[var(--muted)] hover:text-rose-600 hover:bg-rose-50"
            title="Sektion löschen"
            aria-label="Sektion löschen"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  );
}
