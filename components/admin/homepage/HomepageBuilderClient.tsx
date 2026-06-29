"use client";

/**
 * components/admin/homepage/HomepageBuilderClient.tsx
 *
 * CMS V3 Homepage Builder — two-pane layout with Inspector sidebar.
 *
 * Left pane:  Compact section list (click to select, action buttons).
 * Right pane: Inspector panel — accordion sections, search, autosave.
 *
 * Inspector accordion sections (only "Inhalt" open by default):
 *   ▼ Inhalt     — block content (type-specific)
 *   ▶ Spalten    — column arrangement (splitContentCards only)
 *   ▶ Layout     — width, spacing
 *   ▶ Stil       — theme, alignment
 *   ▶ Hintergrund — background type + settings
 *   ▶ Sichtbarkeit — enabled toggle
 *   ▶ Publikation  — publish / schedule / approval
 *   ▶ Erweitert    — advanced (placeholder)
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  RefreshCw,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  Globe,
  GlobeLock,
  Clock,
  AlertCircle,
  X,
  CheckCircle2,
  XCircle,
  FileEdit,
  UserCheck,
  ClipboardCheck,
  Sparkles,
  LayoutTemplate,
  Layers,
  AlignLeft,
  Columns2,
  PanelRight,
  Palette,
  ImagePlus,
  Settings2,
  SlidersHorizontal,
  Check,
  Info,
} from "lucide-react";
import Link from "next/link";
import type { HomepageSectionAdminItem } from "@/lib/homepage/admin-queries";
import {
  APPROVAL_STATUS,
  APPROVAL_STATUS_LABELS,
  APPROVAL_PUBLISH_ALLOWED,
  type ApprovalStatus,
} from "@/lib/homepage/approval-constants";
import { getBlockDefinition } from "@/lib/homepage/block-registry";
import { CMS_ROUTES } from "@/lib/cms/routes";
import type { SectionLayout } from "@/lib/cms/layout-types";
import type { SplitContentCardsSectionConfig } from "@/lib/homepage/section-types";
import InspectorSection from "@/components/admin/cms/inspector/InspectorSection";
import InspectorSearch from "@/components/admin/cms/inspector/InspectorSearch";
import LayoutConfigPanel from "@/components/admin/cms/LayoutConfigPanel";

// Lazy-load premium block content to avoid SSR issues
const SplitContentCardsInspectorContent = dynamic(
  () =>
    import("@/components/admin/page-builder/block-forms/SplitContentCardsInspectorContent").then(
      (m) => ({ default: m.SplitContentCardsContentSection }),
    ),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-3">
        {[80, 60, 120].map((h, i) => (
          <div key={i} className={`h-${h === 120 ? "24" : h === 80 ? "9" : "9"} animate-pulse rounded-lg bg-[var(--surface-2)]`} style={{ height: h }} />
        ))}
      </div>
    ),
  },
);

const SplitContentCardsColumnsSection = dynamic(
  () =>
    import("@/components/admin/page-builder/block-forms/SplitContentCardsInspectorContent").then(
      (m) => ({ default: m.SplitContentCardsColumnsSection }),
    ),
  { ssr: false },
);


// ---------------------------------------------------------------------------
// Inspector section keyword map (for search)
// ---------------------------------------------------------------------------

const INSPECTOR_SECTION_KEYWORDS: Record<string, string[]> = {
  content: [
    "inhalt", "content", "text", "eyebrow", "headline", "titel", "überschrift",
    "karte", "card", "bild", "image", "foto", "photo", "fliesstext", "beschreibung",
    "karten", "bilder", "cards", "images",
  ],
  columns: [
    "spalte", "spalten", "column", "columns", "anordnung", "platzierung",
    "kolumnen", "layout", "links", "rechts",
  ],
  layout: [
    "layout", "breite", "width", "abstand", "spacing", "oben", "unten",
    "narrow", "normal", "wide", "full", "schmal", "breit", "vollbreite",
    "abstand oben", "abstand unten",
  ],
  style: [
    "stil", "style", "farbschema", "theme", "farbe", "color", "hell", "dunkel",
    "vereinsfarbe", "ausrichtung", "alignment", "links", "zentriert", "rechts",
    "light", "dark", "soft", "club",
  ],
  background: [
    "hintergrund", "background", "verlauf", "gradient", "overlay",
    "vollton", "bild", "image", "hintergrundbild", "farbe", "color",
    "hell", "dunkel", "dark", "light",
  ],
  visibility: [
    "sichtbarkeit", "visibility", "aktiv", "enabled", "deaktiviert",
    "disabled", "aktivieren", "deaktivieren",
  ],
  publishing: [
    "publikation", "publishing", "veröffentlich", "publish", "entwurf", "draft",
    "freigabe", "approval", "geplant", "schedule", "review", "überprüfung",
    "freigeben", "ablehnen",
  ],
  advanced: ["erweitert", "advanced", "einstellungen", "settings"],
};

function sectionMatchesQuery(sectionId: string, query: string): boolean {
  if (!query.trim()) return false;
  const q = query.toLowerCase();
  const keywords = INSPECTOR_SECTION_KEYWORDS[sectionId] ?? [];
  return keywords.some((kw) => kw.includes(q) || q.includes(kw));
}

// ---------------------------------------------------------------------------
// Save state indicator
// ---------------------------------------------------------------------------

type SaveState = "idle" | "saving" | "saved" | "error";

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  if (state === "saving") {
    return (
      <span className="flex items-center gap-1 text-[10px] text-[var(--muted)]">
        <RefreshCw className="h-2.5 w-2.5 animate-spin" />
        Speichern…
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="flex items-center gap-1 text-[10px] text-emerald-600">
        <Check className="h-2.5 w-2.5" />
        Gespeichert
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[10px] text-red-600">
      <AlertCircle className="h-2.5 w-2.5" />
      Fehler
    </span>
  );
}

// ---------------------------------------------------------------------------
// Publish status badge
// ---------------------------------------------------------------------------

function PublishBadge({ status, scheduledAt }: { status: string; scheduledAt?: Date | string | null }) {
  if (status === "PUBLISHED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
        <Globe className="h-2.5 w-2.5" />
        Veröffentlicht
      </span>
    );
  }
  const scheduledDate = scheduledAt ? new Date(scheduledAt) : null;
  if (scheduledDate && scheduledDate > new Date()) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
        <Clock className="h-2.5 w-2.5" />
        Geplant
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--muted)]">
      <GlobeLock className="h-2.5 w-2.5" />
      Entwurf
    </span>
  );
}

// ---------------------------------------------------------------------------
// Approval badge
// ---------------------------------------------------------------------------

const APPROVAL_BADGE: Record<ApprovalStatus, { icon: React.ElementType; color: string; bg: string }> = {
  NOT_REQUIRED: { icon: CheckCircle2, color: "text-[var(--text-2)]", bg: "bg-[var(--surface-2)]" },
  DRAFT: { icon: FileEdit, color: "text-amber-600", bg: "bg-amber-50" },
  IN_REVIEW: { icon: Clock, color: "text-blue-600", bg: "bg-blue-50" },
  APPROVED: { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
  CHANGES_REQUESTED: { icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
};

function ApprovalBadge({ status }: { status: ApprovalStatus }) {
  const cfg = APPROVAL_BADGE[status] ?? APPROVAL_BADGE.NOT_REQUIRED;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${cfg.bg} ${cfg.color}`}>
      <Icon className="h-2.5 w-2.5" />
      {APPROVAL_STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Section list item (left pane)
// ---------------------------------------------------------------------------

function SectionListItem({
  section,
  isFirst,
  isLast,
  isSelected,
  isPending,
  onSelect,
  onMove,
  onToggle,
}: {
  section: HomepageSectionAdminItem;
  isFirst: boolean;
  isLast: boolean;
  isSelected: boolean;
  isPending: boolean;
  onSelect: () => void;
  onMove: (dir: "up" | "down") => void;
  onToggle: () => void;
}) {
  const def = getBlockDefinition(section.type);
  const approvalStatus = section.approvalStatus as ApprovalStatus;

  return (
    <div
      className={`group relative cursor-pointer rounded-lg border transition-all duration-100 ${
        isSelected
          ? "border-[var(--brand-primary,#f97316)] bg-orange-50/60 shadow-sm"
          : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)] hover:shadow-sm"
      } ${!section.isEnabled ? "opacity-60" : ""}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } }}
      aria-pressed={isSelected}
    >
      <div className="flex items-start gap-2 p-2.5">
        {/* Block icon placeholder */}
        <div
          className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-[10px] font-bold ${
            isSelected ? "bg-orange-100 text-orange-700" : "bg-[var(--surface-2)] text-[var(--text-2)]"
          }`}
        >
          {section.sortOrder}
        </div>

        {/* Section info */}
        <div className="flex-1 min-w-0">
          <p className={`truncate text-xs font-semibold ${isSelected ? "text-[var(--brand-primary,#f97316)]" : "text-[var(--foreground)]"}`}>
            {section.label}
          </p>
          <p className="truncate text-[10px] text-[var(--muted)]">
            {def?.displayName ?? section.type}
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            <PublishBadge status={section.publishStatus} scheduledAt={section.scheduledPublishAt} />
            {approvalStatus !== "NOT_REQUIRED" && <ApprovalBadge status={approvalStatus} />}
          </div>
        </div>

        {/* Action buttons — visible on hover or selected */}
        <div
          className={`flex flex-shrink-0 flex-col gap-0.5 transition-opacity duration-100 ${
            isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => onMove("up")}
            disabled={isFirst || isPending}
            className="rounded p-0.5 text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] disabled:opacity-30 transition-colors"
            title="Nach oben"
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => onMove("down")}
            disabled={isLast || isPending}
            className="rounded p-0.5 text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] disabled:opacity-30 transition-colors"
            title="Nach unten"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={onToggle}
            disabled={isPending}
            className={`rounded p-0.5 transition-colors ${
              section.isEnabled
                ? "text-emerald-600 hover:text-emerald-800"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
            title={section.isEnabled ? "Deaktivieren" : "Aktivieren"}
          >
            {section.isEnabled ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {/* Selected indicator bar */}
      {isSelected && (
        <div className="absolute inset-y-0 left-0 w-0.5 rounded-l-lg bg-[var(--brand-primary,#f97316)]" />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inspector panel sections config
// ---------------------------------------------------------------------------

type InspectorSectionDef = {
  id: string;
  title: string;
  icon: React.ReactNode;
  keywords: string[]; // for search
};

const INSPECTOR_SECTIONS: InspectorSectionDef[] = [
  {
    id: "content",
    title: "Inhalt",
    icon: <AlignLeft className="h-3.5 w-3.5" />,
    keywords: INSPECTOR_SECTION_KEYWORDS.content,
  },
  {
    id: "columns",
    title: "Spalten",
    icon: <Columns2 className="h-3.5 w-3.5" />,
    keywords: INSPECTOR_SECTION_KEYWORDS.columns,
  },
  {
    id: "layout",
    title: "Layout",
    icon: <SlidersHorizontal className="h-3.5 w-3.5" />,
    keywords: INSPECTOR_SECTION_KEYWORDS.layout,
  },
  {
    id: "style",
    title: "Stil",
    icon: <Palette className="h-3.5 w-3.5" />,
    keywords: INSPECTOR_SECTION_KEYWORDS.style,
  },
  {
    id: "background",
    title: "Hintergrund",
    icon: <ImagePlus className="h-3.5 w-3.5" />,
    keywords: INSPECTOR_SECTION_KEYWORDS.background,
  },
  {
    id: "visibility",
    title: "Sichtbarkeit",
    icon: <Eye className="h-3.5 w-3.5" />,
    keywords: INSPECTOR_SECTION_KEYWORDS.visibility,
  },
  {
    id: "publishing",
    title: "Publikation",
    icon: <Globe className="h-3.5 w-3.5" />,
    keywords: INSPECTOR_SECTION_KEYWORDS.publishing,
  },
  {
    id: "advanced",
    title: "Erweitert",
    icon: <Settings2 className="h-3.5 w-3.5" />,
    keywords: INSPECTOR_SECTION_KEYWORDS.advanced,
  },
];

const DEFAULT_EXPANDED = new Set(["content"]);

// ---------------------------------------------------------------------------
// Generic field renderer for non-premium blocks (inline, avoids circular dep)
// ---------------------------------------------------------------------------

function GenericInspectorFields({
  type,
  config,
  onChange,
}: {
  type: string;
  config: Record<string, unknown>;
  onChange: (key: string, value: string) => void;
}) {
  const def = getBlockDefinition(type);
  const str = (key: string) => (typeof config[key] === "string" ? (config[key] as string) : "");

  if (!def || def.configKeys.filter((k) => k !== "_layout").length === 0) {
    return (
      <p className="text-[11px] text-[var(--muted)]">
        Keine konfigurierbaren Felder für diesen Sektionstyp.
      </p>
    );
  }

  const renderableKeys = def.configKeys.filter(
    (k) => k !== "_layout" && k !== "cards" && k !== "images",
  );

  return (
    <div className="space-y-3">
      {renderableKeys.map((key) => (
        <div key={key}>
          <label className="mb-1 block text-[11px] font-medium text-[var(--foreground)] capitalize">
            {key}
          </label>
          <input
            type="text"
            className="fca-input"
            value={str(key)}
            onChange={(e) => onChange(key, e.target.value)}
            placeholder={key}
          />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inspector Panel
// ---------------------------------------------------------------------------

function InspectorPanel({
  section,
  config,
  onConfigChange,
  saveState,
  actionPending,
  onClose,
  onPublish,
  onUnpublish,
  onToggle,
  onRequestReview,
  onOpenReviewModal,
  onSchedule,
}: {
  section: HomepageSectionAdminItem;
  config: Record<string, unknown>;
  onConfigChange: (config: Record<string, unknown>) => void;
  saveState: SaveState;
  actionPending: string | null;
  onClose: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  onToggle: () => void;
  onRequestReview: () => void;
  onOpenReviewModal: (action: "approve" | "reject") => void;
  onSchedule: () => void;
}) {
  const def = getBlockDefinition(section.type);
  const isSplitCards = section.type === "splitContentCards";
  const approvalStatus = section.approvalStatus as ApprovalStatus;
  const canPublish = APPROVAL_PUBLISH_ALLOWED.has(approvalStatus);
  const isPublished = section.publishStatus === "PUBLISHED";
  const isInReview = approvalStatus === APPROVAL_STATUS.IN_REVIEW;

  // Inspector accordion state
  const [baseExpandedSections, setBaseExpandedSections] = useState<Set<string>>(
    new Set(DEFAULT_EXPANDED),
  );
  const [searchQuery, setSearchQuery] = useState("");

  // Derive which sections are expanded:
  // while searching → show only matching sections; when clear → use base state
  const expandedSections = useMemo(() => {
    if (!searchQuery.trim()) return baseExpandedSections;
    const matching = INSPECTOR_SECTIONS.filter((s) =>
      sectionMatchesQuery(s.id, searchQuery),
    ).map((s) => s.id);
    return matching.length > 0 ? new Set(matching) : baseExpandedSections;
  }, [searchQuery, baseExpandedSections]);

  function toggleSection(id: string) {
    // Only allow manual toggle when not searching (search controls expansion while active)
    if (searchQuery.trim()) return;
    setBaseExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // Config helpers
  const cfg = config as SplitContentCardsSectionConfig;
  const layout = (config._layout as SectionLayout | undefined) ?? {};

  function updateConfig(patch: Partial<Record<string, unknown>>) {
    onConfigChange({ ...config, ...patch });
  }

  function updateLayout(l: SectionLayout) {
    updateConfig({ _layout: l });
  }

  function updateGenericField(key: string, value: string) {
    updateConfig({ [key]: value });
  }

  // Sections to show
  const showColumns = isSplitCards;

  function isSectionVisible(id: string): boolean {
    if (id === "columns" && !showColumns) return false;
    return true;
  }

  const visibleSections = INSPECTOR_SECTIONS.filter((s) => isSectionVisible(s.id));

  return (
    <div className="flex h-full flex-col bg-[var(--surface)] overflow-hidden">
      {/* ── Inspector header ────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-[var(--border)] bg-[var(--surface)] px-3.5 py-3">
        <div className="flex items-start gap-2.5">
          {/* Block type icon */}
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-orange-50 border border-orange-100">
            <Layers className="h-4.5 w-4.5 text-orange-500" style={{ width: "1.125rem", height: "1.125rem" }} />
          </div>

          {/* Section info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">
                {def?.displayName ?? section.type}
              </p>
              <div className="flex items-center gap-1.5">
                <SaveIndicator state={saveState} />
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded p-1 text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] transition-colors"
                  title="Inspector schliessen"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <p className="mt-0.5 truncate text-sm font-semibold text-[var(--foreground)]">
              {section.label}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              <PublishBadge
                status={section.publishStatus}
                scheduledAt={section.scheduledPublishAt}
              />
              {approvalStatus !== "NOT_REQUIRED" && (
                <ApprovalBadge status={approvalStatus} />
              )}
              {!section.isEnabled && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--muted)]">
                  <EyeOff className="h-2.5 w-2.5" />
                  Deaktiviert
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="mt-3">
          <InspectorSearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Inspector durchsuchen…"
          />
        </div>
      </div>

      {/* ── Accordion sections ───────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {visibleSections.map((sec) => {
          const isOpen = expandedSections.has(sec.id);
          const searchMatch = searchQuery.trim()
            ? sectionMatchesQuery(sec.id, searchQuery)
            : false;

          return (
            <InspectorSection
              key={sec.id}
              id={sec.id}
              title={sec.title}
              icon={sec.icon}
              isOpen={isOpen}
              onToggle={() => toggleSection(sec.id)}
              searchMatch={searchMatch}
            >
              {/* ── Content ──────────────────────────────────── */}
              {sec.id === "content" && (
                isSplitCards ? (
                  <SplitContentCardsInspectorContent
                    cfg={cfg}
                    update={(patch) => updateConfig(patch as Record<string, unknown>)}
                  />
                ) : (
                  <GenericInspectorFields
                    type={section.type}
                    config={config}
                    onChange={updateGenericField}
                  />
                )
              )}

              {/* ── Spalten ──────────────────────────────────── */}
              {sec.id === "columns" && isSplitCards && (
                <SplitContentCardsColumnsSection
                  cfg={cfg}
                  update={(patch) => updateConfig(patch as Record<string, unknown>)}
                />
              )}

              {/* ── Layout ───────────────────────────────────── */}
              {sec.id === "layout" && (
                <LayoutConfigPanel
                  layout={layout}
                  onChange={updateLayout}
                  onlySections={["size"]}
                />
              )}

              {/* ── Stil ─────────────────────────────────────── */}
              {sec.id === "style" && (
                <LayoutConfigPanel
                  layout={layout}
                  onChange={updateLayout}
                  onlySections={["style"]}
                  features={{ responsive: isSplitCards }}
                />
              )}

              {/* ── Hintergrund ──────────────────────────────── */}
              {sec.id === "background" && (
                <LayoutConfigPanel
                  layout={layout}
                  onChange={updateLayout}
                  onlySections={["background"]}
                />
              )}

              {/* ── Sichtbarkeit ─────────────────────────────── */}
              {sec.id === "visibility" && (
                <div className="space-y-3">
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--border)] p-3 transition-colors hover:border-[var(--brand-primary,#f97316)] hover:bg-orange-50/40">
                    <input
                      type="checkbox"
                      checked={section.isEnabled}
                      onChange={onToggle}
                      disabled={actionPending !== null}
                      className="mt-0.5 h-4 w-4 rounded accent-orange-500"
                    />
                    <div>
                      <p className="text-xs font-semibold text-[var(--foreground)]">
                        Sektion aktiv
                      </p>
                      <p className="mt-0.5 text-[10px] text-[var(--muted)]">
                        Aktive Sektionen erscheinen im öffentlichen Homepage-Feed, sobald sie auch veröffentlicht sind.
                      </p>
                    </div>
                  </label>
                </div>
              )}

              {/* ── Publikation ──────────────────────────────── */}
              {sec.id === "publishing" && (
                <div className="space-y-3">
                  {/* Current status summary */}
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">
                        Publikationsstatus
                      </span>
                      <PublishBadge
                        status={section.publishStatus}
                        scheduledAt={section.scheduledPublishAt}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">
                        Freigabestatus
                      </span>
                      <ApprovalBadge status={approvalStatus} />
                    </div>
                    {section.scheduledPublishAt && !isPublished && (
                      <p className="text-[10px] text-amber-600">
                        Geplant: {new Date(section.scheduledPublishAt).toLocaleString("de-CH")}
                      </p>
                    )}
                    {section.approvalNote && (
                      <p className="text-[10px] text-[var(--muted)] italic">
                        Notiz: {section.approvalNote}
                      </p>
                    )}
                  </div>

                  {/* Publish / unpublish */}
                  <div className="flex flex-wrap gap-1.5">
                    {isPublished ? (
                      <button
                        type="button"
                        onClick={onUnpublish}
                        disabled={actionPending !== null}
                        className="flex items-center gap-1.5 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-2)] transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
                      >
                        <GlobeLock className="h-3 w-3" />
                        Zurückziehen (Entwurf)
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={onPublish}
                          disabled={actionPending !== null || !canPublish}
                          className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 enabled:hover:border-blue-300"
                          title={!canPublish ? `Blockiert: ${APPROVAL_STATUS_LABELS[approvalStatus]}` : undefined}
                        >
                          <Globe className="h-3 w-3" />
                          Veröffentlichen
                        </button>
                        <button
                          type="button"
                          onClick={onSchedule}
                          disabled={actionPending !== null || !canPublish}
                          className="flex items-center gap-1.5 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-2)] transition-colors hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Clock className="h-3 w-3" />
                          Planen
                        </button>
                      </>
                    )}
                  </div>

                  {/* Approval workflow */}
                  <div>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">
                      Freigabe-Workflow
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {approvalStatus !== APPROVAL_STATUS.IN_REVIEW && (
                        <button
                          type="button"
                          onClick={onRequestReview}
                          disabled={actionPending !== null}
                          className="flex items-center gap-1.5 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-2)] transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
                        >
                          <UserCheck className="h-3 w-3" />
                          Überprüfung anfordern
                        </button>
                      )}
                      {isInReview && (
                        <>
                          <button
                            type="button"
                            onClick={() => onOpenReviewModal("approve")}
                            disabled={actionPending !== null}
                            className="flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Freigeben
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenReviewModal("reject")}
                            disabled={actionPending !== null}
                            className="flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
                          >
                            <XCircle className="h-3 w-3" />
                            Ablehnen
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Erweitert ────────────────────────────────── */}
              {sec.id === "advanced" && (
                <div className="rounded-lg border border-dashed border-[var(--border)] px-4 py-5 text-center">
                  <Settings2 className="mx-auto mb-2 h-5 w-5 text-[var(--muted)]" />
                  <p className="text-[11px] text-[var(--muted)]">
                    Keine erweiterten Einstellungen verfügbar.
                  </p>
                </div>
              )}
            </InspectorSection>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Config serialization for autosave
// ---------------------------------------------------------------------------

const NUMBER_FIELDS: Record<string, string[]> = {
  newsTeaser: ["itemCount"],
  eventsTeaser: ["itemCount"],
  teamsTeaser: ["itemCount"],
};

function serializeConfig(type: string, cfg: ConfigDraft): Record<string, unknown> {
  // Premium block: config is already in correct shape
  if (type === "splitContentCards") return cfg;

  const numFields = new Set(NUMBER_FIELDS[type] ?? []);
  const out: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(cfg)) {
    if (v === "" || v === null || v === undefined) continue;
    if (numFields.has(k)) {
      const n = Number(v);
      if (!isNaN(n)) out[k] = n;
    } else {
      out[k] = v;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Main HomepageBuilderClient
// ---------------------------------------------------------------------------

type ConfigDraft = Record<string, unknown>;

function initConfigDraft(config: HomepageSectionAdminItem["config"]): ConfigDraft {
  if (!config || typeof config !== "object" || Array.isArray(config)) return {};
  return { ...(config as Record<string, unknown>) };
}

export default function HomepageBuilderClient() {
  const [sections, setSections] = useState<HomepageSectionAdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(false);

  // Selected section + edit state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editConfig, setEditConfig] = useState<ConfigDraft>({});
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modals
  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [schedulePending, setSchedulePending] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const [reviewModal, setReviewModal] = useState<{
    id: string;
    label: string;
    action: "approve" | "reject";
  } | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewPending, setReviewPending] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/homepage-sections");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Ladefehler");
      const loaded: HomepageSectionAdminItem[] = data.sections ?? [];
      setSections(loaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // When sections reload, sync editConfig for selected section
  useEffect(() => {
    if (selectedId) {
      const section = sections.find((s) => s.id === selectedId);
      if (section) {
        setEditConfig(initConfigDraft(section.config));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections]);

  function selectSection(section: HomepageSectionAdminItem) {
    // Clear pending autosave for previous section
    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }
    setSelectedId(section.id);
    setEditConfig(initConfigDraft(section.config));
    setSaveState("idle");
  }

  // Autosave on config change (1.5s debounce)
  function handleConfigChange(newConfig: ConfigDraft) {
    setEditConfig(newConfig);
    setSaveState("idle");

    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      if (selectedId) {
        void autosave(selectedId, newConfig);
      }
    }, 1500);
  }

  async function autosave(sectionId: string, cfg: ConfigDraft) {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;

    setSaveState("saving");
    try {
      const payload = serializeConfig(section.type, cfg);
      const res = await fetch(`/api/homepage-sections/${sectionId}/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Speicherfehler");
      setSections((prev) =>
        prev.map((s) =>
          s.id === sectionId
            ? { ...s, config: data.section?.config ?? (cfg as HomepageSectionAdminItem["config"]) }
            : s,
        ),
      );
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("error");
    }
  }

  // ── Section actions ──────────────────────────────────────────────────────

  async function handleMove(id: string, direction: "up" | "down") {
    setActionPending(`${id}-${direction}`);
    try {
      const res = await fetch(`/api/homepage-sections/${id}/move`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { alert(data?.error ?? "Fehler beim Verschieben"); return; }
      setSections(data.sections ?? []);
    } finally {
      setActionPending(null);
    }
  }

  async function handleToggle(id: string) {
    setActionPending(id);
    try {
      const res = await fetch(`/api/homepage-sections/${id}/toggle`, { method: "PATCH" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { alert(data?.error ?? "Fehler beim Umschalten"); return; }
      setSections((prev) =>
        prev.map((s) => (s.id === id ? { ...s, isEnabled: data.section.isEnabled } : s)),
      );
    } finally {
      setActionPending(null);
    }
  }

  async function handlePublish(id: string) {
    setActionPending(`${id}-publish`);
    try {
      const res = await fetch(`/api/homepage-sections/${id}/publish`, { method: "PATCH" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { alert(data?.error ?? "Fehler beim Veröffentlichen"); return; }
      setSections((prev) => prev.map((s) => (s.id === id ? data.section : s)));
    } finally {
      setActionPending(null);
    }
  }

  async function handleUnpublish(id: string) {
    setActionPending(`${id}-unpublish`);
    try {
      const res = await fetch(`/api/homepage-sections/${id}/unpublish`, { method: "PATCH" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { alert(data?.error ?? "Fehler"); return; }
      setSections((prev) => prev.map((s) => (s.id === id ? data.section : s)));
    } finally {
      setActionPending(null);
    }
  }

  async function handleRequestReview(id: string) {
    setActionPending(`${id}-request-review`);
    try {
      const res = await fetch(`/api/homepage-sections/${id}/request-review`, { method: "PATCH" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { alert(data?.error ?? "Fehler"); return; }
      setSections((prev) => prev.map((s) => (s.id === id ? data.section : s)));
    } finally {
      setActionPending(null);
    }
  }

  function handleOpenReviewModal(id: string, label: string, action: "approve" | "reject") {
    setReviewModal({ id, label, action });
    setReviewNote("");
    setReviewError(null);
  }

  function handleCloseReviewModal() {
    if (reviewPending) return;
    setReviewModal(null);
    setReviewNote("");
    setReviewError(null);
  }

  async function handleConfirmReview() {
    if (!reviewModal) return;
    setReviewPending(true);
    setReviewError(null);
    const { id, action } = reviewModal;
    try {
      const res = await fetch(`/api/homepage-sections/${id}/${action}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: reviewNote.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setReviewError(data?.error ?? "Aktion fehlgeschlagen"); return; }
      setSections((prev) => prev.map((s) => (s.id === id ? data.section : s)));
      setReviewModal(null);
      setReviewNote("");
    } finally {
      setReviewPending(false);
    }
  }

  function handleStartSchedule(id: string) {
    setSchedulingId(id);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, "0");
    setScheduleDate(
      `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}T${pad(tomorrow.getHours())}:${pad(tomorrow.getMinutes())}`,
    );
    setScheduleError(null);
  }

  async function handleConfirmSchedule() {
    if (!schedulingId) return;
    setSchedulePending(true);
    setScheduleError(null);
    try {
      const dt = new Date(scheduleDate);
      if (isNaN(dt.getTime())) { setScheduleError("Ungültiges Datum."); return; }
      if (dt <= new Date()) { setScheduleError("Das Datum muss in der Zukunft liegen."); return; }
      const res = await fetch(`/api/homepage-sections/${schedulingId}/schedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledPublishAt: dt.toISOString() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setScheduleError(data?.error ?? "Fehler beim Planen"); return; }
      setSections((prev) => prev.map((s) => (s.id === schedulingId ? data.section : s)));
      setSchedulingId(null);
    } finally {
      setSchedulePending(false);
    }
  }

  async function handleBootstrap() {
    if (!confirm("Standard-Sektionen erstellen? Dieser Vorgang kann nicht rückgängig gemacht werden.")) return;
    setBootstrapping(true);
    try {
      const res = await fetch("/api/homepage-sections", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { alert(data?.error ?? "Fehler"); return; }
      await load();
    } finally {
      setBootstrapping(false);
    }
  }

  const selectedSection = selectedId ? sections.find((s) => s.id === selectedId) ?? null : null;
  const publishedCount = sections.filter((s) => s.isEnabled && s.publishStatus === "PUBLISHED").length;
  const isAnyActionPending = actionPending !== null || bootstrapping;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      {/* Review modal */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl">
            <div className="mb-3 flex items-center gap-2">
              {reviewModal.action === "approve" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {reviewModal.action === "approve" ? "Sektion freigeben" : "Änderungen anfordern"}
              </p>
            </div>
            <p className="mb-3 text-xs text-[var(--text-2)]">
              <strong>{reviewModal.label}</strong>
              {reviewModal.action === "approve" ? " wird zur Veröffentlichung freigegeben." : " wird zur Überarbeitung zurückgegeben."}
            </p>
            <div className="mb-4">
              <label className="fca-label mb-1 block">
                {reviewModal.action === "approve" ? "Freigabenotiz (optional)" : "Begründung (empfohlen)"}
              </label>
              <textarea
                className="fca-textarea min-h-[80px] resize-y"
                placeholder={reviewModal.action === "approve" ? "Optionale Notiz…" : "Beschreibe die erforderlichen Änderungen…"}
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                disabled={reviewPending}
                rows={3}
                maxLength={1000}
              />
            </div>
            {reviewError && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {reviewError}
              </div>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={handleConfirmReview} disabled={reviewPending} className="fca-button-primary">
                {reviewModal.action === "approve" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                {reviewPending ? "Wird verarbeitet…" : reviewModal.action === "approve" ? "Freigeben" : "Ablehnen"}
              </button>
              <button type="button" onClick={handleCloseReviewModal} disabled={reviewPending} className="fca-button-secondary">
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule modal */}
      {schedulingId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl">
            <div className="mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600" />
              <p className="text-sm font-semibold text-[var(--foreground)]">Veröffentlichung planen</p>
            </div>
            <div className="mb-4">
              <label className="fca-label mb-1 block">Datum und Uhrzeit</label>
              <input
                type="datetime-local"
                className="fca-input"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                disabled={schedulePending}
              />
            </div>
            {scheduleError && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {scheduleError}
              </div>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={handleConfirmSchedule} disabled={schedulePending} className="fca-button-primary">
                <Clock className="h-3.5 w-3.5" />
                {schedulePending ? "Wird geplant…" : "Planen"}
              </button>
              <button type="button" onClick={() => setSchedulingId(null)} disabled={schedulePending} className="fca-button-secondary">
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Two-pane layout ──────────────────────────────────────────────── */}
      <div className="flex h-full min-h-0 gap-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">

        {/* ── Left pane: Section list ─────────────────────────────────── */}
        <div className="flex w-0 flex-1 flex-col border-r border-[var(--border)] min-w-0">
          {/* List toolbar */}
          <div className="flex flex-shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-2.5">
            <div className="flex items-center gap-2">
              <LayoutTemplate className="h-3.5 w-3.5 text-[var(--muted)]" />
              <p className="text-[11px] font-semibold text-[var(--foreground)]">
                Homepage-Sektionen
              </p>
              {!loading && sections.length > 0 && (
                <span className="rounded-full bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--muted)]">
                  {sections.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Link
                href={CMS_ROUTES.review}
                className="flex items-center gap-1 rounded px-1.5 py-1 text-[10px] text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] transition-colors"
                title="Review-Queue"
              >
                <ClipboardCheck className="h-3 w-3" />
                <span className="hidden sm:inline">Reviews</span>
              </Link>
              <button
                type="button"
                onClick={load}
                disabled={loading || isAnyActionPending}
                className="rounded p-1 text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] transition-colors disabled:opacity-40"
                title="Aktualisieren"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Governance info banner */}
          <div className="flex-shrink-0 border-b border-[var(--border)] bg-blue-50/50 px-4 py-2">
            <div className="flex items-start gap-1.5 text-[10px] text-blue-700">
              <Info className="mt-0.5 h-3 w-3 flex-shrink-0" />
              <span>
                Sektionen benötigen Status <strong>Freigegeben</strong> oder{" "}
                <strong>Keine Freigabe erforderlich</strong>, bevor sie veröffentlicht werden können.
              </span>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex-shrink-0 flex items-start gap-2 border-b border-rose-100 bg-rose-50 px-4 py-2 text-xs text-rose-700">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}

          {/* Section list content */}
          <div className="flex-1 overflow-y-auto">
            {loading && sections.length === 0 ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-[70px] animate-pulse rounded-lg bg-[var(--surface-2)]" />
                ))}
              </div>
            ) : sections.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                <LayoutTemplate className="mb-3 h-8 w-8 text-[var(--muted)]" />
                <p className="text-sm font-semibold text-[var(--foreground)]">Keine Sektionen</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Erstelle die Standard-Sektionen, um zu starten.
                </p>
                <button
                  type="button"
                  onClick={handleBootstrap}
                  disabled={bootstrapping}
                  className="fca-button-primary mt-4"
                >
                  <Sparkles className="h-4 w-4" />
                  {bootstrapping ? "Wird erstellt…" : "Standard-Sektionen erstellen"}
                </button>
              </div>
            ) : (
              <div className="space-y-1.5 p-3">
                {sections.map((section, idx) => {
                  const isPending =
                    actionPending === section.id ||
                    actionPending?.startsWith(section.id + "-") === true;
                  return (
                    <SectionListItem
                      key={section.id}
                      section={section}
                      isFirst={idx === 0}
                      isLast={idx === sections.length - 1}
                      isSelected={selectedId === section.id}
                      isPending={isPending}
                      onSelect={() => selectSection(section)}
                      onMove={(dir) => handleMove(section.id, dir)}
                      onToggle={() => handleToggle(section.id)}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {!loading && sections.length > 0 && (
            <div className="flex-shrink-0 border-t border-[var(--border)] px-4 py-2">
              <p className="text-[10px] text-[var(--muted)]">
                {publishedCount} / {sections.length} aktiv &amp; veröffentlicht
              </p>
            </div>
          )}
        </div>

        {/* ── Right pane: Inspector ────────────────────────────────────── */}
        <div
          className="flex-shrink-0 flex flex-col overflow-hidden"
          style={{ width: "360px" }}
        >
          {selectedSection ? (
            <InspectorPanel
              key={selectedSection.id}
              section={selectedSection}
              config={editConfig}
              onConfigChange={handleConfigChange}
              saveState={saveState}
              actionPending={actionPending}
              onClose={() => setSelectedId(null)}
              onPublish={() => handlePublish(selectedSection.id)}
              onUnpublish={() => handleUnpublish(selectedSection.id)}
              onToggle={() => handleToggle(selectedSection.id)}
              onRequestReview={() => handleRequestReview(selectedSection.id)}
              onOpenReviewModal={(action) =>
                handleOpenReviewModal(selectedSection.id, selectedSection.label, action)
              }
              onSchedule={() => handleStartSchedule(selectedSection.id)}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <PanelRight className="mb-3 h-8 w-8 text-[var(--muted)]" />
              <p className="text-sm font-semibold text-[var(--foreground)]">Inspector</p>
              <p className="mt-1.5 text-xs text-[var(--muted)] max-w-[220px]">
                Wähle eine Sektion aus der Liste aus, um sie hier zu bearbeiten.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
