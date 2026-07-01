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
// Block icon map + category colors (same as card, kept local to avoid coupling)
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
// Insertion zone (drag/drop placeholder for Slice E)
// ---------------------------------------------------------------------------

function InsertionZone() {
  return (
    <div
      className="group/insert flex items-center gap-2 px-2 py-1 opacity-0 hover:opacity-100 transition-opacity duration-150"
      aria-hidden="true"
    >
      <div className="flex-1 h-px border-t border-dashed border-[var(--border)]" />
      <span className="text-[10px] text-[var(--muted)] px-1.5 py-0.5 rounded border border-dashed border-[var(--border)] bg-[var(--surface-2)] whitespace-nowrap select-none">
        + Sektion einfügen
      </span>
      <div className="flex-1 h-px border-t border-dashed border-[var(--border)]" />
    </div>
  );
}

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
  onSelect,
  onToggle,
  onMoveUp,
  onMoveDown,
  onPublish,
  onUnpublish,
  onStartEdit,
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
    <div className="relative">
      {/* Insertion zone above (hidden by default, appears on hover) */}
      <InsertionZone />

      {/* Canvas section tile */}
      <div
        role="button"
        tabIndex={0}
        aria-pressed={isSelected}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect();
          }
        }}
        className={[
          "group relative w-full rounded-xl border bg-[var(--surface)] cursor-pointer",
          "transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)] focus-visible:ring-offset-2",
          isSelected
            ? "border-[var(--sce-primary)] shadow-md ring-2 ring-[var(--sce-primary)]/20 ring-offset-1"
            : "border-[var(--border)] hover:border-[var(--border-strong)] hover:shadow-sm",
          !section.isEnabled ? "opacity-75" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {/* Mini toolbar (shown only when selected) */}
        {isSelected && (
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
          {/* Drag handle placeholder */}
          <div
            className="shrink-0 cursor-grab opacity-20 group-hover:opacity-50 transition-opacity"
            title="Drag &amp; Drop folgt in Slice E"
            onClick={(e) => e.stopPropagation()}
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
        {isSelected && (
          <div
            className="absolute inset-y-0 left-0 w-1 rounded-l-xl"
            style={{ background: "var(--sce-primary)" }}
            aria-hidden="true"
          />
        )}
      </div>

      {/* Insertion zone below last item */}
      {isLast && <InsertionZone />}
    </div>
  );
}
