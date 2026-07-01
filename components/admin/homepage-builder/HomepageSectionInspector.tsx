"use client";

/**
 * components/admin/homepage-builder/HomepageSectionInspector.tsx
 *
 * The Inspector is the primary editing surface in Canvas Mode.
 *
 * When a section is selected, it renders:
 *   1. Block header  — icon, label, type name
 *   2. Status strip  — active / published / draft badges
 *   3. General       — admin label editor (collapsible)
 *   4. Content       — rich block editor (collapsible, open by default)
 *   5. Metadaten     — sort order, dates, approval (collapsible, closed)
 *   6. Actions       — save button with unsaved indicator
 *
 * Live editing:
 *   Changes propagate immediately via `onDraftChange` so the Canvas tiles
 *   can reflect the latest label without a round-trip to the server.
 *   The existing save workflow is called via `onSaveEdit`.
 */

import { useState, useEffect, useRef } from "react";
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
  Check,
  AlertCircle,
  Save,
} from "lucide-react";
import type { HomepageSectionAdminItem } from "@/lib/homepage/admin-queries";
import { getBlockDefinition } from "@/lib/homepage/block-registry";
import {
  APPROVAL_STATUS_LABELS,
  type ApprovalStatus,
} from "@/lib/homepage/approval-constants";
import { Badge } from "@/components/ui/Badge";
import { StatusIndicator } from "@/components/ui/StatusIndicator";
import {
  CollapsibleSection,
  InspectorField,
  getBlockEditor,
  UnsupportedBlockEditor,
} from "./block-editors";

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
// Helpers
// ---------------------------------------------------------------------------

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

function InspectorRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-[var(--border)] last:border-0">
      <span className="text-xs text-[var(--muted)] shrink-0">{label}</span>
      <span className="text-xs text-right font-medium text-[var(--foreground)]">
        {children}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  section: HomepageSectionAdminItem | null;
  /** Called on every keystroke so Canvas tiles can reflect the draft label. */
  onDraftChange?: (
    id: string,
    label: string,
    config: Record<string, unknown>,
  ) => void;
  /** Called when the user clicks "Speichern". Same signature as card's onSaveEdit. */
  onSaveEdit?: (label: string, config: Record<string, unknown>) => Promise<void>;
};

// ---------------------------------------------------------------------------
// HomepageSectionInspector
// ---------------------------------------------------------------------------

export function HomepageSectionInspector({
  section,
  onDraftChange,
  onSaveEdit,
}: Props) {
  // ── Local draft state ──────────────────────────────────────────────────
  const [draftLabel, setDraftLabel] = useState("");
  const [draftConfig, setDraftConfig] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  // Stable ref so the effect callback can read the latest section without needing
  // it as a reactive dependency (prevents overwriting in-progress drafts on every render).
  const sectionRef = useRef(section);
  sectionRef.current = section;

  const sectionId = section?.id;
  const sectionUpdatedAt = section?.updatedAt?.toString();

  // Re-initialise draft when a different section is selected or after a save
  // (tracked via id and updatedAt rather than full section reference).
  useEffect(() => {
    const s = sectionRef.current;
    if (!s) return;
    setDraftLabel(s.label);
    setDraftConfig(
      s.config && typeof s.config === "object" && !Array.isArray(s.config)
        ? (s.config as Record<string, unknown>)
        : {},
    );
    setSaveError(null);
    setSavedOk(false);
  }, [sectionId, sectionUpdatedAt]);

  // ── Empty state ────────────────────────────────────────────────────────

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
          <p className="text-sm font-semibold text-[var(--foreground)]">
            Sektion auswählen
          </p>
          <p className="text-xs text-[var(--muted)] max-w-[180px] leading-relaxed">
            Klicke auf eine Sektion im Canvas, um sie hier zu bearbeiten.
          </p>
        </div>
      </div>
    );
  }

  // Non-null const so TypeScript narrows correctly inside closures
  const sec = section;

  // ── Derived values ─────────────────────────────────────────────────────

  const def = getBlockDefinition(sec.type);
  const BlockIcon = BLOCK_ICON_MAP[def?.icon ?? "LayoutTemplate"] ?? LayoutTemplate;
  const approvalLabel =
    APPROVAL_STATUS_LABELS[sec.approvalStatus as ApprovalStatus] ??
    sec.approvalStatus;

  const isPublished = sec.publishStatus === "PUBLISHED";
  const scheduledDate =
    sec.scheduledPublishAt !== null
      ? new Date(sec.scheduledPublishAt)
      : null;
  const isScheduled =
    !isPublished && scheduledDate !== null && scheduledDate > new Date();

  const isDirty =
    draftLabel !== sec.label ||
    JSON.stringify(draftConfig) !== JSON.stringify(sec.config);

  // ── Handlers ───────────────────────────────────────────────────────────

  function handleLabelChange(value: string) {
    setDraftLabel(value);
    onDraftChange?.(sec.id, value, draftConfig);
  }

  function handleConfigChange(newConfig: Record<string, unknown>) {
    setDraftConfig(newConfig);
    onDraftChange?.(sec.id, draftLabel, newConfig);
  }

  async function handleSave() {
    if (!onSaveEdit) return;
    setSaving(true);
    setSaveError(null);
    setSavedOk(false);
    try {
      const label = draftLabel.trim() || sec.label;
      await onSaveEdit(label, draftConfig);
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2000);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Fehler beim Speichern",
      );
    } finally {
      setSaving(false);
    }
  }

  // Resolve block editor
  const BlockEditor = getBlockEditor(sec.type);

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ──────────────────────────────────────────────────── */}
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
              {draftLabel || sec.label}
            </p>
            {def && (
              <p className="mt-0.5 text-[11px] text-[var(--muted)] leading-relaxed">
                {def.displayName}
              </p>
            )}
          </div>
          {isDirty && (
            <span className="shrink-0 mt-0.5 h-2 w-2 rounded-full bg-amber-400" title="Nicht gespeicherte Änderungen" />
          )}
        </div>
      </div>

      {/* ── Status strip ────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--surface-2)]">
        <div className="flex flex-wrap gap-1.5">
          {sec.isEnabled ? (
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

      {/* ── Scrollable body ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">

        {/* General: admin label */}
        <CollapsibleSection title="Allgemein" defaultOpen={false}>
          <InspectorField
            label="Admin-Bezeichnung"
            help="Interne Bezeichnung für diesen Block (nur im Admin sichtbar)"
          >
            <input
              type="text"
              className="fca-input text-sm"
              value={draftLabel}
              onChange={(e) => handleLabelChange(e.target.value)}
              placeholder={sec.label}
            />
          </InspectorField>

          <div className="space-y-0">
            <InspectorRow label="Typ">
              {def?.displayName ?? sec.type}
            </InspectorRow>
            <InspectorRow label="Kategorie">
              {def?.category ?? "–"}
            </InspectorRow>
            <InspectorRow label="Reihenfolge">
              <span className="font-mono">
                {String(sec.sortOrder).padStart(2, "0")}
              </span>
            </InspectorRow>
            <InspectorRow label="Sichtbarkeit">
              <span className="flex items-center justify-end gap-1">
                {sec.isEnabled ? (
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
          </div>
        </CollapsibleSection>

        {/* Content: rich block editor */}
        <CollapsibleSection title="Inhalt" defaultOpen>
          {BlockEditor ? (
            <div className="-mx-4 -mt-1">
              <BlockEditor
                config={draftConfig}
                onChange={handleConfigChange}
              />
            </div>
          ) : (
            <div className="-mx-4 -mt-1">
              <UnsupportedBlockEditor
                type={sec.type}
                config={draftConfig}
                onChange={handleConfigChange}
              />
            </div>
          )}
        </CollapsibleSection>

        {/* Metadaten */}
        <CollapsibleSection title="Metadaten" defaultOpen={false}>
          <div className="space-y-0">
            <InspectorRow label="Freigabe">{approvalLabel}</InspectorRow>
            {sec.approvalNote && (
              <InspectorRow label="Freigabe-Notiz">
                <span
                  className="line-clamp-2 text-left text-[10px] italic text-[var(--text-2)]"
                  title={sec.approvalNote}
                >
                  {sec.approvalNote}
                </span>
              </InspectorRow>
            )}
            {isScheduled && scheduledDate && (
              <InspectorRow label="Geplant für">
                <span className="text-amber-600">
                  {formatDate(scheduledDate)}
                </span>
              </InspectorRow>
            )}
            <InspectorRow label="Zuletzt bearbeitet">
              {sec.updatedAt ? formatDate(sec.updatedAt) : "–"}
            </InspectorRow>
            <InspectorRow label="Erstellt">
              {sec.createdAt ? formatDate(sec.createdAt) : "–"}
            </InspectorRow>
            {def?.datadriven && (
              <div className="pt-2">
                <p className="text-[11px] text-[var(--muted)] leading-relaxed">
                  <span className="font-medium text-[var(--text-2)]">
                    Datengesteuert
                  </span>{" "}
                  — Inhalte werden automatisch geladen.
                </p>
              </div>
            )}
          </div>
        </CollapsibleSection>

        {/* Actions */}
        {onSaveEdit && (
          <div className="px-4 py-4 border-b border-[var(--border)]">
            {saveError && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {saveError}
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !isDirty}
                className="fca-button-primary text-xs flex-1"
              >
                {saving ? (
                  <>
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin shrink-0" />
                    Wird gespeichert…
                  </>
                ) : savedOk ? (
                  <>
                    <Check className="h-3.5 w-3.5 shrink-0" />
                    Gespeichert
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5 shrink-0" />
                    Speichern
                  </>
                )}
              </button>

              {isDirty && !saving && !savedOk && (
                <span className="text-[11px] text-amber-600 font-medium shrink-0">
                  Nicht gespeichert
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
