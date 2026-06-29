"use client";

/**
 * components/admin/inspector/InspectorPanel.tsx
 *
 * CMS V3 Shared Inspector Panel.
 *
 * Architecture:
 *   - Renders dynamically based on the selected block's `supportsInspector` capabilities.
 *   - Sections: Content, Layout, Style, Background, Interactions, Visibility, Publishing, Advanced.
 *   - Only sections declared as `true` in `supportsInspector` are rendered.
 *   - Each section is collapsible; expanded state persists for the editing session.
 *   - Search filters visible sections by title.
 *
 * Reuse:
 *   - LayoutConfigPanel for Layout + Background (shared; not duplicated).
 *   - SplitContentCardsConfigForm content/columns tabs for splitContentCards Content + Style.
 *   - Generic key-value editor for all other blocks (no premium form).
 *   - WorkflowPanel logic (inlined) for Publishing.
 *   - RevisionHistoryPanel logic (inlined) for Publishing revision info.
 *
 * Props:
 *   section         — the selected page section (label, type, config, publish state, …)
 *   pageId          — for workflow + revision API calls
 *   onConfigChange  — fired on every config mutation (triggers autosave)
 *   onLabelChange   — fired when the section label changes
 *   onWorkflowUpdate— fired when publish/approval state changes
 *   onRevisionRestore — fired when a revision is restored
 *   saveState       — autosave indicator state
 *   lastSaved       — timestamp of last successful save
 *   onClose         — closes the inspector (deselects block)
 */

import { useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  AlignLeft,
  Layers,
  Palette,
  Image as ImageIcon,
  Zap,
  Eye,
  SendHorizonal,
  Settings2,
  Globe,
  GlobeLock,
  Clock,
  History,
  CheckCircle2,
  RefreshCw,
  X,
} from "lucide-react";
import type { PageSectionAdminItem } from "@/lib/page-sections/admin-queries";
import { getBlockDefinition } from "@/lib/homepage/block-registry";
import type { BlockDefinition } from "@/lib/homepage/block-registry";
import type { SectionLayout } from "@/lib/cms/layout-types";
import type { ContentRevisionItem } from "@/lib/cms/revision-engine";
import {
  SECTION_PUBLISH_STATUS,
  SECTION_APPROVAL_STATUS,
} from "@/lib/cms/section-publishing";
import InspectorSection from "./InspectorSection";
import InspectorField from "./InspectorField";
import InspectorGroup from "./InspectorGroup";
import InspectorDivider from "./InspectorDivider";
import InspectorSearch from "./InspectorSearch";
import InspectorToolbar from "./InspectorToolbar";
import type { InspectorSaveState } from "./InspectorToolbar";
import LayoutConfigPanel from "@/components/admin/cms/LayoutConfigPanel";

// Lazy-load premium block forms to avoid SSR issues with TipTap
const SplitContentCardsInspectorContent = dynamic(
  () => import("@/components/admin/page-builder/block-forms/SplitContentCardsInspectorContent"),
  {
    ssr: false,
    loading: () => (
      <div className="h-32 animate-pulse rounded-lg bg-[var(--surface-2)]" />
    ),
  },
);

// ---------------------------------------------------------------------------
// Section metadata
// ---------------------------------------------------------------------------

type InspectorCapabilityKey = keyof NonNullable<BlockDefinition["supportsInspector"]>;

type SectionMeta = {
  key: string;
  title: string;
  icon: React.ReactNode;
  capability: InspectorCapabilityKey;
  defaultOpen: boolean;
};

const SECTION_DEFS: SectionMeta[] = [
  {
    key: "content",
    title: "Content",
    icon: <AlignLeft className="h-3.5 w-3.5" />,
    capability: "content",
    defaultOpen: true,
  },
  {
    key: "layout",
    title: "Layout",
    icon: <Layers className="h-3.5 w-3.5" />,
    capability: "layout",
    defaultOpen: true,
  },
  {
    key: "style",
    title: "Style",
    icon: <Palette className="h-3.5 w-3.5" />,
    capability: "style",
    defaultOpen: false,
  },
  {
    key: "background",
    title: "Background",
    icon: <ImageIcon className="h-3.5 w-3.5" />,
    capability: "background",
    defaultOpen: false,
  },
  {
    key: "interactions",
    title: "Interactions",
    icon: <Zap className="h-3.5 w-3.5" />,
    capability: "interactions",
    defaultOpen: false,
  },
  {
    key: "visibility",
    title: "Visibility",
    icon: <Eye className="h-3.5 w-3.5" />,
    capability: "visibility",
    defaultOpen: false,
  },
  {
    key: "publishing",
    title: "Publishing",
    icon: <Globe className="h-3.5 w-3.5" />,
    capability: "publishing",
    defaultOpen: false,
  },
  {
    key: "advanced",
    title: "Advanced",
    icon: <Settings2 className="h-3.5 w-3.5" />,
    capability: "advanced",
    defaultOpen: false,
  },
];

// ---------------------------------------------------------------------------
// Helper: extract _layout from config
// ---------------------------------------------------------------------------

function getLayout(config: Record<string, unknown>): SectionLayout {
  return (config._layout as SectionLayout | undefined) ?? {};
}

// ---------------------------------------------------------------------------
// Generic content editor (for blocks without a premium form)
// ---------------------------------------------------------------------------

function GenericContentEditor({
  section,
  onChange,
}: {
  section: PageSectionAdminItem;
  onChange: (config: Record<string, unknown>) => void;
}) {
  const def = getBlockDefinition(section.type);
  const configKeys = useMemo(
    () => (def?.configKeys ?? []).filter((k) => k !== "_layout"),
    [def],
  );

  if (configKeys.length === 0) {
    return (
      <p className="text-xs italic text-[var(--muted)]">
        Dieser Block hat keine konfigurierbaren Felder.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {configKeys.map((k) => {
        const v = section.config[k];
        const strVal = v !== undefined && v !== null ? String(v) : "";
        return (
          <InspectorField key={k} label={k}>
            <input
              type="text"
              className="fca-input w-full"
              value={strVal}
              onChange={(e) => {
                const raw = e.target.value;
                const num = Number(raw);
                const val = !isNaN(num) && raw.trim() !== "" ? num : raw;
                onChange({ ...section.config, [k]: val });
              }}
              placeholder={`${k}…`}
            />
          </InspectorField>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Interactions placeholder
// ---------------------------------------------------------------------------

function InteractionsPlaceholder() {
  return (
    <div className="rounded-lg border border-dashed border-[var(--border)] p-4 text-center">
      <Zap className="mx-auto mb-2 h-5 w-5 text-[var(--muted)]" />
      <p className="text-xs font-medium text-[var(--text-2)]">
        Interaktionen — demnächst verfügbar
      </p>
      <p className="mt-1 text-[11px] text-[var(--muted)]">
        Hover-Effekte, Eingangsanimationen und Scroll-Animationen werden in einem späteren Slice freigeschaltet.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Visibility section (publish + approval state display)
// ---------------------------------------------------------------------------

function VisibilityContent({ section }: { section: PageSectionAdminItem }) {
  const ps = section.publishStatus;
  const as = section.approvalStatus;

  const publishLabel =
    ps === SECTION_PUBLISH_STATUS.PUBLISHED ? "Veröffentlicht" : "Entwurf";
  const publishColor =
    ps === SECTION_PUBLISH_STATUS.PUBLISHED
      ? "text-emerald-700 bg-emerald-50"
      : "text-amber-700 bg-amber-50";
  const PublishIcon =
    ps === SECTION_PUBLISH_STATUS.PUBLISHED ? Globe : GlobeLock;

  const approvalLabels: Record<string, string> = {
    NOT_REQUIRED: "Keine Freigabe erforderlich",
    DRAFT: "Entwurf",
    IN_REVIEW: "In Überprüfung",
    APPROVED: "Freigegeben",
    CHANGES_REQUESTED: "Änderungen nötig",
  };
  const approvalLabel = approvalLabels[as] ?? as;

  return (
    <div className="space-y-3">
      <InspectorField label="Publish-Status">
        <div
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${publishColor}`}
        >
          <PublishIcon className="h-3 w-3" />
          {publishLabel}
        </div>
      </InspectorField>

      {as !== SECTION_APPROVAL_STATUS.NOT_REQUIRED && (
        <InspectorField label="Freigabe-Status">
          <div className="inline-flex items-center rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-xs text-[var(--text-2)]">
            {approvalLabel}
          </div>
        </InspectorField>
      )}

      {section.scheduledPublishAt && (
        <InspectorField label="Geplant für">
          <div className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
            <Clock className="h-3 w-3" />
            {new Date(section.scheduledPublishAt).toLocaleString("de-CH")}
          </div>
        </InspectorField>
      )}

      {section.isEnabled !== undefined && (
        <InspectorField label="Sichtbarkeit">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
              section.isEnabled
                ? "bg-emerald-50 text-emerald-700"
                : "bg-[var(--surface-2)] text-[var(--muted)]"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                section.isEnabled ? "bg-emerald-500" : "bg-gray-300"
              }`}
            />
            {section.isEnabled ? "Aktiv" : "Deaktiviert"}
          </span>
        </InspectorField>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Publishing section (workflow actions + revision history)
// ---------------------------------------------------------------------------

function PublishingContent({
  section,
  pageId,
  onWorkflowUpdate,
  onRevisionRestore,
}: {
  section: PageSectionAdminItem;
  pageId: string;
  onWorkflowUpdate: (updated: PageSectionAdminItem) => void;
  onRevisionRestore: (updated: PageSectionAdminItem) => void;
}) {
  const [workflowPending, setWorkflowPending] = useState(false);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");
  const [revisions, setRevisions] = useState<ContentRevisionItem[] | null>(null);
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  const [revisionsError, setRevisionsError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);

  const ps = section.publishStatus;
  const as = section.approvalStatus;
  const canPublish =
    as === SECTION_APPROVAL_STATUS.NOT_REQUIRED ||
    as === SECTION_APPROVAL_STATUS.APPROVED;

  async function doAction(action: string, extra?: Record<string, unknown>) {
    setWorkflowPending(true);
    setWorkflowError(null);
    try {
      const res = await fetch(
        `/api/website-pages/${pageId}/sections/${section.id}/workflow?action=${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(extra ?? {}),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Fehler");
      onWorkflowUpdate(data.section);
    } catch (err) {
      setWorkflowError(err instanceof Error ? err.message : "Fehler");
    } finally {
      setWorkflowPending(false);
    }
  }

  async function loadRevisions() {
    if (revisions !== null) return;
    setRevisionsLoading(true);
    setRevisionsError(null);
    try {
      const res = await fetch(
        `/api/website-pages/${pageId}/sections/${section.id}/revisions`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Fehler");
      setRevisions(data.revisions ?? []);
    } catch (err) {
      setRevisionsError(err instanceof Error ? err.message : "Fehler");
    } finally {
      setRevisionsLoading(false);
    }
  }

  async function handleRestore(revId: string, versionNumber: number) {
    if (
      !confirm(
        `Version ${versionNumber} wiederherstellen? Dies erstellt eine neue Version.`,
      )
    )
      return;
    setRestoring(revId);
    try {
      const res = await fetch(
        `/api/website-pages/${pageId}/sections/${section.id}/revisions/${revId}/restore`,
        { method: "POST" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Fehler");
      onRevisionRestore(data.section);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Fehler");
    } finally {
      setRestoring(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Workflow actions */}
      <InspectorGroup label="Workflow">
        <div className="flex flex-wrap gap-2">
          {ps === SECTION_PUBLISH_STATUS.DRAFT && canPublish && (
            <button
              type="button"
              onClick={() => doAction("publish")}
              disabled={workflowPending}
              className="fca-button-primary py-1.5 text-xs"
            >
              <Globe className="h-3.5 w-3.5" />
              Veröffentlichen
            </button>
          )}
          {ps === SECTION_PUBLISH_STATUS.PUBLISHED && (
            <button
              type="button"
              onClick={() => doAction("unpublish")}
              disabled={workflowPending}
              className="fca-button-secondary py-1.5 text-xs"
            >
              <GlobeLock className="h-3.5 w-3.5" />
              Zurückziehen
            </button>
          )}
          {as !== SECTION_APPROVAL_STATUS.IN_REVIEW && (
            <button
              type="button"
              onClick={() => doAction("request-review")}
              disabled={workflowPending}
              className="fca-button-secondary py-1.5 text-xs"
            >
              <SendHorizonal className="h-3.5 w-3.5" />
              Zur Überprüfung
            </button>
          )}
          {as === SECTION_APPROVAL_STATUS.IN_REVIEW && (
            <>
              <button
                type="button"
                onClick={() => doAction("approve")}
                disabled={workflowPending}
                className="fca-button-primary py-1.5 text-xs"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Freigeben
              </button>
              <button
                type="button"
                onClick={() => doAction("reject")}
                disabled={workflowPending}
                className="fca-button-secondary py-1.5 text-xs text-rose-600"
              >
                <X className="h-3.5 w-3.5" />
                Ablehnen
              </button>
            </>
          )}
        </div>

        {/* Schedule */}
        {canPublish && (
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 flex-shrink-0 text-[var(--muted)]" />
            <input
              type="datetime-local"
              className="fca-input flex-1 text-xs"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
            <button
              type="button"
              disabled={workflowPending || !scheduledAt}
              onClick={() =>
                doAction("schedule", {
                  scheduledAt: new Date(scheduledAt).toISOString(),
                })
              }
              className="fca-button-secondary shrink-0 py-1.5 text-xs"
            >
              Planen
            </button>
          </div>
        )}

        {workflowError && (
          <p className="text-xs text-rose-600">{workflowError}</p>
        )}
      </InspectorGroup>

      <InspectorDivider />

      {/* Revision history */}
      <InspectorGroup label="Versionshistorie">
        {revisions === null ? (
          <button
            type="button"
            onClick={loadRevisions}
            disabled={revisionsLoading}
            className="flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition"
          >
            {revisionsLoading ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <History className="h-3.5 w-3.5" />
            )}
            {revisionsLoading ? "Lädt…" : "Versionen anzeigen"}
          </button>
        ) : (
          <>
            {revisionsError && (
              <p className="text-xs text-rose-600">{revisionsError}</p>
            )}
            {revisions.length === 0 && (
              <p className="text-xs italic text-[var(--muted)]">
                Noch keine Versionen vorhanden.
              </p>
            )}
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {revisions.map((rev) => (
                <div
                  key={rev.id}
                  className="flex items-start justify-between gap-2 rounded-lg border border-[var(--border)] bg-white px-2.5 py-2 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 font-medium text-[var(--foreground)]">
                      <span className="text-[var(--muted)]">v{rev.versionNumber}</span>
                      {rev.isRestore && (
                        <span className="rounded bg-blue-50 px-1 py-0.5 text-[10px] text-blue-700">
                          Restore
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[var(--muted)]">
                      {new Date(rev.createdAt).toLocaleString("de-CH")}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRestore(rev.id, rev.versionNumber)}
                    disabled={restoring === rev.id}
                    className="shrink-0 rounded border border-[var(--border)] px-2 py-0.5 text-[11px] font-medium hover:bg-[var(--surface-2)] disabled:opacity-50 transition"
                  >
                    {restoring === rev.id ? "…" : "↩"}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </InspectorGroup>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Advanced section
// ---------------------------------------------------------------------------

function AdvancedContent({
  section,
  onChange,
}: {
  section: PageSectionAdminItem;
  onChange: (config: Record<string, unknown>) => void;
}) {
  const anchorId = (section.config.anchorId as string | undefined) ?? "";
  const metadata = (section.config._meta as string | undefined) ?? "";

  return (
    <div className="space-y-3">
      <InspectorField
        label="Anker-ID"
        hint="Ermöglicht Direktlinks wie /seite#mein-anker"
      >
        <input
          type="text"
          className="fca-input w-full font-mono text-xs"
          value={anchorId}
          onChange={(e) =>
            onChange({ ...section.config, anchorId: e.target.value })
          }
          placeholder="z. B. ueber-uns"
        />
      </InspectorField>

      <InspectorField
        label="Entwickler-Metadaten"
        hint="Interne Notiz (nur im Admin sichtbar)"
      >
        <textarea
          className="fca-input w-full resize-none font-mono text-xs"
          rows={2}
          value={metadata}
          onChange={(e) =>
            onChange({ ...section.config, _meta: e.target.value })
          }
          placeholder="Optionale Notizen für Entwickler…"
        />
      </InspectorField>

      <div className="rounded-lg border border-dashed border-[var(--border)] p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
          Demnächst
        </p>
        <ul className="mt-1.5 space-y-0.5 text-[11px] text-[var(--muted)]">
          <li>Analytics-Attribute</li>
          <li>CSS-Klassen-Override</li>
          <li>Benutzerdefinierte HTML-Attribute</li>
        </ul>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main InspectorPanel
// ---------------------------------------------------------------------------

export type InspectorPanelProps = {
  section: PageSectionAdminItem;
  pageId: string;
  onConfigChange: (config: Record<string, unknown>) => void;
  onLabelChange: (label: string) => void;
  onWorkflowUpdate: (updated: PageSectionAdminItem) => void;
  onRevisionRestore: (updated: PageSectionAdminItem) => void;
  saveState: InspectorSaveState;
  lastSaved: Date | null;
  onClose: () => void;
};

export default function InspectorPanel({
  section,
  pageId,
  onConfigChange,
  onLabelChange,
  onWorkflowUpdate,
  onRevisionRestore,
  saveState,
  lastSaved,
  onClose,
}: InspectorPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >(() => {
    const init: Record<string, boolean> = {};
    for (const s of SECTION_DEFS) {
      init[s.key] = s.defaultOpen;
    }
    return init;
  });

  const def = getBlockDefinition(section.type);
  const capabilities: NonNullable<BlockDefinition["supportsInspector"]> =
    def?.supportsInspector ?? {};

  // Determine which sections are visible based on capabilities + search
  const visibleSections = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return SECTION_DEFS.filter((s) => {
      if (!capabilities[s.capability]) return false;
      if (query && !s.title.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [capabilities, searchQuery]);

  function toggleSection(key: string, open: boolean) {
    setExpandedSections((prev) => ({ ...prev, [key]: open }));
  }

  const layout = getLayout(section.config);

  const handleLayoutChange = useCallback(
    (newLayout: SectionLayout) => {
      onConfigChange({ ...section.config, _layout: newLayout });
    },
    [section.config, onConfigChange],
  );

  // Background is split out of Layout for the Background section
  const handleBackgroundChange = useCallback(
    (bg: SectionLayout["background"]) => {
      onConfigChange({
        ...section.config,
        _layout: { ...layout, background: bg },
      });
    },
    [section.config, layout, onConfigChange],
  );

  const isPremiumSplitCards = section.type === "splitContentCards";

  return (
    <div className="flex h-full flex-col bg-[var(--surface)] overflow-hidden">
      {/* Toolbar */}
      <InspectorToolbar
        label={section.label}
        blockDisplayName={def?.displayName}
        saveState={saveState}
        lastSaved={lastSaved}
        onClose={onClose}
      />

      {/* Label editor */}
      <div className="border-b border-[var(--border)] px-4 py-3">
        <label className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)] mb-1">
          Sektionsname
        </label>
        <input
          type="text"
          className="fca-input w-full text-sm"
          value={section.label}
          onChange={(e) => onLabelChange(e.target.value)}
          placeholder="Sektionsbezeichnung"
        />
      </div>

      {/* Search */}
      <div className="border-b border-[var(--border)] px-4 py-2">
        <InspectorSearch value={searchQuery} onChange={setSearchQuery} />
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto">
        {visibleSections.length === 0 && (
          <div className="px-4 py-8 text-center text-xs text-[var(--muted)]">
            {searchQuery
              ? `Keine Einstellung für "${searchQuery}" gefunden.`
              : "Keine Einstellungen verfügbar."}
          </div>
        )}

        {visibleSections.map((s) => (
          <InspectorSection
            key={s.key}
            id={s.key}
            title={s.title}
            icon={s.icon}
            open={expandedSections[s.key] ?? false}
            onToggle={(open) => toggleSection(s.key, open)}
          >
            {/* ── Content ───────────────────────────────────────────── */}
            {s.key === "content" && (
              <>
                {isPremiumSplitCards ? (
                  <SplitContentCardsInspectorContent
                    config={section.config}
                    onChange={onConfigChange}
                  />
                ) : (
                  <GenericContentEditor
                    section={section}
                    onChange={onConfigChange}
                  />
                )}
              </>
            )}

            {/* ── Layout ────────────────────────────────────────────── */}
            {s.key === "layout" && (
              <LayoutConfigPanel
                layout={layout}
                onChange={handleLayoutChange}
                features={{
                  columns: isPremiumSplitCards,
                  responsive: true,
                  vAlign: true,
                  paddingX: true,
                }}
              />
            )}

            {/* ── Style ─────────────────────────────────────────────── */}
            {s.key === "style" && isPremiumSplitCards && (
              <SplitContentCardsInspectorContent
                config={section.config}
                onChange={onConfigChange}
                mode="style"
              />
            )}

            {/* ── Background ────────────────────────────────────────── */}
            {s.key === "background" && (
              <LayoutConfigPanel
                layout={layout}
                onChange={handleLayoutChange}
                features={{}}
                backgroundOnly
              />
            )}

            {/* ── Interactions ──────────────────────────────────────── */}
            {s.key === "interactions" && <InteractionsPlaceholder />}

            {/* ── Visibility ────────────────────────────────────────── */}
            {s.key === "visibility" && <VisibilityContent section={section} />}

            {/* ── Publishing ────────────────────────────────────────── */}
            {s.key === "publishing" && (
              <PublishingContent
                section={section}
                pageId={pageId}
                onWorkflowUpdate={onWorkflowUpdate}
                onRevisionRestore={onRevisionRestore}
              />
            )}

            {/* ── Advanced ──────────────────────────────────────────── */}
            {s.key === "advanced" && (
              <AdvancedContent section={section} onChange={onConfigChange} />
            )}
          </InspectorSection>
        ))}
      </div>
    </div>
  );
}
