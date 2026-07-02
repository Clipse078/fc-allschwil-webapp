"use client";

/**
 * components/admin/homepage-builder/HomepageCanvasSection.tsx
 *
 * Visual canvas section card — shared by Homepage Builder and Website Page Builder
 * (PageBuilderCanvas adapts PageSectionAdminItem → HomepageSectionAdminItem and
 * delegates here via HomepageCanvas).
 *
 * VISUAL PARITY (Slice I.1)
 *   The canvas section now renders the actual block content using the shared
 *   website renderers (HeroRenderer, CallToActionRenderer,
 *   SplitContentCardsRenderer) via CanvasBlockPreview. Data-driven blocks show
 *   an informational placeholder. This makes editing feel like Webflow/Builder.io
 *   while preserving all admin chrome.
 *
 * STRUCTURE
 *   ┌─ Admin chrome strip ──────────────────────────────────────────────────┐
 *   │  [Drag] [#] [Icon] [Label · Category]          [Status badges]        │
 *   └───────────────────────────────────────────────────────────────────────┘
 *   ┌─ Visual block preview (pointer-events-none) ──────────────────────────┐
 *   │  Actual block rendered in previewMode                                  │
 *   └───────────────────────────────────────────────────────────────────────┘
 *   ┌─ Quick-action strip (hover / focus-within) ───────────────────────────┐
 *   │  Toggle · ↑ · ↓ · Duplicate · Delete                                  │
 *   └───────────────────────────────────────────────────────────────────────┘
 *
 * The floating toolbar appears above the card when the section is selected.
 * The selection ring and left-bar indicator remain unchanged from before.
 */

import { Suspense } from "react";
import {
  GripVertical,
  LayoutTemplate,
  Newspaper,
  Calendar,
  Users,
  CalendarDays,
  MousePointerClick,
  Award,
  LayoutPanelLeft,
  Blocks,
  Globe,
  GlobeLock,
  Clock,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  Copy,
  Trash2,
} from "lucide-react";
import type { HomepageSectionAdminItem } from "@/lib/homepage/admin-queries";
import { getBlockDefinition } from "@/lib/homepage/block-registry";
import {
  APPROVAL_STATUS_LABELS,
  type ApprovalStatus,
} from "@/lib/homepage/approval-constants";
import { Badge } from "@/components/ui/Badge";
import { StatusIndicator } from "@/components/ui/StatusIndicator";
import { HomepageCanvasToolbar } from "./HomepageCanvasToolbar";
import { CanvasBlockPreview } from "./CanvasBlockPreview";
import type { SectionCardCallbacks } from "./HomepageSectionCard";

// ---------------------------------------------------------------------------
// Block icon map + category colors
// ---------------------------------------------------------------------------

const BLOCK_ICON_MAP: Record<string, React.ElementType> = {
  LayoutTemplate,
  Newspaper,
  Calendar,
  Users,
  CalendarDays,
  MousePointerClick,
  Award,
  LayoutPanelLeft,
  Blocks,
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  Header:        { bg: "rgba(139,92,246,0.10)", text: "#8B5CF6" },
  Content:       { bg: "rgba(59,130,246,0.10)",  text: "#3B82F6" },
  "Data-driven": { bg: "rgba(16,185,129,0.10)",  text: "#10B981" },
  Club:          { bg: "rgba(245,158,11,0.10)",  text: "#F59E0B" },
  Sponsors:      { bg: "rgba(236,72,153,0.10)",  text: "#EC4899" },
  Conversion:    { bg: "rgba(239,68,68,0.10)",   text: "#EF4444" },
  Utility:       { bg: "rgba(107,114,128,0.10)", text: "#6B7280" },
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  section: HomepageSectionAdminItem;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  isSelected: boolean;
  isPending: boolean;
  isAnyPending: boolean;
  isDragging?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onFocusPrevious?: () => void;
  onFocusNext?: () => void;
  sectionRef?: (el: HTMLDivElement | null) => void;
  onDeselect?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onSaveAsReusable?: () => void;
  /**
   * Admin canvas inline editing (Slice K).
   * When provided and the section is selected, pointer-events-none is removed
   * from the block preview wrapper and text fields become inline editable.
   * Called on every change; the parent merges into inspectorDraft.
   */
  onInlineFieldChange?: (field: string, value: string) => void;
} & Pick<
  SectionCardCallbacks,
  | "onSelect"
  | "onToggle"
  | "onMoveUp"
  | "onMoveDown"
  | "onPublish"
  | "onUnpublish"
  | "onStartEdit"
>;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HomepageCanvasSection({
  section,
  index,
  isFirst,
  isLast,
  isSelected,
  isPending,
  isAnyPending,
  isDragging = false,
  onSelect,
  onToggle,
  onMoveUp,
  onMoveDown,
  onPublish,
  onUnpublish,
  onStartEdit,
  onDragStart,
  onDragEnd,
  onFocusPrevious,
  onFocusNext,
  sectionRef,
  onDeselect,
  onDuplicate,
  onDelete,
  onSaveAsReusable,
  onInlineFieldChange,
}: Props) {
  const def = getBlockDefinition(section.type);
  const BlockIcon = BLOCK_ICON_MAP[def?.icon ?? "LayoutTemplate"] ?? LayoutTemplate;
  const categoryColor =
    CATEGORY_COLORS[def?.category ?? ""] ?? CATEGORY_COLORS["Utility"];

  const approvalStatus = section.approvalStatus as ApprovalStatus;
  const isPublished = section.publishStatus === "PUBLISHED";
  const scheduledDate =
    section.scheduledPublishAt !== null
      ? new Date(section.scheduledPublishAt)
      : null;
  const isScheduled =
    !isPublished && scheduledDate !== null && scheduledDate > new Date();

  const isBusy = isPending || isAnyPending;

  return (
    <div
      ref={sectionRef}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      aria-label={`${section.label} — Position ${index + 1}. Enter zum Auswählen, Strg+Pfeil zum Verschieben.`}
      draggable
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
          return;
        }
        if (e.key === "Escape" && isSelected) {
          e.preventDefault();
          onDeselect?.();
          return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key === "ArrowUp") {
          e.preventDefault();
          if (!isFirst && !isPending && !isAnyPending) onMoveUp();
          return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key === "ArrowDown") {
          e.preventDefault();
          if (!isLast && !isPending && !isAnyPending) onMoveDown();
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          onFocusPrevious?.();
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          onFocusNext?.();
          return;
        }
      }}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", section.id);
        onDragStart?.();
      }}
      onDragEnd={onDragEnd}
      className={[
        "group relative w-full rounded-xl border bg-[var(--surface)] overflow-hidden",
        "transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)] focus-visible:ring-offset-2",
        isDragging
          ? "opacity-40 scale-[0.98] shadow-lg cursor-grabbing"
          : "cursor-pointer active:cursor-grabbing",
        isSelected && !isDragging
          ? "border-[var(--sce-primary)] shadow-md ring-2 ring-[var(--sce-primary)]/20 ring-offset-1"
          : "border-[var(--border)] hover:border-[var(--border-strong)] hover:shadow-sm",
        !section.isEnabled ? "opacity-75" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Floating toolbar — shown only when selected and not dragging */}
      {isSelected && !isDragging && (
        <div
          className="absolute -top-9 left-1/2 -translate-x-1/2 z-20"
          onClick={(e) => e.stopPropagation()}
        >
          <HomepageCanvasToolbar
            section={section}
            isFirst={isFirst}
            isLast={isLast}
            isPending={isPending}
            isAnyPending={isAnyPending}
            onStartEdit={onStartEdit}
            onToggle={onToggle}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            onPublish={onPublish}
            onUnpublish={onUnpublish}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
            onSaveAsReusable={onSaveAsReusable}
          />
        </div>
      )}

      {/* ── Admin chrome strip ──────────────────────────────────────────────
          Compact header row with drag handle, sort order, block identity,
          and publish/approval status. Always visible above the visual preview.
          ─────────────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-3 py-2.5 border-b border-[var(--border)] bg-[var(--surface)] z-10 relative">
        {/* Drag handle */}
        <div
          className="shrink-0 opacity-30 group-hover:opacity-60 transition-opacity cursor-grab active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
          aria-hidden="true"
        >
          <GripVertical className="h-4 w-4 text-[var(--muted)]" />
        </div>

        {/* Sort order pill */}
        <div className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--surface-2)] border border-[var(--border)]">
          <span className="text-[10px] font-semibold text-[var(--text-2)] leading-none">
            {index + 1}
          </span>
        </div>

        {/* Block icon */}
        <div
          className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-200"
          style={{ background: categoryColor.bg, color: categoryColor.text }}
        >
          <BlockIcon className="h-4 w-4" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-[var(--foreground)] leading-snug truncate">
            {section.label}
          </p>
          <div className="flex items-center gap-1">
            {def && (
              <span className="text-[9px] font-medium uppercase tracking-[0.07em] text-[var(--muted)]">
                {def.category}
              </span>
            )}
            {def && (
              <span className="text-[9px] text-[var(--muted)]">·</span>
            )}
            <span className="text-[9px] text-[var(--muted)] truncate">
              {def?.displayName ?? section.type}
            </span>
          </div>
          {isScheduled && scheduledDate && (
            <p className="text-[9px] text-amber-600 font-medium">
              Geplant: {scheduledDate.toLocaleString("de-CH")}
            </p>
          )}
        </div>

        {/* Status cluster */}
        <div
          className="flex flex-wrap items-center justify-end gap-1 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {section.isEnabled ? (
            <StatusIndicator variant="success" label="Aktiv" size="sm" />
          ) : (
            <StatusIndicator variant="neutral" label="Aus" size="sm" />
          )}

          {isPublished ? (
            <Badge variant="info" size="sm">
              <Globe className="h-2.5 w-2.5" />
              Pub
            </Badge>
          ) : isScheduled ? (
            <Badge variant="warning" size="sm">
              <Clock className="h-2.5 w-2.5" />
              Geplant
            </Badge>
          ) : (
            <Badge variant="default" size="sm">
              <GlobeLock className="h-2.5 w-2.5" />
              Entwurf
            </Badge>
          )}

          {approvalStatus !== "NOT_REQUIRED" && (
            <Badge
              size="sm"
              variant={
                approvalStatus === "APPROVED"
                  ? "success"
                  : approvalStatus === "IN_REVIEW"
                    ? "info"
                    : approvalStatus === "CHANGES_REQUESTED"
                      ? "danger"
                      : "warning"
              }
            >
              {APPROVAL_STATUS_LABELS[approvalStatus] ?? approvalStatus}
            </Badge>
          )}
        </div>
      </div>

      {/* ── Visual block preview ────────────────────────────────────────────
          Renders the actual block using the shared website renderer in
          previewMode. pointer-events-none prevents accidental link navigation
          and keeps click-to-select working on the outer wrapper.
          When inline editing is active (section selected + onInlineFieldChange
          provided), pointer-events-none is removed so text fields are interactive.
          Opacity reflects the section's enabled/disabled state.
          ─────────────────────────────────────────────────────────────────── */}
      <div
        className={[
          isSelected && onInlineFieldChange ? "" : "pointer-events-none select-none",
          !section.isEnabled ? "opacity-50" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-hidden={!(isSelected && onInlineFieldChange)}
      >
        <Suspense fallback={<RendererSkeleton />}>
          <CanvasBlockPreview
            type={section.type}
            config={section.config as Record<string, unknown>}
            onFieldChange={isSelected && onInlineFieldChange ? onInlineFieldChange : undefined}
          />
        </Suspense>
      </div>

      {/* ── Inline quick-action strip ────────────────────────────────────────
          Revealed on hover or keyboard focus-within. Hidden when selected
          (floating toolbar takes over). Fixed height so DOM order is stable.
          ─────────────────────────────────────────────────────────────────── */}
      <div
        className={[
          "flex items-center gap-1 px-3 pb-2 pt-1.5 border-t",
          "transition-all duration-150",
          isSelected
            ? "opacity-0 pointer-events-none border-transparent"
            : "opacity-0 pointer-events-none border-transparent group-hover:opacity-100 group-hover:pointer-events-auto group-hover:border-[var(--border)]/60 group-focus-within:opacity-100 group-focus-within:pointer-events-auto group-focus-within:border-[var(--border)]/60",
        ].join(" ")}
        onClick={(e) => e.stopPropagation()}
        aria-hidden={isSelected}
      >
        {/* Toggle visibility */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          disabled={isBusy}
          className={`sce-icon-button text-xs transition-colors ${
            section.isEnabled
              ? "text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50"
              : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]"
          }`}
          title={section.isEnabled ? "Deaktivieren" : "Aktivieren"}
          aria-label={section.isEnabled ? "Sektion deaktivieren" : "Sektion aktivieren"}
        >
          {section.isEnabled ? (
            <Eye className="h-3.5 w-3.5" />
          ) : (
            <EyeOff className="h-3.5 w-3.5" />
          )}
        </button>

        {/* Move up */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
          disabled={isFirst || isBusy}
          className="sce-icon-button text-[var(--text-2)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)] disabled:opacity-30 disabled:cursor-not-allowed"
          title="Nach oben verschieben"
          aria-label="Sektion nach oben verschieben"
          aria-disabled={isFirst || isBusy}
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>

        {/* Move down */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
          disabled={isLast || isBusy}
          className="sce-icon-button text-[var(--text-2)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)] disabled:opacity-30 disabled:cursor-not-allowed"
          title="Nach unten verschieben"
          aria-label="Sektion nach unten verschieben"
          aria-disabled={isLast || isBusy}
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>

        <span className="flex-1" />

        {/* Duplicate */}
        {onDuplicate && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
            disabled={isBusy}
            className="sce-icon-button text-[var(--text-2)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]"
            title="Sektion duplizieren"
            aria-label="Sektion duplizieren"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Delete */}
        {onDelete && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            disabled={isBusy}
            className="sce-icon-button text-[var(--muted)] hover:text-rose-600 hover:bg-rose-50"
            title="Sektion löschen"
            aria-label="Sektion löschen"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Selection indicator bar */}
      {isSelected && !isDragging && (
        <div
          className="absolute inset-y-0 left-0 w-1 rounded-l-xl transition-opacity duration-200"
          style={{ background: "var(--sce-primary)" }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton for lazy-loaded renderers
// ---------------------------------------------------------------------------

function RendererSkeleton() {
  return (
    <div className="w-full animate-pulse bg-[var(--surface-2)] py-8 px-6">
      <div className="mx-auto max-w-xl space-y-3">
        <div className="h-6 w-2/3 rounded bg-[var(--border)]" />
        <div className="h-3.5 w-full rounded bg-[var(--border)]" />
        <div className="h-3.5 w-4/5 rounded bg-[var(--border)]" />
        <div className="mt-3 h-8 w-24 rounded-lg bg-[var(--border)]" />
      </div>
    </div>
  );
}
