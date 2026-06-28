"use client";

/**
 * components/admin/page-builder/PageBuilderClient.tsx
 *
 * Premium Page Builder — CMS V2 Slice 9.
 *
 * Features:
 *   - Drag-and-drop reordering (native HTML5 DnD)
 *   - Move Up / Move Down
 *   - Duplicate Block
 *   - Delete Block (with confirmation)
 *   - Collapse / Expand blocks
 *   - Inline config editor with autosave (debounced 1.5s)
 *   - Unsaved changes detection (beforeunload warning)
 *   - Responsive preview panel (Desktop / Tablet / Mobile)
 *   - Section-level publish/approval status badges
 *   - Publishing workflow actions (publish, unpublish, schedule, request-review)
 *   - Version history panel
 *   - Visual save indicator (Autosaving… / Gespeichert / Fehler)
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
  LayoutPanelTop,
  List,
} from "lucide-react";
import dynamic from "next/dynamic";
import { SectionCard, EmptyState } from "@/components/ui/page";
import type { PageSectionAdminItem } from "@/lib/page-sections/admin-queries";
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
import VisualCanvas, { type CanvasSection } from "@/components/admin/visual-builder/VisualCanvas";

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
// Config editor
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
        <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-0.5">
          {(["desktop", "tablet", "mobile"] as ViewportMode[]).map((v) => {
            const vc2 = VIEWPORT_CONFIG[v];
            const Icon = vc2.icon;
            return (
              <button
                key={v}
                type="button"
                onClick={() => setViewport(v)}
                className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs transition ${
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

        <button type="button" onClick={onClose} className="fca-button-secondary px-2.5">
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
        <button type="button" onClick={onClose} className="text-[var(--muted)] hover:text-[var(--foreground)]">
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
        <button type="button" onClick={onClose} className="text-[var(--muted)] hover:text-[var(--foreground)]">
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
  const [sections, setSections] = useState<PageSectionAdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<string | null>(null);

  // UI state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  // CMS V3: Visual canvas mode
  const [viewMode, setViewMode] = useState<"list" | "canvas">("list");

  // Autosave state
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveFnRef = useRef<(() => void) | null>(null);

  // Drag-and-drop state
  const [dragSrcId, setDragSrcId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Unsaved changes warning
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

  // ---------------------------------------------------------------------------
  // Autosave trigger
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

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

  async function handleDelete(id: string) {
    if (!confirm("Sektion wirklich löschen?")) return;
    setActionPending(id);
    try {
      const res = await fetch(`/api/website-pages/${pageId}/sections/${id}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        setSections((prev) => prev.filter((s) => s.id !== id));
        if (editingId === id) setEditingId(null);
        if (historyId === id) setHistoryId(null);
        if (workflowId === id) setWorkflowId(null);
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data?.error ?? "Löschen fehlgeschlagen");
      }
    } finally {
      setActionPending(null);
    }
  }

  async function handleDuplicate(id: string) {
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

  // CMS V3: Inline canvas text update — patches a config field and autosaves
  async function handleCanvasInlineUpdate(sectionId: string, patch: Record<string, unknown>) {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;
    const updatedConfig = { ...section.config, ...patch };
    await handleSaveConfig(sectionId, section.label, updatedConfig);
  }

  // CMS V3: Open editor for a section from canvas mode
  function handleCanvasEdit(sectionId: string) {
    setViewMode("list");
    setEditingId(sectionId);
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      next.delete(sectionId);
      return next;
    });
  }

  function handleToggleCollapse(id: string) {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // ---------------------------------------------------------------------------
  // Drag-and-drop handlers
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

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
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <p className="text-sm text-[var(--muted)]">
              {loading ? "Lädt…" : `${sections.length} Sektion${sections.length !== 1 ? "en" : ""}`}
            </p>
            <SaveIndicator state={saveState} lastSaved={lastSaved} />
          </div>
          <div className="flex items-center gap-2">
            {/* CMS V3: View mode toggle */}
            <div className="flex items-center gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                title="Listenansicht"
                className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs transition-all ${
                  viewMode === "list"
                    ? "bg-[var(--surface)] font-medium text-[var(--foreground)] shadow-sm"
                    : "text-[var(--muted)] hover:text-[var(--text-2)]"
                }`}
              >
                <List className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Listenansicht</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("canvas")}
                title="Visueller Editor"
                className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs transition-all ${
                  viewMode === "canvas"
                    ? "bg-[var(--surface)] font-medium text-[var(--foreground)] shadow-sm"
                    : "text-[var(--muted)] hover:text-[var(--text-2)]"
                }`}
              >
                <LayoutPanelTop className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Visueller Editor</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowTemplates(true)}
              className="fca-button-secondary px-2.5"
              title="Seitenvorlage anwenden"
            >
              <Layers className="h-3.5 w-3.5" />
              <span className="hidden sm:inline ml-1 text-xs">Vorlage</span>
            </button>
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              className="fca-button-secondary px-2.5"
              title="Vorschau"
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
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
            {!showAdd && viewMode === "list" && (
              <button
                type="button"
                onClick={() => { setShowAdd(true); setEditingId(null); }}
                className="fca-button-primary"
              >
                <Plus className="h-4 w-4" />
                Sektion hinzufügen
              </button>
            )}
          </div>
        </div>

        {/* Unsaved changes warning */}
        {isDirty && saveState !== "saving" && (
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

        {/* CMS V3: Visual canvas mode */}
        {viewMode === "canvas" && !loading && (
          <div className="space-y-3">
            <VisualCanvas
              sections={sections.map(
                (s): CanvasSection => ({
                  id: s.id,
                  type: s.type,
                  label: s.label,
                  sortOrder: s.sortOrder,
                  isEnabled: s.isEnabled,
                  publishStatus: s.publishStatus,
                  approvalStatus: s.approvalStatus,
                  config: s.config,
                }),
              )}
              actionPending={actionPending}
              canvasActions={{
                onEdit: handleCanvasEdit,
                onMoveUp: (id) => handleMove(id, "up"),
                onMoveDown: (id) => handleMove(id, "down"),
                onDuplicate: handleDuplicate,
                onDelete: handleDelete,
                onInsertAt: () => {
                  setViewMode("list");
                  setShowAdd(true);
                  setEditingId(null);
                },
                onInlineUpdate: handleCanvasInlineUpdate,
              }}
            />
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2.5 text-xs text-[var(--muted)]">
              <strong className="text-[var(--text-2)]">Tipp:</strong>{" "}
              Klicke einen Abschnitt an, um ihn auszuwählen. Mit dem Toolbar kannst du ihn bearbeiten, duplizieren, verschieben oder löschen.
              Klicke <em>Block hinzufügen</em> zwischen zwei Abschnitten, um einen neuen Block einzufügen.
            </div>
          </div>
        )}

        {/* Section list (list mode) */}
        {viewMode === "list" && <SectionCard noPadding>
          {loading && sections.length === 0 ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-[var(--surface-2)]" />
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
          ) : (
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
                          <div className="mt-1 cursor-grab text-[var(--muted)] hover:text-[var(--text-2)] transition shrink-0">
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
                          >
                            <History className="h-3.5 w-3.5" />
                          </button>
                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => handleDelete(section.id)}
                            disabled={actionPending === section.id}
                            className="sce-icon-button text-rose-500 hover:text-rose-700"
                            title="Löschen"
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
        </SectionCard>}

        {/* Info footer */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 space-y-1">
          <p className="text-xs text-[var(--muted)]">
            <strong className="text-[var(--text-2)]">Drag & Drop:</strong>{" "}
            Sektionen können per Ziehen und Ablegen neu geordnet werden.
          </p>
          <p className="text-xs text-[var(--muted)]">
            <strong className="text-[var(--text-2)]">Publishing:</strong>{" "}
            Sektionen sind öffentlich sichtbar wenn die übergeordnete Seite{" "}
            <strong>veröffentlicht</strong> ist, die Sektion{" "}
            <strong>aktiv</strong> und <strong>veröffentlicht</strong> ist.
          </p>
        </div>
      </div>
    </>
  );
}
