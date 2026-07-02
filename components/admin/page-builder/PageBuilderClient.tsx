"use client";

/**
 * components/admin/page-builder/PageBuilderClient.tsx
 *
 * Premium Page Builder — CMS V2 Slice 9 + Slice I (Page Builder Parity).
 *
 * Slice 9 features (existing):
 *   - Drag-and-drop reordering (native HTML5 DnD)
 *   - Move Up / Move Down
 *   - Duplicate Block
 *   - Delete Block (with confirmation)
 *   - Collapse / Expand blocks
 *   - Inline config editor with autosave (debounced 1.5s) — LIST MODE only
 *   - Unsaved changes detection (beforeunload warning)
 *   - Section-level publish/approval status badges
 *   - Publishing workflow actions (publish, unpublish, schedule, request-review)
 *   - Version history panel
 *   - Visual save indicator (Autosaving… / Gespeichert / Fehler)
 *
 * Slice I additions (canvas parity):
 *   - List / Canvas mode toggle
 *   - Canvas: drag-and-drop reorder with insertion lines (via PageBuilderCanvas)
 *   - Canvas: Desktop / Tablet / Mobile viewport toggle
 *   - Canvas: floating toolbar per section (edit, visibility, move, publish, duplicate, delete)
 *   - Canvas: inline quick-action strip on hover
 *   - Inspector panel (right panel, canvas mode): rich block editors via HomepageSectionInspector
 *   - Local draft rendering: inspector changes reflected on canvas tiles before save
 *   - Keyboard accessibility: Arrow navigation, Ctrl+Arrow reorder, Escape deselect
 *   - Aria live region for canvas announcements
 *   - Structured loading skeleton
 *   - Explicit save via inspector (no autosave in canvas mode)
 *   - Responsive preview panel: Desktop / Tablet / Mobile (existing)
 */

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  Fragment,
  Suspense,
} from "react";
import {
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  Plus,
  RefreshCw,
  X,
  Check,
  Blocks,
  Copy,
  ChevronRight,
  GripVertical,
  Globe,
  GlobeLock,
  Clock,
  History,
  Monitor,
  Tablet,
  Smartphone,
  Send,
  CheckCircle2,
  AlertCircle,
  Save,
  LayoutPanelLeft,
  Layers,
  List,
  LayoutGrid,
} from "lucide-react";
import dynamic from "next/dynamic";
import { SectionCard, EmptyState } from "@/components/ui/page";
import type { PageSectionAdminItem } from "@/lib/page-sections/admin-queries";
import type { HomepageSectionAdminItem } from "@/lib/homepage/admin-queries";
import {
  BLOCK_REGISTRY,
  getBlockDefinition,
  type BlockDefinition,
} from "@/lib/homepage/block-registry";
import { HOMEPAGE_SECTION_TYPE_KEYS } from "@/lib/homepage/section-types";
import type { ContentRevisionItem } from "@/lib/cms/revision-engine";
import {
  SECTION_PUBLISH_STATUS,
  SECTION_APPROVAL_STATUS,
} from "@/lib/cms/section-publishing";
import PageTemplatesPicker from "@/components/admin/page-builder/PageTemplatesPicker";
import type { SectionLayout } from "@/lib/cms/layout-types";
import LayoutConfigPanel from "@/components/admin/cms/LayoutConfigPanel";
import { HomepageSectionInspector } from "@/components/admin/homepage-builder/HomepageSectionInspector";
import { PageBuilderCanvas } from "@/components/admin/page-builder/PageBuilderCanvas";

// Lazy-load premium block forms (client-only, avoid SSR issues with TipTap)
const SplitContentCardsConfigForm = dynamic(
  () => import("@/components/admin/page-builder/block-forms/SplitContentCardsConfigForm"),
  { ssr: false, loading: () => <div className="h-32 animate-pulse rounded-lg bg-[var(--surface-2)]" /> },
);

// Lazy-load the shared block renderer for live preview
const SplitContentCardsRenderer = dynamic(
  () => import("@/components/website/blocks/SplitContentCardsRenderer"),
  { ssr: false, loading: () => <div className="h-32 animate-pulse rounded-lg bg-[var(--surface-2)]" /> },
);

// Registry of block types that have a premium property panel
const PREMIUM_BLOCK_TYPES = new Set(["splitContentCards"]);

/**
 * Renders a visual preview for a known block type.
 * Falls back to JSON config summary for generic blocks.
 */
function BlockVisualPreview({ type, config }: { type: string; config: Record<string, unknown> }) {
  if (type === "splitContentCards") {
    return <SplitContentCardsRenderer config={config} previewMode />;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Type adapter — Slice I
// ---------------------------------------------------------------------------

/**
 * Structural cast to bridge PageSectionAdminItem → HomepageSectionAdminItem.
 *
 * Safe because:
 *   - PageSectionAdminItem is a strict superset of HomepageSectionAdminItem
 *   - ApprovalStatus === SectionApprovalStatus (same string literals)
 *   - config is Record<string,unknown> at runtime in both types
 *   - Extra page fields (pageId, publishUntil) are not accessed by inspector/canvas
 */
function adaptSectionForCanvas(s: PageSectionAdminItem): HomepageSectionAdminItem {
  return s as unknown as HomepageSectionAdminItem;
}

// ---------------------------------------------------------------------------
// Builder mode — Slice I
// ---------------------------------------------------------------------------

type BuilderMode = "list" | "canvas";

const BUILDER_MODE_CONFIG: {
  mode: BuilderMode;
  label: string;
  icon: React.ElementType;
  title: string;
}[] = [
  { mode: "list", label: "Liste", icon: List, title: "Listen-Modus" },
  { mode: "canvas", label: "Canvas", icon: LayoutGrid, title: "Canvas-Modus" },
];

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AUTOSAVE_DELAY_MS = 1500;

// ---------------------------------------------------------------------------
// Status badges
// ---------------------------------------------------------------------------

function PublishBadge({ status }: { status: string }) {
  const isPublished = status === SECTION_PUBLISH_STATUS.PUBLISHED;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
        isPublished
          ? "bg-emerald-50 text-emerald-700"
          : "bg-amber-50 text-amber-700"
      }`}
    >
      {isPublished ? (
        <Globe className="h-3 w-3" />
      ) : (
        <GlobeLock className="h-3 w-3" />
      )}
      {isPublished ? "Veröffentlicht" : "Entwurf"}
    </span>
  );
}

function ApprovalBadge({ status }: { status: string }) {
  if (status === SECTION_APPROVAL_STATUS.NOT_REQUIRED) return null;
  const config: Record<string, { label: string; colorClass: string }> = {
    DRAFT: { label: "Entwurf", colorClass: "bg-gray-100 text-gray-600" },
    IN_REVIEW: { label: "In Überprüfung", colorClass: "bg-blue-50 text-blue-700" },
    APPROVED: { label: "Freigegeben", colorClass: "bg-emerald-50 text-emerald-700" },
    CHANGES_REQUESTED: { label: "Änderungen nötig", colorClass: "bg-rose-50 text-rose-700" },
  };
  const cfg = config[status] ?? { label: status, colorClass: "bg-gray-100 text-gray-600" };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${cfg.colorClass}`}>
      {cfg.label}
    </span>
  );
}

function EnabledBadge({ isEnabled }: { isEnabled: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
        isEnabled
          ? "bg-emerald-50 text-emerald-700"
          : "bg-[var(--surface-2)] text-[var(--muted)]"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${isEnabled ? "bg-emerald-500" : "bg-gray-300"}`} />
      {isEnabled ? "Aktiv" : "Deaktiviert"}
    </span>
  );
}

function SectionTypeBadge({ type }: { type: string }) {
  const def = getBlockDefinition(type);
  return (
    <span className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-2)]">
      {def?.displayName ?? type}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Autosave indicator
// ---------------------------------------------------------------------------

type SaveState = "idle" | "saving" | "saved" | "error";

function SaveIndicator({ state, lastSaved }: { state: SaveState; lastSaved: Date | null }) {
  if (state === "idle" && !lastSaved) return null;
  return (
    <div className="flex items-center gap-1.5 text-[11px]">
      {state === "saving" && (
        <>
          <RefreshCw className="h-3 w-3 animate-spin text-blue-500" />
          <span className="text-[var(--muted)]">Speichern…</span>
        </>
      )}
      {state === "saved" && (
        <>
          <Check className="h-3 w-3 text-emerald-500" />
          <span className="text-[var(--muted)]">
            Gespeichert{lastSaved ? ` · ${lastSaved.toLocaleTimeString("de-CH")}` : ""}
          </span>
        </>
      )}
      {state === "error" && (
        <>
          <AlertCircle className="h-3 w-3 text-rose-500" />
          <span className="text-rose-600">Speichern fehlgeschlagen</span>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Config editor (list mode inline editing with autosave)
// ---------------------------------------------------------------------------

type ConfigEditorProps = {
  section: PageSectionAdminItem;
  onSave: (label: string, config: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
  onChanged?: () => void;
  autoSaveRef?: React.MutableRefObject<(() => void) | null>;
};

function ConfigEditor({ section, onSave, onCancel, onChanged, autoSaveRef }: ConfigEditorProps) {
  const def = getBlockDefinition(section.type);
  // Exclude _layout from the generic key-value editor — it is handled by LayoutConfigPanel
  const configKeys = useMemo(
    () => (def?.configKeys ?? []).filter((k) => k !== "_layout"),
    [def],
  );
  const isPremium = PREMIUM_BLOCK_TYPES.has(section.type);
  const supportsLayout = def?.supportsLayout ?? false;

  const [label, setLabel] = useState(section.label);

  // Generic block state (string values per configKey, excluding _layout)
  const [values, setValues] = useState<Record<string, string>>(() => {
    if (isPremium) return {};
    const init: Record<string, string> = {};
    for (const k of configKeys) {
      const v = section.config[k];
      init[k] = v !== undefined && v !== null ? String(v) : "";
    }
    return init;
  });

  // Generic block layout state (shared _layout object)
  const [genericLayout, setGenericLayout] = useState<SectionLayout>(
    () => (section.config._layout as SectionLayout | undefined) ?? {},
  );

  // Premium block state (full config object)
  const [premiumConfig, setPremiumConfig] = useState<Record<string, unknown>>(() =>
    isPremium ? { ...section.config } : {},
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Live preview toggle for premium blocks
  const [showLivePreview, setShowLivePreview] = useState(false);
  // Layout panel visibility for generic blocks
  const [showLayoutPanel, setShowLayoutPanel] = useState(false);

  const buildConfig = useCallback((): Record<string, unknown> => {
    if (isPremium) return premiumConfig;
    const config: Record<string, unknown> = {};
    for (const k of configKeys) {
      const raw = values[k];
      if (raw === "" || raw === undefined) continue;
      const num = Number(raw);
      config[k] = !isNaN(num) && raw.trim() !== "" ? num : raw;
    }
    if (supportsLayout) {
      config._layout = genericLayout;
    }
    return config;
  }, [isPremium, premiumConfig, configKeys, values, supportsLayout, genericLayout]);

  async function handleSave() {
    const trimmed = label.trim();
    if (!trimmed) { setError("Label darf nicht leer sein."); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave(trimmed, buildConfig());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  // Expose trigger for autosave
  useEffect(() => {
    if (autoSaveRef) {
      autoSaveRef.current = () => {
        const trimmed = label.trim();
        if (trimmed) {
          void onSave(trimmed, buildConfig()).catch(() => {});
        }
      };
    }
    return () => {
      if (autoSaveRef) autoSaveRef.current = null;
    };
  }, [label, buildConfig, onSave, autoSaveRef]);

  return (
    <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4">
      <div className="space-y-3">
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)] mb-1">
            Label
          </label>
          <input
            className="fca-input w-full"
            value={label}
            onChange={(e) => { setLabel(e.target.value); onChanged?.(); }}
            placeholder="Sektionsbezeichnung"
          />
        </div>

        {/* Premium block: dispatch to specialized config form */}
        {isPremium && section.type === "splitContentCards" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                Konfiguration
              </p>
              <button
                type="button"
                onClick={() => setShowLivePreview((v) => !v)}
                className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition ${
                  showLivePreview
                    ? "border-blue-400 bg-blue-50 text-blue-700"
                    : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                <LayoutPanelLeft className="h-3 w-3" />
                {showLivePreview ? "Vorschau ausblenden" : "Live-Vorschau"}
              </button>
            </div>
            <SplitContentCardsConfigForm
              config={premiumConfig}
              onChange={(updated) => {
                setPremiumConfig(updated);
                onChanged?.();
              }}
            />
            {showLivePreview && (
              <div className="mt-3 overflow-hidden rounded-lg border border-[var(--border)] bg-white">
                <p className="border-b border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Live-Vorschau
                </p>
                <div className="overflow-auto">
                  <Suspense fallback={<div className="h-32 animate-pulse bg-gray-100" />}>
                    <SplitContentCardsRenderer config={premiumConfig} previewMode />
                  </Suspense>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Generic block: key-value editor */}
        {!isPremium && configKeys.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Konfiguration
            </p>
            {configKeys.map((k) => (
              <div key={k} className="flex items-center gap-2">
                <label className="w-36 flex-shrink-0 text-xs text-[var(--text-2)]">{k}</label>
                <input
                  className="fca-input flex-1"
                  value={values[k] ?? ""}
                  onChange={(e) => { setValues((prev) => ({ ...prev, [k]: e.target.value })); onChanged?.(); }}
                  placeholder={`${k}…`}
                />
              </div>
            ))}
          </div>
        )}

        {!isPremium && configKeys.length === 0 && (
          <p className="text-xs text-[var(--muted)] italic">
            Dieser Blocktyp hat keine konfigurierbaren Felder.
          </p>
        )}

        {/* Shared Layout panel — shown for ALL blocks that support layout */}
        {!isPremium && supportsLayout && (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)]">
            <button
              type="button"
              onClick={() => setShowLayoutPanel((v) => !v)}
              className="flex w-full items-center justify-between px-3 py-2.5 text-left"
            >
              <div className="flex items-center gap-2">
                <Layers className="h-3.5 w-3.5 text-[var(--text-2)]" />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Layout
                </span>
              </div>
              <ChevronDown
                className={`h-3.5 w-3.5 text-[var(--muted)] transition-transform ${showLayoutPanel ? "rotate-180" : ""}`}
              />
            </button>
            {showLayoutPanel && (
              <div className="border-t border-[var(--border)] p-3">
                <LayoutConfigPanel
                  layout={genericLayout}
                  onChange={(layout) => {
                    setGenericLayout(layout);
                    onChanged?.();
                  }}
                />
              </div>
            )}
          </div>
        )}

        {error && <p className="text-xs text-rose-600">{error}</p>}

        <div className="flex items-center gap-2 pt-1">
          <button type="button" onClick={handleSave} disabled={saving} className="fca-button-primary py-1.5 text-xs">
            <Check className="h-3.5 w-3.5" />
            {saving ? "Speichern…" : "Speichern"}
          </button>
          <button type="button" onClick={onCancel} disabled={saving} className="fca-button-secondary py-1.5 text-xs">
            <X className="h-3.5 w-3.5" />
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add section panel
// ---------------------------------------------------------------------------

const AVAILABLE_BLOCKS: BlockDefinition[] = BLOCK_REGISTRY.filter(
  (b) =>
    HOMEPAGE_SECTION_TYPE_KEYS.includes(
      b.type as (typeof HOMEPAGE_SECTION_TYPE_KEYS)[number],
    ) && b.status !== "coming-next",
);

function AddSectionPanel({
  pageId,
  onCreated,
  onCancel,
}: {
  pageId: string;
  onCreated: (section: PageSectionAdminItem) => void;
  onCancel: () => void;
}) {
  const [selectedType, setSelectedType] = useState<string>(AVAILABLE_BLOCKS[0]?.type ?? "");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const def = getBlockDefinition(selectedType);

  async function handleCreate() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/website-pages/${pageId}/sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedType,
          label: label.trim() || def?.displayName || selectedType,
          config: def?.defaultConfig ?? {},
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Fehler beim Erstellen");
      onCreated(data.section);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4">
      <p className="text-sm font-semibold text-[var(--foreground)] mb-3">Neue Sektion hinzufügen</p>
      <div className="space-y-3">
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)] mb-1">
            Blocktyp
          </label>
          <select
            className="fca-input w-full"
            value={selectedType}
            onChange={(e) => { setSelectedType(e.target.value); setLabel(""); }}
          >
            {AVAILABLE_BLOCKS.map((b) => (
              <option key={b.type} value={b.type}>
                {b.displayName} — {b.category}
                {b.status === "foundation-ready" ? " (foundation-ready)" : ""}
              </option>
            ))}
          </select>
        </div>
        {def && <p className="text-xs text-[var(--muted)]">{def.description}</p>}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)] mb-1">
            Label (optional)
          </label>
          <input
            className="fca-input w-full"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={def?.displayName ?? selectedType}
          />
        </div>
        {error && <p className="text-xs text-rose-600">{error}</p>}
        <div className="flex items-center gap-2">
          <button type="button" onClick={handleCreate} disabled={saving || !selectedType} className="fca-button-primary py-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" />
            {saving ? "Erstelle…" : "Sektion erstellen"}
          </button>
          <button type="button" onClick={onCancel} disabled={saving} className="fca-button-secondary py-1.5 text-xs">
            <X className="h-3.5 w-3.5" />
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Preview panel
// ---------------------------------------------------------------------------

type ViewportMode = "desktop" | "tablet" | "mobile";

const VIEWPORT_CONFIG: Record<ViewportMode, { label: string; icon: React.ElementType; width: string }> = {
  desktop: { label: "Desktop", icon: Monitor, width: "100%" },
  tablet: { label: "Tablet", icon: Tablet, width: "768px" },
  mobile: { label: "Mobile", icon: Smartphone, width: "375px" },
};

type PreviewSection = {
  id: string;
  type: string;
  label: string;
  sortOrder: number;
  isEnabled: boolean;
  publishStatus: string;
  approvalStatus: string;
  config: Record<string, unknown>;
  block: { displayName: string; description: string; category: string } | null;
};

function PreviewPanel({
  pageId,
  pageTitle,
  pageSlug,
  onClose,
}: {
  pageId: string;
  pageTitle: string;
  pageSlug: string;
  onClose: () => void;
}) {
  const [viewport, setViewport] = useState<ViewportMode>("desktop");
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState<PreviewSection[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/website-pages/${pageId}/preview`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) { setSections(d.sections ?? []); setLoading(false); }
      })
      .catch(() => {
        if (!cancelled) { setError("Vorschau konnte nicht geladen werden."); setLoading(false); }
      });
    return () => { cancelled = true; };
  }, [pageId]);

  const vc = VIEWPORT_CONFIG[viewport];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--background)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <div className="flex items-center gap-3">
          <Eye className="h-4 w-4 text-[var(--text-2)]" />
          <div>
            <p className="text-sm font-semibold">{pageTitle}</p>
            <p className="text-[11px] text-[var(--muted)]">/{pageSlug}</p>
          </div>
        </div>

        {/* Viewport selector */}
        <div
          className="flex items-center gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-0.5"
          role="group"
          aria-label="Vorschaubreite"
        >
          {(["desktop", "tablet", "mobile"] as ViewportMode[]).map((v) => {
            const vc2 = VIEWPORT_CONFIG[v];
            const Icon = vc2.icon;
            return (
              <button
                key={v}
                type="button"
                onClick={() => setViewport(v)}
                aria-label={`${vc2.label}-Breite`}
                aria-pressed={viewport === v}
                className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)] ${
                  viewport === v
                    ? "bg-white text-[var(--foreground)] shadow-sm"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{vc2.label}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="fca-button-secondary px-2.5"
          aria-label="Vorschau schließen"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Preview area */}
      <div className="flex-1 overflow-auto bg-[var(--surface-2)] p-4">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-[var(--muted)]">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" />
            Lädt Vorschau…
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-32 text-rose-600 text-sm">{error}</div>
        ) : (
            <div className="mx-auto transition-all duration-300 rounded-lg border border-[var(--border)] bg-white overflow-hidden"
              style={{ maxWidth: vc.width }}
            >
              {sections.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-[var(--muted)]">
                  <Blocks className="h-8 w-8 mb-2 opacity-40" />
                  <p className="text-sm">Keine Sektionen vorhanden</p>
                </div>
              ) : (
                <div>
                  {sections.map((s) => (
                    <div
                      key={s.id}
                      className={`border-b border-[var(--border)] last:border-0 ${
                        !s.isEnabled || s.publishStatus !== "PUBLISHED" ? "opacity-50" : ""
                      }`}
                    >
                      {/* Section status strip */}
                      <div className="flex items-center justify-between px-4 py-2 bg-[var(--surface-2)]">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-[var(--foreground)]">{s.label}</span>
                          <SectionTypeBadge type={s.type} />
                        </div>
                        <div className="flex items-center gap-1">
                          <EnabledBadge isEnabled={s.isEnabled} />
                          <PublishBadge status={s.publishStatus} />
                        </div>
                      </div>

                      {/* Visual block render (if renderer available) */}
                      <Suspense fallback={<div className="h-16 animate-pulse bg-gray-50" />}>
                        <BlockVisualPreview type={s.type} config={s.config} />
                      </Suspense>

                      {/* Fallback: JSON config for non-premium blocks */}
                      {!PREMIUM_BLOCK_TYPES.has(s.type) && Object.keys(s.config).length > 0 && (
                        <div className="px-4 pb-3">
                          <div className="rounded bg-[var(--surface-2)] px-2 py-1.5">
                            <p className="text-[10px] font-mono text-[var(--muted)]">
                              {JSON.stringify(s.config, null, 2).slice(0, 200)}
                              {JSON.stringify(s.config).length > 200 ? "…" : ""}
                            </p>
                          </div>
                        </div>
                      )}
                      {!PREMIUM_BLOCK_TYPES.has(s.type) && s.block && (
                        <p className="px-4 pb-3 text-[11px] text-[var(--muted)]">{s.block.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-[var(--border)] bg-[var(--surface)] px-4 py-2 flex items-center gap-3 text-xs text-[var(--muted)]">
        <span>{sections.length} Sektion{sections.length !== 1 ? "en" : ""} (inkl. Entwürfe)</span>
        <span>·</span>
        <span>{sections.filter((s) => s.publishStatus === "PUBLISHED" && s.isEnabled).length} öffentlich sichtbar</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Revision history panel
// ---------------------------------------------------------------------------

function RevisionHistoryPanel({
  pageId,
  section,
  onClose,
  onRestored,
}: {
  pageId: string;
  section: PageSectionAdminItem;
  onClose: () => void;
  onRestored: (section: PageSectionAdminItem) => void;
}) {
  const [revisions, setRevisions] = useState<ContentRevisionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/website-pages/${pageId}/sections/${section.id}/revisions`)
      .then((r) => r.json())
      .then((d) => { setRevisions(d.revisions ?? []); setLoading(false); })
      .catch(() => { setError("Versionen konnten nicht geladen werden."); setLoading(false); });
  }, [pageId, section.id]);

  async function handleRestore(revId: string, versionNumber: number) {
    if (!confirm(`Version ${versionNumber} wiederherstellen? Dies erstellt eine neue Version.`)) return;
    setRestoring(revId);
    try {
      const res = await fetch(
        `/api/website-pages/${pageId}/sections/${section.id}/revisions/${revId}/restore`,
        { method: "POST" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Fehler beim Wiederherstellen");
      onRestored(data.section);
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Fehler");
    } finally {
      setRestoring(null);
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-[var(--text-2)]" />
          <p className="text-sm font-semibold">Versionshistorie</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-[var(--muted)] hover:text-[var(--foreground)]"
          aria-label="Versionshistorie schließen"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-4 text-sm text-[var(--muted)]">
          <RefreshCw className="h-4 w-4 animate-spin" /> Lädt…
        </div>
      )}
      {error && <p className="text-xs text-rose-600 py-2">{error}</p>}

      {!loading && !error && revisions.length === 0 && (
        <p className="text-xs text-[var(--muted)] py-2">Noch keine Versionen vorhanden.</p>
      )}

      {!loading && revisions.length > 0 && (
        <div className="space-y-1 max-h-72 overflow-y-auto">
          {revisions.map((rev) => (
              <div
              key={rev.id}
              className="flex items-start justify-between gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 font-medium text-[var(--foreground)]">
                  <span className="text-[var(--muted)]">v{rev.versionNumber}</span>
                  {rev.isRestore && (
                    <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                      Wiederherstellung
                    </span>
                  )}
                  {rev.changeNote && (
                    <span className="truncate">{rev.changeNote}</span>
                  )}
                </div>
                <div className="text-[var(--muted)] mt-0.5">
                  {rev.createdByUser
                    ? `${rev.createdByUser.firstName} ${rev.createdByUser.lastName} · `
                    : ""}
                  {new Date(rev.createdAt).toLocaleString("de-CH")}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRestore(rev.id, rev.versionNumber)}
                disabled={restoring === rev.id}
                className="shrink-0 rounded border border-[var(--border)] px-2 py-1 text-[11px] font-medium hover:bg-[var(--surface-2)] disabled:opacity-50 transition"
              >
                {restoring === rev.id ? "…" : "Wiederherstellen"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Workflow actions panel
// ---------------------------------------------------------------------------

function WorkflowPanel({
  pageId,
  section,
  onUpdated,
  onClose,
}: {
  pageId: string;
  section: PageSectionAdminItem;
  onUpdated: (section: PageSectionAdminItem) => void;
  onClose: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");

  async function doAction(action: string, extra?: Record<string, unknown>) {
    setPending(true);
    setError(null);
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
      onUpdated(data.section);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
    } finally {
      setPending(false);
    }
  }

  const ps = section.publishStatus;
  const as = section.approvalStatus;
  const canPublish = as === SECTION_APPROVAL_STATUS.NOT_REQUIRED || as === SECTION_APPROVAL_STATUS.APPROVED;

  return (
    <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold">Workflow</p>
        <button
          type="button"
          onClick={onClose}
          className="text-[var(--muted)] hover:text-[var(--foreground)]"
          aria-label="Workflow schließen"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {ps === SECTION_PUBLISH_STATUS.DRAFT && canPublish && (
          <button
            type="button"
            onClick={() => doAction("publish")}
            disabled={pending}
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
            disabled={pending}
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
            disabled={pending}
            className="fca-button-secondary py-1.5 text-xs"
          >
            <Send className="h-3.5 w-3.5" />
            Zur Überprüfung
          </button>
        )}
        {as === SECTION_APPROVAL_STATUS.IN_REVIEW && (
          <>
            <button
              type="button"
              onClick={() => doAction("approve")}
              disabled={pending}
              className="fca-button-primary py-1.5 text-xs"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Freigeben
            </button>
            <button
              type="button"
              onClick={() => doAction("reject")}
              disabled={pending}
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
        <div className="mt-3 flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-[var(--muted)] shrink-0" />
          <input
            type="datetime-local"
            className="fca-input flex-1 text-xs"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
          <button
            type="button"
            disabled={pending || !scheduledAt}
            onClick={() => doAction("schedule", { scheduledAt: new Date(scheduledAt).toISOString() })}
            className="fca-button-secondary py-1.5 text-xs shrink-0"
          >
            Planen
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main PageBuilderClient
// ---------------------------------------------------------------------------

type PageBuilderClientProps = {
  pageId: string;
  pageTitle?: string;
  pageSlug?: string;
};

export default function PageBuilderClient({ pageId, pageTitle = "", pageSlug = "" }: PageBuilderClientProps) {
  // ── Core data state ────────────────────────────────────────────────────────
  const [sections, setSections] = useState<PageSectionAdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<string | null>(null);

  // ── List mode UI state ─────────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  // ── Autosave state (list mode only) ────────────────────────────────────────
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveFnRef = useRef<(() => void) | null>(null);

  // ── List mode drag-and-drop state ─────────────────────────────────────────
  const [dragSrcId, setDragSrcId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // ── Canvas / inspector state (Slice I) ────────────────────────────────────
  const [builderMode, setBuilderMode] = useState<BuilderMode>("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /**
   * Local draft state for canvas inspector — live preview without persisting.
   *
   * UNDO/REDO READINESS (future Slice):
   * This is the single mutation choke-point for inspector draft changes.
   * To add undo/redo later:
   *   1. Create a useDraftHistory hook wrapping useState with a snapshots stack.
   *   2. Replace setInspectorDraft below with pushDraftSnapshot(...).
   *   3. Add Ctrl+Z / Ctrl+Y handlers in this component to pop the stack.
   * No other components need to change — draft mutations are centralised here.
   */
  const [inspectorDraft, setInspectorDraft] = useState<{
    id: string;
    label: string;
    config: Record<string, unknown>;
  } | null>(null);

  // ── Canvas reorder state (Slice I) ────────────────────────────────────────
  const [reorderPending, setReorderPending] = useState(false);
  const [reorderError, setReorderError] = useState<string | null>(null);

  // ── Unsaved changes warning ────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "Es gibt ungespeicherte Änderungen.";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // ── Data loading ───────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/website-pages/${pageId}/sections`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Ladefehler");
      setSections(data.sections ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, [pageId]);

  useEffect(() => { load(); }, [load]);

  // ── Autosave trigger (list mode only) ─────────────────────────────────────

  const triggerAutosave = useCallback(() => {
    setIsDirty(true);
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      if (autosaveFnRef.current) {
        setSaveState("saving");
        Promise.resolve()
          .then(() => { autosaveFnRef.current?.(); })
          .then(() => { setSaveState("saved"); setLastSaved(new Date()); setIsDirty(false); })
          .catch(() => setSaveState("error"));
      }
    }, AUTOSAVE_DELAY_MS);
  }, []);

  // ── Section actions ────────────────────────────────────────────────────────

  async function handleToggle(id: string) {
    setActionPending(id);
    try {
      const res = await fetch(`/api/website-pages/${pageId}/sections/${id}/toggle`, { method: "PATCH" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { alert(data?.error ?? "Fehler"); return; }
      setSections((prev) => prev.map((s) => (s.id === id ? data.section : s)));
    } finally {
      setActionPending(null);
    }
  }

  async function handleMove(id: string, direction: "up" | "down") {
    setActionPending(id);
    try {
      const res = await fetch(`/api/website-pages/${pageId}/sections/${id}/move`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { alert(data?.error ?? "Fehler"); return; }
      setSections(data.sections ?? []);
    } finally {
      setActionPending(null);
    }
  }

  /**
   * Separating request (with rich confirmation) from execution
   * allows canvas mode to call the same flow.
   *
   * UNDO/REDO NOTE: To add undo support for delete, snapshot `sections`
   * before calling handleDeleteExecute and push to a history stack.
   */
  function handleDeleteRequest(id: string) {
    const section = sections.find((s) => s.id === id);
    if (!section) return;
    const confirmed = confirm(
      `Sektion „${section.label}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`,
    );
    if (!confirmed) return;
    void handleDeleteExecute(id);
  }

  async function handleDeleteExecute(id: string) {
    setActionPending(id);
    try {
      const res = await fetch(`/api/website-pages/${pageId}/sections/${id}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        setSections((prev) => prev.filter((s) => s.id !== id));
        if (editingId === id) setEditingId(null);
        if (historyId === id) setHistoryId(null);
        if (workflowId === id) setWorkflowId(null);
        // Canvas-mode cleanup
        if (selectedId === id) {
          setSelectedId(null);
          setInspectorDraft(null);
        }
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data?.error ?? "Löschen fehlgeschlagen");
      }
    } finally {
      setActionPending(null);
    }
  }

  async function handleDuplicate(id: string) {
    // UNDO/REDO NOTE: To add undo support for duplicate, snapshot `sections`
    // before calling setSections and push to a history stack.
    setActionPending(id);
    try {
      const res = await fetch(`/api/website-pages/${pageId}/sections/${id}/duplicate`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { alert(data?.error ?? "Fehler"); return; }
      setSections((prev) => [...prev, data.section]);
    } finally {
      setActionPending(null);
    }
  }

  async function handleSaveConfig(id: string, label: string, config: Record<string, unknown>) {
    setSaveState("saving");
    try {
      const res = await fetch(`/api/website-pages/${pageId}/sections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, config }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Speichern fehlgeschlagen");
      setSections((prev) => prev.map((s) => (s.id === id ? data.section : s)));
      setSaveState("saved");
      setLastSaved(new Date());
      setIsDirty(false);
      if (autosaveTimerRef.current) { clearTimeout(autosaveTimerRef.current); autosaveTimerRef.current = null; }
    } catch (err) {
      setSaveState("error");
      throw err;
    }
  }

  function handleCreated(section: PageSectionAdminItem) {
    setSections((prev) => [...prev, section]);
    setShowAdd(false);
  }

  function handleToggleCollapse(id: string) {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // ── Canvas actions (Slice I) ───────────────────────────────────────────────

  /**
   * Canvas drag-and-drop reorder — optimistic update with rollback on error.
   *
   * UNDO/REDO NOTE: To add undo for reorder, snapshot `sections` before
   * the optimistic setSections call and push it to a history stack.
   */
  async function handleCanvasReorder(orderedIds: string[]) {
    const snapshot = sections;
    const reordered = orderedIds
      .map((id) => snapshot.find((s) => s.id === id))
      .filter((s): s is PageSectionAdminItem => s !== undefined);

    setSections(reordered);
    setReorderPending(true);
    setReorderError(null);

    try {
      const res = await fetch(`/api/website-pages/${pageId}/sections/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSections(snapshot);
        setReorderError(data?.error ?? "Reihenfolge konnte nicht gespeichert werden.");
        return;
      }
      setSections(data.sections ?? reordered);
    } finally {
      setReorderPending(false);
    }
  }

  async function handlePublishSection(id: string) {
    setActionPending(`${id}-publish`);
    try {
      const res = await fetch(
        `/api/website-pages/${pageId}/sections/${id}/workflow?action=publish`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { alert(data?.error ?? "Fehler beim Veröffentlichen"); return; }
      setSections((prev) => prev.map((s) => (s.id === id ? data.section : s)));
    } finally {
      setActionPending(null);
    }
  }

  async function handleUnpublishSection(id: string) {
    setActionPending(`${id}-unpublish`);
    try {
      const res = await fetch(
        `/api/website-pages/${pageId}/sections/${id}/workflow?action=unpublish`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { alert(data?.error ?? "Fehler beim Zurückziehen"); return; }
      setSections((prev) => prev.map((s) => (s.id === id ? data.section : s)));
    } finally {
      setActionPending(null);
    }
  }

  /**
   * Central draft mutation handler — all live inspector changes flow here.
   *
   * Updates inspectorDraft so canvas tiles reflect the new label/config
   * immediately, without a server round-trip.
   *
   * UNDO/REDO READINESS: To add undo for inspector edits, replace
   * setInspectorDraft with pushDraftSnapshot and add key handlers here.
   */
  function handleInspectorDraftChange(
    id: string,
    label: string,
    config: Record<string, unknown>,
  ) {
    // UNDO SNAPSHOT POINT
    setInspectorDraft({ id, label, config });
  }

  /**
   * Called when the inspector "Speichern" button is clicked.
   * Delegates to the existing save endpoint. Clears draft on success.
   * No autosave — explicit save only (canvas mode).
   */
  async function handleInspectorSave(
    label: string,
    config: Record<string, unknown>,
  ): Promise<void> {
    if (!selectedId) return;
    await handleSaveConfig(selectedId, label, config);
    // Clear draft — sections array is now updated from API response
    setInspectorDraft(null);
  }

  function handleBuilderModeChange(mode: BuilderMode) {
    if (mode === "canvas") {
      setEditingId(null); // Close inline editor when entering canvas
    } else {
      // Leaving canvas: clear selection and draft
      setSelectedId(null);
      setInspectorDraft(null);
    }
    setBuilderMode(mode);
  }

  // ── List mode drag-and-drop handlers ─────────────────────────────────────

  function handleDragStart(id: string) {
    setDragSrcId(id);
  }

  function handleDragOver(e: React.DragEvent, id: string) {
    e.preventDefault();
    setDragOverId(id);
  }

  async function handleDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    if (!dragSrcId || dragSrcId === targetId) {
      setDragSrcId(null);
      setDragOverId(null);
      return;
    }

    const srcIdx = sections.findIndex((s) => s.id === dragSrcId);
    const tgtIdx = sections.findIndex((s) => s.id === targetId);
    if (srcIdx === -1 || tgtIdx === -1) { setDragSrcId(null); setDragOverId(null); return; }

    const reordered = [...sections];
    const [moved] = reordered.splice(srcIdx, 1);
    reordered.splice(tgtIdx, 0, moved);
    setSections(reordered);
    setDragSrcId(null);
    setDragOverId(null);

    try {
      const res = await fetch(`/api/website-pages/${pageId}/sections/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: reordered.map((s) => s.id) }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setSections(data.sections ?? reordered);
    } catch {
      // Optimistic update already applied; server sync failed silently
    }
  }

  function handleDragEnd() {
    setDragSrcId(null);
    setDragOverId(null);
  }

  // ── Derived values ─────────────────────────────────────────────────────────

  const isAnyActionPending = actionPending !== null;

  /**
   * Canvas live preview: merge inspector draft into the sections array.
   * Canvas tiles reflect the draft label/config without a server round-trip.
   * Does NOT persist anything.
   */
  const sectionsForCanvas = useMemo(() => {
    if (!inspectorDraft) return sections;
    return sections.map((s) =>
      s.id === inspectorDraft.id
        ? { ...s, label: inspectorDraft.label, config: inspectorDraft.config }
        : s,
    );
  }, [sections, inspectorDraft]);

  /**
   * Selected section resolved from the canvas-aware sections array.
   * Uses sectionsForCanvas so the inspector also reflects draft changes.
   */
  const selectedSection = sectionsForCanvas.find((s) => s.id === selectedId) ?? null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {showPreview && (
        <PreviewPanel
          pageId={pageId}
          pageTitle={pageTitle}
          pageSlug={pageSlug}
          onClose={() => setShowPreview(false)}
        />
      )}

      {showTemplates && (
        <PageTemplatesPicker
          open={showTemplates}
          pageId={pageId}
          onClose={() => setShowTemplates(false)}
          onApplied={() => { void load(); }}
        />
      )}

      <div className="space-y-4">
        {/* ── Toolbar ── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <p className="text-sm text-[var(--muted)]">
              {loading ? "Lädt…" : `${sections.length} Sektion${sections.length !== 1 ? "en" : ""}`}
            </p>
            {builderMode === "list" && (
              <SaveIndicator state={saveState} lastSaved={lastSaved} />
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* List / Canvas mode toggle */}
            <div
              className="flex items-center gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-0.5"
              role="group"
              aria-label="Ansichtsmodus"
            >
              {BUILDER_MODE_CONFIG.map(({ mode, label, icon: Icon, title }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handleBuilderModeChange(mode)}
                  title={title}
                  aria-pressed={builderMode === mode}
                  className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)] ${
                    builderMode === mode
                      ? "bg-white text-[var(--foreground)] shadow-sm font-medium"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowTemplates(true)}
              className="fca-button-secondary px-2.5"
              title="Seitenvorlage anwenden"
              aria-label="Seitenvorlage anwenden"
            >
              <Layers className="h-3.5 w-3.5" />
              <span className="hidden sm:inline ml-1 text-xs">Vorlage</span>
            </button>
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              className="fca-button-secondary px-2.5"
              title="Vorschau"
              aria-label="Seite in Vorschau öffnen"
            >
              <Eye className="h-3.5 w-3.5" />
              <span className="hidden sm:inline ml-1 text-xs">Vorschau</span>
            </button>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="fca-button-secondary px-2.5"
              title="Aktualisieren"
              aria-label="Sektionen aktualisieren"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
            {!showAdd && builderMode === "list" && (
              <button
                type="button"
                onClick={() => { setShowAdd(true); setEditingId(null); }}
                className="fca-button-primary"
              >
                <Plus className="h-4 w-4" />
                Sektion hinzufügen
              </button>
            )}
            {builderMode === "canvas" && !showAdd && (
              <button
                type="button"
                onClick={() => setShowAdd(true)}
                className="fca-button-primary"
              >
                <Plus className="h-4 w-4" />
                Sektion hinzufügen
              </button>
            )}
          </div>
        </div>

        {/* Unsaved changes warning (list mode autosave) */}
        {builderMode === "list" && isDirty && saveState !== "saving" && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <Save className="h-3.5 w-3.5 shrink-0" />
            Ungespeicherte Änderungen — wird automatisch gespeichert…
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* Add section panel */}
        {showAdd && (
          <AddSectionPanel
            pageId={pageId}
            onCreated={handleCreated}
            onCancel={() => setShowAdd(false)}
          />
        )}

        {/* ── Main builder area ── */}
        <SectionCard noPadding>
          {loading && sections.length === 0 ? (
            /* Structured loading skeleton */
            <div className="space-y-2 p-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-4 animate-pulse"
                >
                  <div className="h-5 w-5 shrink-0 rounded bg-[var(--border)]" />
                  <div className="h-7 w-7 shrink-0 rounded-full bg-[var(--border)]" />
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-[var(--border)]" />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="h-4 w-40 rounded bg-[var(--border)]" />
                    <div className="h-3 w-24 rounded bg-[var(--border)]" />
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <div className="h-5 w-12 rounded-full bg-[var(--border)]" />
                    <div className="h-5 w-16 rounded-full bg-[var(--border)]" />
                  </div>
                </div>
              ))}
            </div>
          ) : sections.length === 0 ? (
            <EmptyState
              icon={<Blocks className="h-10 w-10" />}
              heading="Keine Sektionen vorhanden"
              description="Füge die erste Sektion hinzu, um diese Seite mit Blöcken zu befüllen."
              action={
                !showAdd ? (
                  <button type="button" onClick={() => setShowAdd(true)} className="fca-button-primary">
                    <Plus className="h-4 w-4" />
                    Erste Sektion hinzufügen
                  </button>
                ) : undefined
              }
            />
          ) : builderMode === "canvas" ? (
            /* ── Canvas mode: two-column layout (canvas + inspector) ── */
            <div className="flex flex-col lg:flex-row lg:divide-x lg:divide-[var(--border)]">
              {/* Left: canvas */}
              <div className="flex-1 min-w-0">
                <PageBuilderCanvas
                  sections={sectionsForCanvas}
                  selectedId={selectedId}
                  actionPending={actionPending}
                  isAnyPending={isAnyActionPending}
                  onSelectSection={(id) =>
                    setSelectedId((prev) => (prev === id ? null : id))
                  }
                  onDeselectSection={() => setSelectedId(null)}
                  onToggle={handleToggle}
                  onMoveUp={(id) => handleMove(id, "up")}
                  onMoveDown={(id) => handleMove(id, "down")}
                  onPublish={handlePublishSection}
                  onUnpublish={handleUnpublishSection}
                  onStartEdit={(id) => setSelectedId(id)}
                  onReorder={handleCanvasReorder}
                  onDuplicate={handleDuplicate}
                  onDelete={handleDeleteRequest}
                  reorderPending={reorderPending}
                  reorderError={reorderError}
                />
              </div>

              {/* Right: inspector panel */}
              <div className="w-full lg:w-80 xl:w-96 shrink-0 border-t border-[var(--border)] lg:border-t-0">
                <div className="sticky top-0 max-h-screen overflow-y-auto">
                  <div className="border-b border-[var(--border)] px-4 py-3 bg-[var(--surface-2)]">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                      Sektion Inspector
                    </p>
                  </div>
                  <HomepageSectionInspector
                    section={
                      selectedSection
                        ? adaptSectionForCanvas(selectedSection)
                        : null
                    }
                    onDraftChange={handleInspectorDraftChange}
                    onSaveEdit={handleInspectorSave}
                  />
                </div>
              </div>
            </div>
          ) : (
            /* ── List mode: existing inline editing ── */
            <div className="divide-y divide-[var(--border)]">
              {sections.map((section, idx) => {
                const isCollapsed = collapsedIds.has(section.id);
                const isDragging = dragSrcId === section.id;
                const isDragTarget = dragOverId === section.id;

                return (
                  <Fragment key={section.id}>
                    <div
                      draggable
                      onDragStart={() => handleDragStart(section.id)}
                      onDragOver={(e) => handleDragOver(e, section.id)}
                      onDrop={(e) => handleDrop(e, section.id)}
                      onDragEnd={handleDragEnd}
                      className={`px-5 py-4 transition-colors ${
                        isDragging ? "opacity-40" : ""
                      } ${isDragTarget && !isDragging ? "bg-blue-50" : ""}`}
                    >
                      {/* Row: drag handle + info + actions */}
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        {/* Drag handle + info */}
                        <div className="min-w-0 flex-1 flex items-start gap-2">
                          <div
                            className="mt-1 cursor-grab text-[var(--muted)] hover:text-[var(--text-2)] transition shrink-0"
                            aria-hidden="true"
                          >
                            <GripVertical className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="text-xs font-medium text-[var(--muted)] w-5 text-right shrink-0">
                                {idx + 1}.
                              </span>
                              <span className="font-medium text-sm text-[var(--foreground)] truncate">
                                {section.label}
                              </span>
                              <EnabledBadge isEnabled={section.isEnabled} />
                              <PublishBadge status={section.publishStatus} />
                              <ApprovalBadge status={section.approvalStatus} />
                            </div>
                            <div className="ml-7 flex flex-wrap items-center gap-2">
                              <SectionTypeBadge type={section.type} />
                              {section.scheduledPublishAt && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-[var(--muted)]">
                                  <Clock className="h-3 w-3" />
                                  {new Date(section.scheduledPublishAt).toLocaleString("de-CH")}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          {/* Collapse/expand */}
                          <button
                            type="button"
                            onClick={() => handleToggleCollapse(section.id)}
                            className="sce-icon-button"
                            title={isCollapsed ? "Aufklappen" : "Einklappen"}
                            aria-label={isCollapsed ? "Sektion aufklappen" : "Sektion einklappen"}
                            aria-expanded={!isCollapsed}
                          >
                            <ChevronRight
                              className={`h-3.5 w-3.5 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
                            />
                          </button>
                          {/* Move up */}
                          <button
                            type="button"
                            onClick={() => handleMove(section.id, "up")}
                            disabled={actionPending === section.id || idx === 0}
                            className="sce-icon-button disabled:opacity-30"
                            title="Nach oben"
                            aria-label="Sektion nach oben verschieben"
                            aria-disabled={idx === 0}
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          {/* Move down */}
                          <button
                            type="button"
                            onClick={() => handleMove(section.id, "down")}
                            disabled={actionPending === section.id || idx === sections.length - 1}
                            className="sce-icon-button disabled:opacity-30"
                            title="Nach unten"
                            aria-label="Sektion nach unten verschieben"
                            aria-disabled={idx === sections.length - 1}
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                          {/* Toggle visible */}
                          <button
                            type="button"
                            onClick={() => handleToggle(section.id)}
                            disabled={actionPending === section.id}
                            className="sce-icon-button"
                            title={section.isEnabled ? "Deaktivieren" : "Aktivieren"}
                            aria-label={section.isEnabled ? "Sektion deaktivieren" : "Sektion aktivieren"}
                            aria-pressed={section.isEnabled}
                          >
                            {section.isEnabled ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                          {/* Edit config */}
                          <button
                            type="button"
                            onClick={() =>
                              setEditingId(editingId === section.id ? null : section.id)
                            }
                            className={`sce-icon-button ${editingId === section.id ? "text-blue-600" : ""}`}
                            title="Konfigurieren"
                            aria-label="Sektion konfigurieren"
                            aria-pressed={editingId === section.id}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          {/* Duplicate */}
                          <button
                            type="button"
                            onClick={() => handleDuplicate(section.id)}
                            disabled={actionPending === section.id}
                            className="sce-icon-button"
                            title="Duplizieren"
                            aria-label="Sektion duplizieren"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          {/* Workflow */}
                          <button
                            type="button"
                            onClick={() =>
                              setWorkflowId(workflowId === section.id ? null : section.id)
                            }
                            className={`sce-icon-button ${workflowId === section.id ? "text-emerald-600" : ""}`}
                            title="Workflow"
                            aria-label="Workflow-Aktionen"
                            aria-pressed={workflowId === section.id}
                          >
                            <Globe className="h-3.5 w-3.5" />
                          </button>
                          {/* History */}
                          <button
                            type="button"
                            onClick={() =>
                              setHistoryId(historyId === section.id ? null : section.id)
                            }
                            className={`sce-icon-button ${historyId === section.id ? "text-blue-600" : ""}`}
                            title="Versionshistorie"
                            aria-label="Versionshistorie öffnen"
                            aria-pressed={historyId === section.id}
                          >
                            <History className="h-3.5 w-3.5" />
                          </button>
                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => handleDeleteRequest(section.id)}
                            disabled={actionPending === section.id}
                            className="sce-icon-button text-rose-500 hover:text-rose-700"
                            title="Löschen"
                            aria-label="Sektion löschen"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Expandable content */}
                      {!isCollapsed && (
                        <>
                          {editingId === section.id && (
                            <ConfigEditor
                              section={section}
                              onSave={(label, config) => handleSaveConfig(section.id, label, config)}
                              onCancel={() => setEditingId(null)}
                              onChanged={triggerAutosave}
                              autoSaveRef={autosaveFnRef}
                            />
                          )}
                          {workflowId === section.id && (
                            <WorkflowPanel
                              pageId={pageId}
                              section={section}
                              onUpdated={(updated) =>
                                setSections((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
                              }
                              onClose={() => setWorkflowId(null)}
                            />
                          )}
                          {historyId === section.id && (
                            <RevisionHistoryPanel
                              pageId={pageId}
                              section={section}
                              onClose={() => setHistoryId(null)}
                              onRestored={(updated) => {
                                setSections((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
                                setHistoryId(null);
                              }}
                            />
                          )}
                        </>
                      )}
                    </div>
                  </Fragment>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* Info footer */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 space-y-1">
          <p className="text-xs text-[var(--muted)]">
            <strong className="text-[var(--text-2)]">Drag &amp; Drop:</strong>{" "}
            {builderMode === "canvas"
              ? "Sektionen können im Canvas per Ziehen und Ablegen neu geordnet werden."
              : "Sektionen können per Ziehen und Ablegen neu geordnet werden."}
          </p>
          <p className="text-xs text-[var(--muted)]">
            <strong className="text-[var(--text-2)]">Publishing:</strong>{" "}
            Sektionen sind öffentlich sichtbar wenn die übergeordnete Seite{" "}
            <strong>veröffentlicht</strong> ist, die Sektion{" "}
            <strong>aktiv</strong> und <strong>veröffentlicht</strong> ist.
          </p>
          {builderMode === "canvas" && (
            <p className="text-xs text-[var(--muted)]">
              <strong className="text-[var(--text-2)]">Canvas:</strong>{" "}
              Sektion im Canvas auswählen, um sie im Inspector rechts zu bearbeiten. Speichern ist manuell.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
