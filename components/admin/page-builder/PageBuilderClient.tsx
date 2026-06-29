"use client";

/**
 * components/admin/page-builder/PageBuilderClient.tsx
 *
 * Premium Page Builder — CMS V3 Inspector Panel V2.
 *
 * Features:
 *   - Drag-and-drop reordering (native HTML5 DnD)
 *   - Move Up / Move Down
 *   - Duplicate Block
 *   - Delete Block (with confirmation)
 *   - Collapse / Expand block rows
 *   - Sidebar Inspector Panel (Figma/Framer-style)
 *   - Autosave (debounced 1.5s)
 *   - Unsaved changes detection (beforeunload warning)
 *   - Responsive preview panel (Desktop / Tablet / Mobile)
 *   - Visual save indicator (Autosaving… / Gespeichert / Fehler)
 *
 * Inspector architecture:
 *   - Clicking any block row selects it and opens the Inspector sidebar.
 *   - The Inspector renders sections dynamically from the block's
 *     supportsInspector capability map.
 *   - Workflow (publish/unpublish/approve/schedule/request-review/reject)
 *     and revision history are surfaced inside the Inspector's Publishing section.
 *   - All API calls are lifted into callback bundles; the Inspector has
 *     no knowledge of which endpoints to call.
 */

import {
  useState,
  useEffect,
  useCallback,
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
  Monitor,
  Tablet,
  Smartphone,
  AlertCircle,
  Save,
  Layers,
  PanelRight,
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
import {
  SECTION_PUBLISH_STATUS,
  SECTION_APPROVAL_STATUS,
} from "@/lib/cms/section-publishing";
import PageTemplatesPicker from "@/components/admin/page-builder/PageTemplatesPicker";
import InspectorPanel from "@/components/admin/inspector/InspectorPanel";
import type { InspectorSaveState } from "@/components/admin/inspector/InspectorToolbar";
import type {
  InspectorSectionData,
  InspectorWorkflowCallbacks,
  InspectorRevisionCallbacks,
} from "@/lib/cms/inspector-types";
import { adaptToInspectorData } from "@/lib/cms/inspector-types";
import type { ContentRevisionItem } from "@/lib/cms/revision-engine";

const SplitContentCardsRenderer = dynamic(
  () => import("@/components/website/blocks/SplitContentCardsRenderer"),
  {
    ssr: false,
    loading: () => (
      <div className="h-32 animate-pulse rounded-lg bg-[var(--surface-2)]" />
    ),
  },
);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AUTOSAVE_DELAY_MS = 1500;
const RENDERABLE_BLOCK_TYPES = new Set(["splitContentCards"]);

// ---------------------------------------------------------------------------
// Status badges
// ---------------------------------------------------------------------------

function PublishBadge({ status }: { status: string }) {
  const isPublished = status === SECTION_PUBLISH_STATUS.PUBLISHED;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
        isPublished ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
      }`}
    >
      {isPublished ? <Globe className="h-3 w-3" /> : <GlobeLock className="h-3 w-3" />}
      {isPublished ? "Veröffentlicht" : "Entwurf"}
    </span>
  );
}

function ApprovalBadge({ status }: { status: string }) {
  if (status === SECTION_APPROVAL_STATUS.NOT_REQUIRED) return null;
  const cfg: Record<string, { label: string; colorClass: string }> = {
    DRAFT: { label: "Entwurf", colorClass: "bg-gray-100 text-gray-600" },
    IN_REVIEW: { label: "In Überprüfung", colorClass: "bg-blue-50 text-blue-700" },
    APPROVED: { label: "Freigegeben", colorClass: "bg-emerald-50 text-emerald-700" },
    CHANGES_REQUESTED: { label: "Änderungen nötig", colorClass: "bg-rose-50 text-rose-700" },
  };
  const c = cfg[status] ?? { label: status, colorClass: "bg-gray-100 text-gray-600" };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${c.colorClass}`}>
      {c.label}
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
// Save indicator
// ---------------------------------------------------------------------------

function SaveIndicator({ state, lastSaved }: { state: InspectorSaveState; lastSaved: Date | null }) {
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
// Block visual preview
// ---------------------------------------------------------------------------

function BlockVisualPreview({ type, config }: { type: string; config: Record<string, unknown> }) {
  if (type === "splitContentCards") {
    return <SplitContentCardsRenderer config={config} previewMode />;
  }
  return null;
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
      <p className="mb-3 text-sm font-semibold text-[var(--foreground)]">
        Neue Sektion hinzufügen
      </p>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
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
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
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
          <button
            type="button"
            onClick={handleCreate}
            disabled={saving || !selectedType}
            className="fca-button-primary py-1.5 text-xs"
          >
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
      .then((d) => { if (!cancelled) { setSections(d.sections ?? []); setLoading(false); } })
      .catch(() => { if (!cancelled) { setError("Vorschau konnte nicht geladen werden."); setLoading(false); } });
    return () => { cancelled = true; };
  }, [pageId]);

  const vc = VIEWPORT_CONFIG[viewport];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--background)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <div className="flex items-center gap-3">
          <Eye className="h-4 w-4 text-[var(--text-2)]" />
          <div>
            <p className="text-sm font-semibold">{pageTitle}</p>
            <p className="text-[11px] text-[var(--muted)]">/{pageSlug}</p>
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
                className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs transition ${
                  viewport === v ? "bg-white text-[var(--foreground)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--foreground)]"
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

      <div className="flex-1 overflow-auto bg-[var(--surface-2)] p-4">
        {loading ? (
          <div className="flex h-32 items-center justify-center text-[var(--muted)]">
            <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
            Lädt Vorschau…
          </div>
        ) : error ? (
          <div className="flex h-32 items-center justify-center text-sm text-rose-600">{error}</div>
        ) : (
          <div
            className="mx-auto overflow-hidden rounded-lg border border-[var(--border)] bg-white transition-all duration-300"
            style={{ maxWidth: vc.width }}
          >
            {sections.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-[var(--muted)]">
                <Blocks className="mb-2 h-8 w-8 opacity-40" />
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
                    <div className="flex items-center justify-between bg-[var(--surface-2)] px-4 py-2">
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
                    {!RENDERABLE_BLOCK_TYPES.has(s.type) && Object.keys(s.config).length > 0 && (
                      <div className="px-4 pb-3">
                        <div className="rounded bg-[var(--surface-2)] px-2 py-1.5">
                          <p className="font-mono text-[10px] text-[var(--muted)]">
                            {JSON.stringify(s.config, null, 2).slice(0, 200)}
                            {JSON.stringify(s.config).length > 200 ? "…" : ""}
                          </p>
                        </div>
                      </div>
                    )}
                    {!RENDERABLE_BLOCK_TYPES.has(s.type) && s.block && (
                      <p className="px-4 pb-3 text-[11px] text-[var(--muted)]">{s.block.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs text-[var(--muted)]">
        <span>{sections.length} Sektion{sections.length !== 1 ? "en" : ""} (inkl. Entwürfe)</span>
        <span>·</span>
        <span>{sections.filter((s) => s.publishStatus === "PUBLISHED" && s.isEnabled).length} öffentlich sichtbar</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page Builder workflow / revision callback factories
// ---------------------------------------------------------------------------

function buildWorkflowCallbacks(
  pageId: string,
  sectionId: string,
  onSuccess: (updated: PageSectionAdminItem) => void,
): InspectorWorkflowCallbacks {
  async function doAction(
    action: string,
    extra?: Record<string, unknown>,
  ): Promise<InspectorSectionData> {
    const res = await fetch(
      `/api/website-pages/${pageId}/sections/${sectionId}/workflow?action=${action}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(extra ?? {}),
      },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error ?? "Fehler");
    onSuccess(data.section);
    return adaptToInspectorData(data.section as PageSectionAdminItem);
  }

  return {
    publish: () => doAction("publish"),
    unpublish: () => doAction("unpublish"),
    requestReview: () => doAction("request-review"),
    approve: () => doAction("approve"),
    reject: () => doAction("reject"),
    schedule: (isoDate) => doAction("schedule", { scheduledAt: isoDate }),
  };
}

function buildRevisionCallbacks(
  pageId: string,
  sectionId: string,
  onRestored: (updated: PageSectionAdminItem) => void,
): InspectorRevisionCallbacks {
  return {
    loadRevisions: async () => {
      const res = await fetch(
        `/api/website-pages/${pageId}/sections/${sectionId}/revisions`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Fehler");
      return (data.revisions ?? []) as ContentRevisionItem[];
    },
    restore: async (revId) => {
      const res = await fetch(
        `/api/website-pages/${pageId}/sections/${sectionId}/revisions/${revId}/restore`,
        { method: "POST" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Fehler");
      onRestored(data.section as PageSectionAdminItem);
      return adaptToInspectorData(data.section as PageSectionAdminItem);
    },
  };
}

// ---------------------------------------------------------------------------
// Main PageBuilderClient
// ---------------------------------------------------------------------------

type PageBuilderClientProps = {
  pageId: string;
  pageTitle?: string;
  pageSlug?: string;
};

export default function PageBuilderClient({
  pageId,
  pageTitle = "",
  pageSlug = "",
}: PageBuilderClientProps) {
  const [sections, setSections] = useState<PageSectionAdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<string | null>(null);

  // Selection (Inspector Panel)
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Inspector shadow state
  const [inspectorConfig, setInspectorConfig] = useState<Record<string, unknown>>({});
  const [inspectorLabel, setInspectorLabel] = useState<string>("");

  // UI state
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  // Autosave state
  const [saveState, setSaveState] = useState<InspectorSaveState>("idle");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const inspectorRef = useRef<{
    id: string | null;
    label: string;
    config: Record<string, unknown>;
  }>({ id: null, label: "", config: {} });

  useEffect(() => {
    inspectorRef.current = {
      id: selectedId,
      label: inspectorLabel,
      config: inspectorConfig,
    };
  }, [selectedId, inspectorLabel, inspectorConfig]);

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
  // Inspector selection
  // ---------------------------------------------------------------------------

  function selectSection(section: PageSectionAdminItem) {
    setSelectedId(section.id);
    setInspectorConfig({ ...section.config });
    setInspectorLabel(section.label);
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
  }

  function closeInspector() {
    setSelectedId(null);
    setIsDirty(false);
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Autosave
  // ---------------------------------------------------------------------------

  const triggerAutosave = useCallback(() => {
    setIsDirty(true);
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(async () => {
      const { id, label, config } = inspectorRef.current;
      if (!id || !label.trim()) return;
      setSaveState("saving");
      try {
        const res = await fetch(`/api/website-pages/${pageId}/sections/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: label.trim(), config }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error ?? "Speichern fehlgeschlagen");
        setSections((prev) => prev.map((s) => (s.id === id ? data.section : s)));
        setSaveState("saved");
        setLastSaved(new Date());
        setIsDirty(false);
      } catch {
        setSaveState("error");
      }
    }, AUTOSAVE_DELAY_MS);
  }, [pageId]);

  // ---------------------------------------------------------------------------
  // Inspector change handlers
  // ---------------------------------------------------------------------------

  const handleInspectorConfigChange = useCallback(
    (config: Record<string, unknown>) => {
      setInspectorConfig(config);
      triggerAutosave();
    },
    [triggerAutosave],
  );

  const handleInspectorLabelChange = useCallback(
    (label: string) => {
      setInspectorLabel(label);
      triggerAutosave();
    },
    [triggerAutosave],
  );

  // Called by workflow actions and revision restores
  const handleSectionUpdate = useCallback(
    (updated: InspectorSectionData) => {
      setSections((prev) =>
        prev.map((s) =>
          s.id === updated.id
            ? {
                ...s,
                label: updated.label,
                config: updated.config,
                publishStatus: updated.publishStatus as PageSectionAdminItem["publishStatus"],
                approvalStatus: updated.approvalStatus as PageSectionAdminItem["approvalStatus"],
                scheduledPublishAt: updated.scheduledPublishAt,
              }
            : s,
        ),
      );
      if (selectedId === updated.id) {
        setInspectorConfig({ ...updated.config });
        setInspectorLabel(updated.label);
      }
    },
    [selectedId],
  );

  // ---------------------------------------------------------------------------
  // Section actions
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
        if (selectedId === id) closeInspector();
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

  function handleCreated(section: PageSectionAdminItem) {
    setSections((prev) => [...prev, section]);
    setShowAdd(false);
    selectSection(section);
  }

  function handleToggleCollapse(id: string) {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // ---------------------------------------------------------------------------
  // DnD
  // ---------------------------------------------------------------------------

  function handleDragStart(id: string) { setDragSrcId(id); }
  function handleDragOver(e: React.DragEvent, id: string) { e.preventDefault(); setDragOverId(id); }

  async function handleDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    if (!dragSrcId || dragSrcId === targetId) { setDragSrcId(null); setDragOverId(null); return; }
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
    } catch { /* optimistic update already applied */ }
  }

  function handleDragEnd() { setDragSrcId(null); setDragOverId(null); }

  // ---------------------------------------------------------------------------
  // Derived inspector section
  // ---------------------------------------------------------------------------

  const selectedSection = sections.find((s) => s.id === selectedId);

  const inspectorSection: InspectorSectionData | null = selectedSection
    ? { ...adaptToInspectorData(selectedSection), config: inspectorConfig, label: inspectorLabel }
    : null;

  const workflowCallbacks: InspectorWorkflowCallbacks | undefined = selectedId
    ? buildWorkflowCallbacks(pageId, selectedId, (updated) =>
        setSections((prev) => prev.map((s) => (s.id === updated.id ? updated : s))),
      )
    : undefined;

  const revisionCallbacks: InspectorRevisionCallbacks | undefined = selectedId
    ? buildRevisionCallbacks(pageId, selectedId, (updated) =>
        setSections((prev) => prev.map((s) => (s.id === updated.id ? updated : s))),
      )
    : undefined;

  const hasInspector = !!inspectorSection;

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
            {hasInspector && (
              <div className="flex items-center gap-1 rounded-md border border-[var(--brand-primary,#f97316)] bg-orange-50 px-2.5 py-1 text-[11px] font-medium text-orange-700">
                <PanelRight className="h-3 w-3" />
                Inspector aktiv
              </div>
            )}
            <button type="button" onClick={() => setShowTemplates(true)} className="fca-button-secondary px-2.5" title="Vorlage">
              <Layers className="h-3.5 w-3.5" />
              <span className="ml-1 hidden text-xs sm:inline">Vorlage</span>
            </button>
            <button type="button" onClick={() => setShowPreview(true)} className="fca-button-secondary px-2.5" title="Vorschau">
              <Eye className="h-3.5 w-3.5" />
              <span className="ml-1 hidden text-xs sm:inline">Vorschau</span>
            </button>
            <button type="button" onClick={load} disabled={loading} className="fca-button-secondary px-2.5">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
            {!showAdd && (
              <button type="button" onClick={() => { setShowAdd(true); closeInspector(); }} className="fca-button-primary">
                <Plus className="h-4 w-4" />
                Sektion hinzufügen
              </button>
            )}
          </div>
        </div>

        {isDirty && saveState !== "saving" && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <Save className="h-3.5 w-3.5 flex-shrink-0" />
            Ungespeicherte Änderungen — wird automatisch gespeichert…
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {showAdd && (
          <AddSectionPanel
            pageId={pageId}
            onCreated={handleCreated}
            onCancel={() => setShowAdd(false)}
          />
        )}

        {/* Main layout: section list + optional inspector sidebar */}
        <div className={`flex gap-4 ${hasInspector ? "items-start" : ""}`}>
          {/* Section list */}
          <div className={`min-w-0 flex-1 ${hasInspector ? "max-w-[60%]" : ""}`}>
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
                    const isSelected = selectedId === section.id;
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
                          onClick={() => isSelected ? closeInspector() : selectSection(section)}
                          className={`cursor-pointer px-4 py-3 transition-colors ${
                            isDragging ? "opacity-40" : ""
                          } ${isDragTarget && !isDragging ? "bg-blue-50" : ""} ${
                            isSelected
                              ? "bg-orange-50 ring-1 ring-inset ring-[var(--brand-primary,#f97316)]"
                              : "hover:bg-[var(--surface-2)]"
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="flex min-w-0 flex-1 items-start gap-2">
                              <div className="mt-1 shrink-0 cursor-grab text-[var(--muted)] transition hover:text-[var(--text-2)]" onClick={(e) => e.stopPropagation()}>
                                <GripVertical className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="mb-1 flex flex-wrap items-center gap-2">
                                  <span className="w-5 shrink-0 text-right text-xs font-medium text-[var(--muted)]">{idx + 1}.</span>
                                  <span className="truncate text-sm font-medium text-[var(--foreground)]">{section.label}</span>
                                  {isSelected && (
                                    <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700">Ausgewählt</span>
                                  )}
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

                            <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <button type="button" onClick={() => handleToggleCollapse(section.id)} className="sce-icon-button" title={isCollapsed ? "Aufklappen" : "Einklappen"}>
                                <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isCollapsed ? "" : "rotate-90"}`} />
                              </button>
                              <button type="button" onClick={() => isSelected ? closeInspector() : selectSection(section)} className={`sce-icon-button ${isSelected ? "text-orange-600" : ""}`} title={isSelected ? "Inspector schliessen" : "Inspector öffnen"}>
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button type="button" onClick={() => handleMove(section.id, "up")} disabled={actionPending === section.id || idx === 0} className="sce-icon-button disabled:opacity-30" title="Nach oben">
                                <ChevronUp className="h-3.5 w-3.5" />
                              </button>
                              <button type="button" onClick={() => handleMove(section.id, "down")} disabled={actionPending === section.id || idx === sections.length - 1} className="sce-icon-button disabled:opacity-30" title="Nach unten">
                                <ChevronDown className="h-3.5 w-3.5" />
                              </button>
                              <button type="button" onClick={() => handleToggle(section.id)} disabled={actionPending === section.id} className="sce-icon-button" title={section.isEnabled ? "Deaktivieren" : "Aktivieren"}>
                                {section.isEnabled ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              </button>
                              <button type="button" onClick={() => handleDuplicate(section.id)} disabled={actionPending === section.id} className="sce-icon-button" title="Duplizieren">
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                              <button type="button" onClick={() => handleDelete(section.id)} disabled={actionPending === section.id} className="sce-icon-button text-rose-500 hover:text-rose-700" title="Löschen">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {!isCollapsed && !isSelected && (
                            <div className="ml-7 mt-2 text-[11px] text-[var(--muted)]">
                              {getBlockDefinition(section.type)?.description ?? ""}
                            </div>
                          )}
                        </div>
                      </Fragment>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          </div>

          {/* Inspector sidebar */}
          {hasInspector && inspectorSection && (
            <div className="w-[40%] min-w-[320px] flex-shrink-0">
              <div
                className="sticky top-4 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-sm"
                style={{ maxHeight: "calc(100vh - 8rem)" }}
              >
                <InspectorPanel
                  section={inspectorSection}
                  workflowCallbacks={workflowCallbacks}
                  revisionCallbacks={revisionCallbacks}
                  onConfigChange={handleInspectorConfigChange}
                  onLabelChange={handleInspectorLabelChange}
                  onSectionUpdate={handleSectionUpdate}
                  saveState={saveState}
                  lastSaved={lastSaved}
                  onClose={closeInspector}
                />
              </div>
            </div>
          )}
        </div>

        {/* Info footer */}
        <div className="space-y-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
          <p className="text-xs text-[var(--muted)]">
            <strong className="text-[var(--text-2)]">Inspector:</strong>{" "}
            Klicke auf eine Sektion, um sie im Inspector zu bearbeiten.
          </p>
          <p className="text-xs text-[var(--muted)]">
            <strong className="text-[var(--text-2)]">Drag & Drop:</strong>{" "}
            Sektionen können per Ziehen und Ablegen neu geordnet werden.
          </p>
          <p className="text-xs text-[var(--muted)]">
            <strong className="text-[var(--text-2)]">Publishing:</strong>{" "}
            Sektionen sind öffentlich sichtbar wenn die übergeordnete Seite{" "}
            <strong>veröffentlicht</strong> ist und die Sektion{" "}
            <strong>aktiv</strong> und <strong>veröffentlicht</strong> ist.
          </p>
        </div>
      </div>
    </>
  );
}
