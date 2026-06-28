"use client";

/**
 * components/admin/visual-builder/VisualCanvasPanel.tsx
 *
 * CMS V3 — Visual Canvas Panel.
 *
 * Renders all page sections as a visual canvas where editors can:
 *   1. Click any section to select it and enter direct editing mode.
 *   2. Edit premium block content (splitContentCards) directly on the canvas
 *      via CanvasEditController (inline text, cards, images).
 *   3. Use the property panel alongside for advanced settings.
 *   4. All edits persist via the existing autosave flow (debounced 1.5s).
 *
 * Viewport switcher mirrors the PreviewPanel (Desktop / Tablet / Mobile).
 *
 * Architecture:
 *   VisualCanvasPanel holds local config state for the selected section.
 *   On each inline edit, it calls onSaveConfig (→ handleSaveConfig in
 *   PageBuilderClient) after a 1.5s debounce. No separate API is introduced.
 */

import {
  useState,
  useRef,
  useCallback,
  Suspense,
  useEffect,
} from "react";
import {
  Monitor,
  Tablet,
  Smartphone,
  Pencil,
  X,
  Blocks,
} from "lucide-react";
import dynamic from "next/dynamic";
import type { PageSectionAdminItem } from "@/lib/page-sections/admin-queries";

// ---------------------------------------------------------------------------
// Lazy-loaded block components (avoid SSR issues)
// ---------------------------------------------------------------------------

const SplitContentCardsRenderer = dynamic(
  () => import("@/components/website/blocks/SplitContentCardsRenderer"),
  {
    ssr: false,
    loading: () => <div className="h-32 animate-pulse bg-gray-100" />,
  },
);

const CanvasEditController = dynamic(
  () => import("@/components/admin/visual-builder/CanvasEditController"),
  {
    ssr: false,
    loading: () => <div className="h-32 animate-pulse bg-blue-50" />,
  },
);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PREMIUM_INLINE_EDITABLE = new Set(["splitContentCards"]);
const AUTOSAVE_DELAY_MS = 1500;

type ViewportMode = "desktop" | "tablet" | "mobile";

const VIEWPORT_CONFIG: Record<
  ViewportMode,
  { label: string; icon: React.ElementType; maxWidth: string }
> = {
  desktop: { label: "Desktop", icon: Monitor, maxWidth: "100%" },
  tablet: { label: "Tablet", icon: Tablet, maxWidth: "768px" },
  mobile: { label: "Mobile", icon: Smartphone, maxWidth: "375px" },
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type VisualCanvasPanelProps = {
  sections: PageSectionAdminItem[];
  /** Called after inline edit — persists to DB. */
  onSaveConfig: (
    id: string,
    label: string,
    config: Record<string, unknown>,
  ) => Promise<void>;
  /** Notifies parent that a change is pending (for save indicator). */
  onDirty: () => void;
};

// ---------------------------------------------------------------------------
// VisualCanvasPanel
// ---------------------------------------------------------------------------

export default function VisualCanvasPanel({
  sections,
  onSaveConfig,
  onDirty,
}: VisualCanvasPanelProps) {
  const [viewport, setViewport] = useState<ViewportMode>("desktop");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Local config state for the currently selected section
  const [localConfig, setLocalConfig] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [localLabel, setLocalLabel] = useState<string>("");

  // Debounce autosave
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local config when selection changes
  useEffect(() => {
    if (selectedId) {
      const section = sections.find((s) => s.id === selectedId);
      if (section) {
        setLocalConfig({ ...section.config });
        setLocalLabel(section.label);
      }
    } else {
      setLocalConfig(null);
      setLocalLabel("");
    }
    // Cancel pending autosave when switching sections
    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Flush autosave when sections list changes (external refresh)
  useEffect(() => {
    if (selectedId) {
      const section = sections.find((s) => s.id === selectedId);
      if (!section) {
        setSelectedId(null);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections]);

  const triggerAutosave = useCallback(
    (id: string, label: string, config: Record<string, unknown>) => {
      onDirty();
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      autosaveTimer.current = setTimeout(() => {
        void onSaveConfig(id, label, config).catch(() => {});
      }, AUTOSAVE_DELAY_MS);
    },
    [onSaveConfig, onDirty],
  );

  function handleConfigChange(
    id: string,
    label: string,
    updatedConfig: Record<string, unknown>,
  ) {
    setLocalConfig(updatedConfig);
    triggerAutosave(id, label, updatedConfig);
  }

  const vc = VIEWPORT_CONFIG[viewport];

  return (
    <div className="flex flex-col rounded-lg border border-[var(--border)] bg-[var(--surface-2)]">
      {/* Canvas toolbar */}
      <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Visual Canvas
          </span>
          {selectedId && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
              Bearbeitungsmodus
            </span>
          )}
        </div>

        {/* Viewport switcher */}
        <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-0.5">
          {(["desktop", "tablet", "mobile"] as ViewportMode[]).map((v) => {
            const vConf = VIEWPORT_CONFIG[v];
            const Icon = vConf.icon;
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
                title={vConf.label}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{vConf.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Canvas hint */}
      <div className="border-b border-[var(--border)] bg-blue-50 px-4 py-2 text-[11px] text-blue-700">
        Sektion anklicken zum Aktivieren der Direktbearbeitung. Texte, Karten und Bilder direkt im Canvas bearbeiten.
      </div>

      {/* Canvas area */}
      <div className="overflow-auto p-4">
        <div
          className="mx-auto rounded-lg border border-[var(--border)] bg-white overflow-hidden transition-all duration-300"
          style={{ maxWidth: vc.maxWidth }}
        >
          {sections.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-[var(--muted)]">
              <Blocks className="mb-2 h-8 w-8 opacity-40" />
              <p className="text-sm">Keine Sektionen vorhanden</p>
            </div>
          ) : (
            sections.map((section) => {
              const isSelected = selectedId === section.id;
              const configToRender =
                isSelected && localConfig !== null
                  ? localConfig
                  : section.config;

              return (
                <div
                  key={section.id}
                  className={`relative border-b border-[var(--border)] last:border-0 transition-all ${
                    isSelected
                      ? "ring-2 ring-inset ring-blue-400"
                      : "hover:ring-1 hover:ring-inset hover:ring-blue-200 cursor-pointer"
                  } ${!section.isEnabled || section.publishStatus !== "PUBLISHED" ? "opacity-60" : ""}`}
                  onClick={
                    !isSelected
                      ? () => setSelectedId(section.id)
                      : undefined
                  }
                  role={!isSelected ? "button" : undefined}
                  tabIndex={!isSelected ? 0 : undefined}
                  onKeyDown={
                    !isSelected
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedId(section.id);
                          }
                        }
                      : undefined
                  }
                  aria-label={
                    !isSelected
                      ? `Sektion ${section.label} bearbeiten`
                      : undefined
                  }
                >
                  {/* Section header strip */}
                  <div className="flex items-center justify-between bg-[var(--surface-2)] px-4 py-1.5">
                    <span className="text-[11px] font-semibold text-[var(--foreground)]">
                      {section.label}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {!isSelected ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedId(section.id);
                          }}
                          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-[var(--muted)] transition hover:bg-blue-100 hover:text-blue-700"
                          aria-label={`${section.label} im Canvas bearbeiten`}
                        >
                          <Pencil className="h-3 w-3" />
                          Bearbeiten
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedId(null);
                          }}
                          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-blue-700 transition hover:bg-blue-200"
                          aria-label="Bearbeitung beenden"
                        >
                          <X className="h-3 w-3" />
                          Fertig
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Block render */}
                  <Suspense
                    fallback={
                      <div className="h-32 animate-pulse bg-gray-50" />
                    }
                  >
                    {isSelected &&
                    PREMIUM_INLINE_EDITABLE.has(section.type) ? (
                      // Canvas editor with inline editing
                      <CanvasEditController
                        config={configToRender}
                        onConfigChange={(updated) =>
                          handleConfigChange(
                            section.id,
                            localLabel || section.label,
                            updated,
                          )
                        }
                      />
                    ) : section.type === "splitContentCards" ? (
                      // Read-only visual preview
                      <SplitContentCardsRenderer
                        config={configToRender}
                        previewMode={isSelected}
                      />
                    ) : (
                      // Generic fallback for non-premium blocks
                      <div className="px-4 py-6 text-center text-[11px] text-[var(--muted)]">
                        {section.label} — {section.type}
                      </div>
                    )}
                  </Suspense>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
