"use client";

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

  return (
    <div
      ref={sectionRef}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      aria-label={`${section.label} — Position ${index + 1}. Strg+Pfeil oben/unten zum Verschieben.`}
      draggable
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
          return;
        }
        // Keyboard reorder: Ctrl/Cmd + Arrow moves section
        if ((e.ctrlKey || e.metaKey) && e.key === "ArrowUp") {
          e.preventDefault();
          if (!isFirst && !isPending && !isAnyPending) {
            onMoveUp();
          }
          return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key === "ArrowDown") {
          e.preventDefault();
          if (!isLast && !isPending && !isAnyPending) {
            onMoveDown();
          }
          return;
        }
        // Focus navigation: plain Arrow moves focus between sections
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
        "relative w-full rounded-xl border bg-[var(--surface)]",
        "transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)] focus-visible:ring-offset-2",
        isDragging
          ? "opacity-40 scale-[0.98] shadow-lg cursor-grabbing"
          : "cursor-grab active:cursor-grabbing",
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
          className="absolute -top-9 left-1/2 -translate-x-1/2 z-10"
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
          />
        </div>
      )}

      {/* Body */}
      <div className="flex items-center gap-4 px-4 py-4">
        {/* Drag handle */}
        <div
          className="shrink-0 opacity-25 group-hover:opacity-60 hover:opacity-80 transition-opacity cursor-grab active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
          aria-hidden="true"
        >
          <GripVertical className="h-5 w-5 text-[var(--muted)]" />
        </div>

        {/* Sort order pill */}
        <div className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--surface-2)] border border-[var(--border)]">
          <span className="text-[11px] font-semibold text-[var(--text-2)] leading-none">
            {index + 1}
          </span>
        </div>

        {/* Block icon */}
        <div
          className="shrink-0 flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: categoryColor.bg, color: categoryColor.text }}
        >
          <BlockIcon className="h-5 w-5" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--foreground)] leading-snug truncate">
            {section.label}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            {def && (
              <span className="text-[10px] font-medium uppercase tracking-[0.07em] text-[var(--muted)] bg-[var(--surface-2)] border border-[var(--border)] rounded px-1.5 py-0.5">
                {def.category}
              </span>
            )}
            <span className="text-[11px] text-[var(--muted)]">
              {def?.displayName ?? section.type}
            </span>
          </div>
          {isScheduled && scheduledDate && (
            <p className="mt-0.5 text-[11px] text-amber-600 font-medium">
              Geplant: {scheduledDate.toLocaleString("de-CH")}
            </p>
          )}
        </div>

        {/* Status cluster */}
        <div
          className="flex flex-wrap items-center justify-end gap-1.5 shrink-0"
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

      {/* Selection indicator bar */}
      {isSelected && !isDragging && (
        <div
          className="absolute inset-y-0 left-0 w-1 rounded-l-xl"
          style={{ background: "var(--sce-primary)" }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
