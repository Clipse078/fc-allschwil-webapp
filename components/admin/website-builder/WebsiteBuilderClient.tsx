"use client";

/**
 * components/admin/website-builder/WebsiteBuilderClient.tsx
 *
 * Unified Website Builder — CMS V3.
 *
 * Single implementation used by both:
 *   - Homepage Builder  (/dashboard/website/homepage)
 *   - Page Builder      (/dashboard/website/pages/[id]/builder)
 *
 * Data source differences are handled by the SectionAdapter interface.
 * The builder UI is identical regardless of which backend is used.
 *
 * Features:
 *   - WYSIWYG canvas + Inspector tabs (splitContentCards)
 *   - Drag-and-drop reorder (when adapter.capabilities.canDragReorder)
 *   - Move Up / Move Down
 *   - Duplicate / Delete (conditional on capabilities)
 *   - Inline config editor with autosave (debounced 1.5s)
 *   - Responsive preview panel
 *   - Section-level publish/approval workflow
 *   - Version history panel (when capabilities.hasRevisions)
 *   - Bootstrap button (when adapter.bootstrap exists and sections are empty)
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
  Sparkles,
} from "lucide-react";
import dynamic from "next/dynamic";
import { SectionCard, EmptyState } from "@/components/ui/page";
import type { SectionAdapter, SectionItem, PreviewSectionItem } from "@/lib/website-builder/adapter";
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

// Lazy-load premium block forms
const SplitContentCardsConfigForm = dynamic(
  () => import("@/components/admin/page-builder/block-forms/SplitContentCardsConfigForm"),
  { ssr: false, loading: () => <div className="h-32 animate-pulse rounded-lg bg-[var(--surface-2)]" /> },
);

// Lazy-load shared block renderer for live preview
const SplitContentCardsRenderer = dynamic(
  () => import("@/components/website/blocks/SplitContentCardsRenderer"),
  { ssr: false, loading: () => <div className="h-32 animate-pulse rounded-lg bg-[var(--surface-2)]" /> },
);

// Lazy-load admin WYSIWYG canvas
const SplitContentCardsEditableCanvas = dynamic(
  () => import("@/components/admin/page-builder/SplitContentCardsEditableCanvas"),
  { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-lg bg-[var(--surface-2)]" /> },
);

const PREMIUM_BLOCK_TYPES = new Set(["splitContentCards"]);

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
// Status badges (identical to PageBuilderClient)
// ---------------------------------------------------------------------------

function PublishBadge({ status }: { status: string }) {
  const isPublished = status === SECTION_PUBLISH_STATUS.PUBLISHED;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${isPublished ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
      {isPublished ? <Globe className="h-3 w-3" /> : <GlobeLock className="h-3 w-3" />}
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
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${isEnabled ? "bg-emerald-50 text-emerald-700" : "bg-[var(--surface-2)] text-[var(--muted)]"}`}>
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
      {state === "saving" && (<><RefreshCw className="h-3 w-3 animate-spin text-blue-500" /><span className="text-[var(--muted)]">Speichern…</span></>)}
      {state === "saved" && (<><Check className="h-3 w-3 text-emerald-500" /><span className="text-[var(--muted)]">Gespeichert{lastSaved ? ` · ${lastSaved.toLocaleTimeString("de-CH")}` : ""}</span></>)}
      {state === "error" && (<><AlertCircle className="h-3 w-3 text-rose-500" /><span className="text-rose-600">Speichern fehlgeschlagen</span></>)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Config editor
// ---------------------------------------------------------------------------

type ConfigEditorProps = {
  section: SectionItem;
  onSave: (label: string, config: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
  onChanged?: () => void;
  autoSaveRef?: React.MutableRefObject<(() => void) | null>;
};

function ConfigEditor({ section, onSave, onCancel, onChanged, autoSaveRef }: ConfigEditorProps) {
  const def = getBlockDefinition(section.type);
  const configKeys = useMemo(
    () => (def?.configKeys ?? []).filter((k) => k !== "_layout"),
    [def],
  );
  const isPremium = PREMIUM_BLOCK_TYPES.has(section.type);
  const supportsLayout = def?.supportsLayout ?? false;

  const [label, setLabel] = useState(section.label);
  const [values, setValues] = useState<Record<string, string>>(() => {
    if (isPremium) return {};
    const init: Record<string, string> = {};
    for (const k of configKeys) {
      const v = section.config[k];
      init[k] = v !== undefined && v !== null ? String(v) : "";
    }
    return init;
  });
  const [genericLayout, setGenericLayout] = useState<SectionLayout>(
    () => (section.config._layout as SectionLayout | undefined) ?? {},
  );
  const [premiumConfig, setPremiumConfig] = useState<Record<string, unknown>>(() =>
    isPremium ? { ...section.config } : {},
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editorTab, setEditorTab] = useState<"canvas" | "inspector">("canvas");
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
    if (supportsLayout) config._layout = genericLayout;
    return config;
  }, [isPremium, premiumConfig, configKeys, values, supportsLayout, genericLayout]);

  async function handleSave() {
    const trimmed = label.trim();
    if (!trimmed) { setError("Label darf nicht leer sein."); return; }
    setSaving(true);
    setError(null);
    try { await onSave(trimmed, buildConfig()); }
    catch (err) { setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen."); }
    finally { setSaving(false); }
  }

  useEffect(() => {
    if (autoSaveRef) {
      autoSaveRef.current = () => {
        const trimmed = label.trim();
        if (trimmed) void onSave(trimmed, buildConfig()).catch(() => {});
      };
    }
    return () => { if (autoSaveRef) autoSaveRef.current = null; };
  }, [label, buildConfig, onSave, autoSaveRef]);

  return (
    <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4">
      <div className="space-y-3">
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)] mb-1">Label</label>
          <input
            className="fca-input w-full"
            value={label}
            onChange={(e) => { setLabel(e.target.value); onChanged?.(); }}
            placeholder="Sektionsbezeichnung"
          />
        </div>

        {/* Premium block: WYSIWYG canvas + inspector tabs */}
        {isPremium && section.type === "splitContentCards" && (
          <div className="space-y-3">
            <div className="flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-0.5">
              <button
                type="button"
                onClick={() => setEditorTab("canvas")}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-xs transition ${editorTab === "canvas" ? "bg-white font-semibold text-[var(--foreground)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}
              >
                <LayoutPanelLeft className="h-3.5 w-3.5" />
                Canvas
              </button>
              <button
                type="button"
                onClick={() => setEditorTab("inspector")}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-xs transition ${editorTab === "inspector" ? "bg-white font-semibold text-[var(--foreground)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}
              >
                <Layers className="h-3.5 w-3.5" />
                Inspektor
              </button>
            </div>

            {editorTab === "canvas" && (
              <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-white">
                <Suspense fallback={<div className="h-64 animate-pulse bg-gray-100" />}>
                  <SplitContentCardsEditableCanvas
                    config={premiumConfig}
                    onConfigChange={(updated) => { setPremiumConfig(updated); onChanged?.(); }}
                  />
                </Suspense>
              </div>
            )}

            {editorTab === "inspector" && (
              <SplitContentCardsConfigForm
                config={premiumConfig}
                onChange={(updated) => { setPremiumConfig(updated); onChanged?.(); }}
              />
            )}
          </div>
        )}

        {/* Generic block: key-value editor */}
        {!isPremium && configKeys.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Konfiguration</p>
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
          <p className="text-xs text-[var(--muted)] italic">Dieser Blocktyp hat keine konfigurierbaren Felder.</p>
        )}

        {/* Layout panel for generic blocks */}
        {!isPremium && supportsLayout && (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)]">
            <button
              type="button"
              onClick={() => setShowLayoutPanel((v) => !v)}
              className="flex w-full items-center justify-between px-3 py-2.5 text-left"
            >
              <div className="flex items-center gap-2">
                <Layers className="h-3.5 w-3.5 text-[var(--text-2)]" />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Layout</span>
              </div>
              <ChevronDown className={`h-3.5 w-3.5 text-[var(--muted)] transition-transform ${showLayoutPanel ? "rotate-180" : ""}`} />
            </button>
            {showLayoutPanel && (
              <div className="border-t border-[var(--border)] p-3">
                <LayoutConfigPanel
                  layout={genericLayout}
                  onChange={(layout) => { setGenericLayout(layout); onChanged?.(); }}
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
// Add section panel (page-only — hidden when !capabilities.canCreate)
// ---------------------------------------------------------------------------

const AVAILABLE_BLOCKS: BlockDefinition[] = BLOCK_REGISTRY.filter(
  (b) => HOMEPAGE_SECTION_TYPE_KEYS.includes(b.type as (typeof HOMEPAGE_SECTION_TYPE_KEYS)[number]) && b.status !== "coming-next",
);

function AddSectionPanel({
  onCreated,
  onCancel,
  adapter,
}: {
  onCreated: (section: SectionItem) => void;
  onCancel: () => void;
  adapter: SectionAdapter;
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
      const section = await adapter.create(
        selectedType,
        label.trim() || def?.displayName || selectedType,
        def?.defaultConfig ?? {},
      );
      onCreated(section);
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
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)] mb-1">Blocktyp</label>
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
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)] mb-1">Label (optional)</label>
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

function PreviewPanel({
  adapter,
  onClose,
}: {
  adapter: SectionAdapter;
  onClose: () => void;
}) {
  const [viewport, setViewport] = useState<ViewportMode>("desktop");
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState<PreviewSectionItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    adapter.loadPreview()
      .then((s) => { if (!cancelled) { setSections(s); setLoading(false); } })
      .catch(() => { if (!cancelled) { setError("Vorschau konnte nicht geladen werden."); setLoading(false); } });
    return () => { cancelled = true; };
  }, [adapter]);

  const vc = VIEWPORT_CONFIG[viewport];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--background)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <div className="flex items-center gap-3">
          <Eye className="h-4 w-4 text-[var(--text-2)]" />
          <div>
            <p className="text-sm font-semibold">{adapter.contextTitle}</p>
            <p className="text-[11px] text-[var(--muted)]">/{adapter.contextSlug}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-0.5">
          {(["desktop", "tablet", "mobile"] as ViewportMode[]).map((v) => {
            const vc2 = VIEWPORT_CONFIG[v];
            const Icon = vc2.icon;
            return (
              <button
                key={v}
                type="button"
                onClick={() => setViewport(v)}
                className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs transition ${viewport === v ? "bg-white text-[var(--foreground)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}
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

      <div className="flex-1 overflow-auto bg-[var(--surface-2)] p-4">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-[var(--muted)]">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" />Lädt Vorschau…
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-32 text-rose-600 text-sm">{error}</div>
        ) : (
          <div className="mx-auto transition-all duration-300 rounded-lg border border-[var(--border)] bg-white overflow-hidden" style={{ maxWidth: vc.width }}>
            {sections.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-[var(--muted)]">
                <Blocks className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">Keine Sektionen vorhanden</p>
              </div>
            ) : (
              <div>
                {sections.map((s) => (
                  <div key={s.id} className={`border-b border-[var(--border)] last:border-0 ${!s.isEnabled || s.publishStatus !== "PUBLISHED" ? "opacity-50" : ""}`}>
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
                    <Suspense fallback={<div className="h-16 animate-pulse bg-gray-50" />}>
                      <BlockVisualPreview type={s.type} config={s.config} />
                    </Suspense>
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
  adapter,
  section,
  onClose,
  onRestored,
}: {
  adapter: SectionAdapter;
  section: SectionItem;
  onClose: () => void;
  onRestored: (section: SectionItem) => void;
}) {
  const [revisions, setRevisions] = useState<ContentRevisionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    adapter.getRevisions(section.id)
      .then((r) => { setRevisions(r); setLoading(false); })
      .catch(() => { setError("Versionen konnten nicht geladen werden."); setLoading(false); });
  }, [adapter, section.id]);

  async function handleRestore(revId: string, versionNumber: number) {
    if (!confirm(`Version ${versionNumber} wiederherstellen? Dies erstellt eine neue Version.`)) return;
    setRestoring(revId);
    try {
      const updated = await adapter.restoreRevision(section.id, revId);
      onRestored(updated);
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
      {loading && <div className="flex items-center gap-2 py-4 text-sm text-[var(--muted)]"><RefreshCw className="h-4 w-4 animate-spin" /> Lädt…</div>}
      {error && <p className="text-xs text-rose-600 py-2">{error}</p>}
      {!loading && !error && revisions.length === 0 && <p className="text-xs text-[var(--muted)] py-2">Noch keine Versionen vorhanden.</p>}
      {!loading && revisions.length > 0 && (
        <div className="space-y-1 max-h-72 overflow-y-auto">
          {revisions.map((rev) => (
            <div key={rev.id} className="flex items-start justify-between gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 font-medium text-[var(--foreground)]">
                  <span className="text-[var(--muted)]">v{rev.versionNumber}</span>
                  {rev.isRestore && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">Wiederherstellung</span>}
                  {rev.changeNote && <span className="truncate">{rev.changeNote}</span>}
                </div>
                <div className="text-[var(--muted)] mt-0.5">
                  {rev.createdByUser ? `${rev.createdByUser.firstName} ${rev.createdByUser.lastName} · ` : ""}
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
  adapter,
  section,
  onUpdated,
  onClose,
}: {
  adapter: SectionAdapter;
  section: SectionItem;
  onUpdated: (section: SectionItem) => void;
  onClose: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");

  async function doAction(action: string, extra?: Record<string, unknown>) {
    setPending(true);
    setError(null);
    try {
      const updated = await adapter.workflow(section.id, action, extra);
      onUpdated(updated);
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
        <button type="button" onClick={onClose} className="text-[var(--muted)] hover:text-[var(--foreground)]"><X className="h-4 w-4" /></button>
      </div>
      <div className="flex flex-wrap gap-2">
        {ps === SECTION_PUBLISH_STATUS.DRAFT && canPublish && (
          <button type="button" onClick={() => doAction("publish")} disabled={pending} className="fca-button-primary py-1.5 text-xs">
            <Globe className="h-3.5 w-3.5" />Veröffentlichen
          </button>
        )}
        {ps === SECTION_PUBLISH_STATUS.PUBLISHED && (
          <button type="button" onClick={() => doAction("unpublish")} disabled={pending} className="fca-button-secondary py-1.5 text-xs">
            <GlobeLock className="h-3.5 w-3.5" />Zurückziehen
          </button>
        )}
        {as !== SECTION_APPROVAL_STATUS.IN_REVIEW && (
          <button type="button" onClick={() => doAction("request-review")} disabled={pending} className="fca-button-secondary py-1.5 text-xs">
            <Send className="h-3.5 w-3.5" />Zur Überprüfung
          </button>
        )}
        {as === SECTION_APPROVAL_STATUS.IN_REVIEW && (
          <>
            <button type="button" onClick={() => doAction("approve")} disabled={pending} className="fca-button-primary py-1.5 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5" />Freigeben
            </button>
            <button type="button" onClick={() => doAction("reject")} disabled={pending} className="fca-button-secondary py-1.5 text-xs text-rose-600">
              <X className="h-3.5 w-3.5" />Ablehnen
            </button>
          </>
        )}
      </div>
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
            onClick={() => doAction("schedule", { scheduledPublishAt: new Date(scheduledAt).toISOString() })}
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
// Main WebsiteBuilderClient
// ---------------------------------------------------------------------------

type WebsiteBuilderClientProps = {
  adapter: SectionAdapter;
  /** Show the page templates picker (page builder only). */
  pageId?: string;
};

export default function WebsiteBuilderClient({ adapter, pageId }: WebsiteBuilderClientProps) {
  const { capabilities } = adapter;

  const [sections, setSections] = useState<SectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveFnRef = useRef<(() => void) | null>(null);

  const [dragSrcId, setDragSrcId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

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
      const s = await adapter.load();
      setSections(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, [adapter]);

  useEffect(() => { load(); }, [load]);

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

  async function handleToggle(id: string) {
    setActionPending(id);
    try {
      const updated = await adapter.toggle(id);
      setSections((prev) => prev.map((s) => (s.id === id ? updated : s)));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Fehler");
    } finally {
      setActionPending(null);
    }
  }

  async function handleMove(id: string, direction: "up" | "down") {
    setActionPending(id);
    try {
      const updated = await adapter.move(id, direction);
      setSections(updated);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Fehler");
    } finally {
      setActionPending(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Sektion wirklich löschen?")) return;
    setActionPending(id);
    try {
      await adapter.delete(id);
      setSections((prev) => prev.filter((s) => s.id !== id));
      if (editingId === id) setEditingId(null);
      if (historyId === id) setHistoryId(null);
      if (workflowId === id) setWorkflowId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Löschen fehlgeschlagen");
    } finally {
      setActionPending(null);
    }
  }

  async function handleDuplicate(id: string) {
    setActionPending(id);
    try {
      const section = await adapter.duplicate(id);
      setSections((prev) => [...prev, section]);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Fehler");
    } finally {
      setActionPending(null);
    }
  }

  async function handleSaveConfig(id: string, label: string, config: Record<string, unknown>) {
    setSaveState("saving");
    try {
      const updated = await adapter.saveConfig(id, label, config);
      setSections((prev) => prev.map((s) => (s.id === id ? updated : s)));
      setSaveState("saved");
      setLastSaved(new Date());
      setIsDirty(false);
      if (autosaveTimerRef.current) { clearTimeout(autosaveTimerRef.current); autosaveTimerRef.current = null; }
    } catch (err) {
      setSaveState("error");
      throw err;
    }
  }

  async function handleBootstrap() {
    if (!adapter.bootstrap) return;
    if (!confirm("Standard-Sektionen erstellen? Dies legt alle Standard-Sektionen an.")) return;
    setBootstrapping(true);
    try {
      const created = await adapter.bootstrap();
      setSections(created);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Fehler beim Erstellen der Standard-Sektionen");
    } finally {
      setBootstrapping(false);
    }
  }

  function handleCreated(section: SectionItem) {
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

  // Drag-and-drop (only when capabilities.canDragReorder)
  function handleDragStart(id: string) { if (capabilities.canDragReorder) setDragSrcId(id); }
  function handleDragOver(e: React.DragEvent, id: string) { if (!capabilities.canDragReorder) return; e.preventDefault(); setDragOverId(id); }

  async function handleDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    if (!capabilities.canDragReorder || !dragSrcId || dragSrcId === targetId) {
      setDragSrcId(null); setDragOverId(null); return;
    }
    const srcIdx = sections.findIndex((s) => s.id === dragSrcId);
    const tgtIdx = sections.findIndex((s) => s.id === targetId);
    if (srcIdx === -1 || tgtIdx === -1) { setDragSrcId(null); setDragOverId(null); return; }
    const reordered = [...sections];
    const [moved] = reordered.splice(srcIdx, 1);
    reordered.splice(tgtIdx, 0, moved);
    setSections(reordered);
    setDragSrcId(null); setDragOverId(null);
    try {
      const updated = await adapter.reorder(reordered.map((s) => s.id));
      setSections(updated);
    } catch {
      // Optimistic update already applied
    }
  }

  function handleDragEnd() { setDragSrcId(null); setDragOverId(null); }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      {showPreview && (
        <PreviewPanel adapter={adapter} onClose={() => setShowPreview(false)} />
      )}

      {showTemplates && pageId && (
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
            {pageId && (
              <button
                type="button"
                onClick={() => setShowTemplates(true)}
                className="fca-button-secondary px-2.5"
                title="Seitenvorlage anwenden"
              >
                <Layers className="h-3.5 w-3.5" />
                <span className="hidden sm:inline ml-1 text-xs">Vorlage</span>
              </button>
            )}
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
            {capabilities.canCreate && !showAdd && (
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

        {error && (
          <div className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        )}

        {/* Add section panel */}
        {showAdd && capabilities.canCreate && (
          <AddSectionPanel
            adapter={adapter}
            onCreated={handleCreated}
            onCancel={() => setShowAdd(false)}
          />
        )}

        {/* Section list */}
        <SectionCard noPadding>
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
              description={
                adapter.bootstrap
                  ? "Erstelle die Standard-Sektionen, um mit dem Builder zu starten."
                  : "Füge die erste Sektion hinzu, um diese Seite mit Blöcken zu befüllen."
              }
              action={
                adapter.bootstrap ? (
                  <button
                    type="button"
                    onClick={handleBootstrap}
                    disabled={bootstrapping}
                    className="fca-button-primary"
                  >
                    <Sparkles className="h-4 w-4" />
                    {bootstrapping ? "Wird erstellt…" : "Standard-Sektionen erstellen"}
                  </button>
                ) : !showAdd && capabilities.canCreate ? (
                  <button
                    type="button"
                    onClick={() => setShowAdd(true)}
                    className="fca-button-primary"
                  >
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
                      draggable={capabilities.canDragReorder}
                      onDragStart={() => handleDragStart(section.id)}
                      onDragOver={(e) => handleDragOver(e, section.id)}
                      onDrop={(e) => handleDrop(e, section.id)}
                      onDragEnd={handleDragEnd}
                      className={`px-5 py-4 transition-colors ${isDragging ? "opacity-40" : ""} ${isDragTarget && !isDragging ? "bg-blue-50" : ""}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        {/* Drag handle + info */}
                        <div className="min-w-0 flex-1 flex items-start gap-2">
                          {capabilities.canDragReorder && (
                            <div className="mt-1 cursor-grab text-[var(--muted)] hover:text-[var(--text-2)] transition shrink-0">
                              <GripVertical className="h-4 w-4" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="text-xs font-medium text-[var(--muted)] w-5 text-right shrink-0">{idx + 1}.</span>
                              <span className="font-medium text-sm text-[var(--foreground)] truncate">{section.label}</span>
                              <EnabledBadge isEnabled={section.isEnabled} />
                              <PublishBadge status={section.publishStatus} />
                              <ApprovalBadge status={section.approvalStatus} />
                            </div>
                            <div className={`flex flex-wrap items-center gap-2 ${capabilities.canDragReorder ? "ml-7" : ""}`}>
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
                          <button type="button" onClick={() => handleToggleCollapse(section.id)} className="sce-icon-button" title={isCollapsed ? "Aufklappen" : "Einklappen"}>
                            <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isCollapsed ? "" : "rotate-90"}`} />
                          </button>
                          {/* Move up */}
                          <button type="button" onClick={() => handleMove(section.id, "up")} disabled={actionPending === section.id || idx === 0} className="sce-icon-button disabled:opacity-30" title="Nach oben">
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          {/* Move down */}
                          <button type="button" onClick={() => handleMove(section.id, "down")} disabled={actionPending === section.id || idx === sections.length - 1} className="sce-icon-button disabled:opacity-30" title="Nach unten">
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                          {/* Toggle visible */}
                          <button type="button" onClick={() => handleToggle(section.id)} disabled={actionPending === section.id} className="sce-icon-button" title={section.isEnabled ? "Deaktivieren" : "Aktivieren"}>
                            {section.isEnabled ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => setEditingId(editingId === section.id ? null : section.id)}
                            className={`sce-icon-button ${editingId === section.id ? "text-blue-600" : ""}`}
                            title="Konfigurieren"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          {/* Duplicate */}
                          {capabilities.canDuplicate && (
                            <button type="button" onClick={() => handleDuplicate(section.id)} disabled={actionPending === section.id} className="sce-icon-button" title="Duplizieren">
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {/* Workflow */}
                          <button
                            type="button"
                            onClick={() => setWorkflowId(workflowId === section.id ? null : section.id)}
                            className={`sce-icon-button ${workflowId === section.id ? "text-emerald-600" : ""}`}
                            title="Workflow"
                          >
                            <Globe className="h-3.5 w-3.5" />
                          </button>
                          {/* History */}
                          {capabilities.hasRevisions && (
                            <button
                              type="button"
                              onClick={() => setHistoryId(historyId === section.id ? null : section.id)}
                              className={`sce-icon-button ${historyId === section.id ? "text-blue-600" : ""}`}
                              title="Versionshistorie"
                            >
                              <History className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {/* Delete */}
                          {capabilities.canDelete && (
                            <button type="button" onClick={() => handleDelete(section.id)} disabled={actionPending === section.id} className="sce-icon-button text-rose-500 hover:text-rose-700" title="Löschen">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expandable panels */}
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
                              adapter={adapter}
                              section={section}
                              onUpdated={(updated) => setSections((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))}
                              onClose={() => setWorkflowId(null)}
                            />
                          )}
                          {capabilities.hasRevisions && historyId === section.id && (
                            <RevisionHistoryPanel
                              adapter={adapter}
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
          {capabilities.canDragReorder && (
            <p className="text-xs text-[var(--muted)]">
              <strong className="text-[var(--text-2)]">Drag &amp; Drop:</strong>{" "}
              Sektionen können per Ziehen und Ablegen neu geordnet werden.
            </p>
          )}
          <p className="text-xs text-[var(--muted)]">
            <strong className="text-[var(--text-2)]">Publishing:</strong>{" "}
            Sektionen sind öffentlich sichtbar wenn sie <strong>aktiv</strong> und <strong>veröffentlicht</strong> sind.
          </p>
        </div>
      </div>
    </>
  );
}
