"use client";

import {
  MousePointerClick,
  LayoutTemplate,
  Newspaper,
  Calendar,
  Users,
  CalendarDays,
  Award,
  LayoutPanelLeft,
  Blocks,
  Clock,
  Globe,
  GlobeLock,
  Eye,
  EyeOff,
  Layers,
} from "lucide-react";
import type { HomepageSectionAdminItem } from "@/lib/homepage/admin-queries";
import { getBlockDefinition } from "@/lib/homepage/block-registry";
import { APPROVAL_STATUS_LABELS, type ApprovalStatus } from "@/lib/homepage/approval-constants";
import { Badge } from "@/components/ui/Badge";
import { StatusIndicator } from "@/components/ui/StatusIndicator";

// ---------------------------------------------------------------------------
// Block icon map
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

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function InspectorRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-[var(--border)] last:border-0">
      <span className="text-xs text-[var(--muted)] shrink-0">{label}</span>
      <span className="text-xs text-right font-medium text-[var(--foreground)]">{children}</span>
    </div>
  );
}

function formatDate(date: Date | string | null): string {
  if (!date) return "–";
  try {
    return new Date(date).toLocaleString("de-CH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "–";
  }
}

// ---------------------------------------------------------------------------
// Inspector
// ---------------------------------------------------------------------------

type Props = {
  section: HomepageSectionAdminItem | null;
};

export function HomepageSectionInspector({ section }: Props) {
  if (!section) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-8 text-center h-full min-h-[240px]">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl"
          style={{ background: "var(--sce-accent)" }}
        >
          <Layers className="h-6 w-6" style={{ color: "var(--sce-primary)" }} />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[var(--foreground)]">Sektion auswählen</p>
          <p className="text-xs text-[var(--muted)] max-w-[180px] leading-relaxed">
            Klicke auf eine Sektion, um Details und Metadaten anzuzeigen.
          </p>
        </div>
      </div>
    );
  }

  const def = getBlockDefinition(section.type);
  const BlockIcon = BLOCK_ICON_MAP[def?.icon ?? "LayoutTemplate"] ?? LayoutTemplate;
  const approvalLabel =
    APPROVAL_STATUS_LABELS[section.approvalStatus as ApprovalStatus] ?? section.approvalStatus;

  const isPublished = section.publishStatus === "PUBLISHED";
  const scheduledDate =
    section.scheduledPublishAt !== null ? new Date(section.scheduledPublishAt) : null;
  const isScheduled = !isPublished && scheduledDate !== null && scheduledDate > new Date();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-4 border-b border-[var(--border)]">
        <div className="flex items-start gap-3">
          <div
            className="shrink-0 flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: "rgba(139,92,246,0.10)", color: "#8B5CF6" }}
          >
            <BlockIcon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--foreground)] leading-snug break-words">
              {section.label}
            </p>
            {def && (
              <p className="mt-0.5 text-[11px] text-[var(--muted)] leading-relaxed">
                {def.displayName}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Status summary */}
      <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--surface-2)]">
        <div className="flex flex-wrap gap-1.5">
          {section.isEnabled ? (
            <StatusIndicator variant="success" label="Aktiv" size="sm" />
          ) : (
            <StatusIndicator variant="neutral" label="Deaktiviert" size="sm" />
          )}

          {isPublished && (
            <Badge variant="info" size="sm">
              <Globe className="h-2.5 w-2.5" />
              Veröffentlicht
            </Badge>
          )}
          {isScheduled && (
            <Badge variant="warning" size="sm">
              <Clock className="h-2.5 w-2.5" />
              Geplant
            </Badge>
          )}
          {!isPublished && !isScheduled && (
            <Badge variant="default" size="sm">
              <GlobeLock className="h-2.5 w-2.5" />
              Entwurf
            </Badge>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="space-y-0">
          <InspectorRow label="Typ">{def?.displayName ?? section.type}</InspectorRow>
          <InspectorRow label="Kategorie">{def?.category ?? "–"}</InspectorRow>
          <InspectorRow label="Reihenfolge">
            <span className="font-mono">{String(section.sortOrder).padStart(2, "0")}</span>
          </InspectorRow>
          <InspectorRow label="Sichtbarkeit">
            <span className="flex items-center justify-end gap-1">
              {section.isEnabled ? (
                <>
                  <Eye className="h-3 w-3 text-emerald-600" />
                  <span className="text-emerald-600">Aktiv</span>
                </>
              ) : (
                <>
                  <EyeOff className="h-3 w-3 text-[var(--muted)]" />
                  <span className="text-[var(--muted)]">Deaktiviert</span>
                </>
              )}
            </span>
          </InspectorRow>
          <InspectorRow label="Freigabe">{approvalLabel}</InspectorRow>
          {section.approvalNote && (
            <InspectorRow label="Freigabe-Notiz">
              <span
                className="line-clamp-2 text-left text-[10px] italic text-[var(--text-2)]"
                title={section.approvalNote}
              >
                {section.approvalNote}
              </span>
            </InspectorRow>
          )}
          {isScheduled && scheduledDate && (
            <InspectorRow label="Geplant für">
              <span className="text-amber-600">{formatDate(scheduledDate)}</span>
            </InspectorRow>
          )}
          <InspectorRow label="Zuletzt bearbeitet">
            {section.updatedAt ? formatDate(section.updatedAt) : "–"}
          </InspectorRow>
        </div>

        {/* Canvas mode placeholder */}
        <div className="mt-4 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-2)] px-3 py-4 text-center">
          <p className="text-[11px] font-medium text-[var(--text-2)]">Canvas Mode</p>
          <p className="mt-1 text-[11px] text-[var(--muted)] leading-relaxed">
            Block-Einstellungen erscheinen hier in Canvas Mode.
          </p>
        </div>

        {/* Data-driven indicator */}
        {def?.datadriven && (
          <div className="mt-3 rounded-lg bg-[var(--surface-2)] px-3 py-2">
            <p className="text-[11px] text-[var(--muted)]">
              <span className="font-medium text-[var(--text-2)]">Datengesteuert</span> — Inhalte werden automatisch geladen.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
