"use client";

/**
 * components/admin/homepage/HomepageBuilderClient.tsx
 *
 * Live Visual Homepage Builder — CMS V3.
 *
 * Wraps HomepageSectionList (inspector) with a live preview canvas.
 * Every edit in the inspector immediately updates the canvas.
 *
 * Layout:
 *   [ Visual Preview Canvas ] | [ Inspector (HomepageSectionList) ]
 *
 * Architecture:
 *   - HomepageSectionList exposes onSectionsChange, onDraftChange,
 *     onEditingChange, and canvasSelectedId callbacks/props.
 *   - This wrapper lifts those into shared state.
 *   - LivePreviewCanvas consumes sections + draftConfigs to render live.
 */

import { useState, useCallback, useMemo } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import HomepageSectionList from "@/components/admin/homepage/HomepageSectionList";
import LivePreviewCanvas, {
  ViewportToolbar,
  type ViewportMode,
  type CanvasSection,
} from "@/components/admin/page-builder/LivePreviewCanvas";
import type { HomepageSectionAdminItem } from "@/lib/homepage/admin-queries";

export default function HomepageBuilderClient() {
  // Sections from HomepageSectionList (synced via onSectionsChange)
  const [sections, setSections] = useState<HomepageSectionAdminItem[]>([]);

  // Live draft configs per section (synced via onDraftChange)
  const [draftConfigs, setDraftConfigs] = useState<Map<string, Record<string, unknown>>>(new Map());

  // Canvas selection state
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Viewport for the canvas
  const [viewport, setViewport] = useState<ViewportMode>("desktop");

  // Inspector panel visibility
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);

  // ---------------------------------------------------------------------------
  // Callbacks from HomepageSectionList
  // ---------------------------------------------------------------------------

  const handleSectionsChange = useCallback((updated: HomepageSectionAdminItem[]) => {
    setSections(updated);
  }, []);

  const handleDraftChange = useCallback((sectionId: string, config: Record<string, unknown>) => {
    setDraftConfigs((prev) => {
      const next = new Map(prev);
      next.set(sectionId, config);
      return next;
    });
  }, []);

  const handleEditingChange = useCallback((editingId: string | null) => {
    if (editingId) setSelectedId(editingId);
  }, []);

  const handleSaved = useCallback(() => {
    // Clear draft for the saved section (saved state is now canonical)
    setDraftConfigs((prev) => {
      const next = new Map(prev);
      // We don't know which section was saved here, but onDraftChange will
      // re-sync when editing restarts. Clearing all is safe but we want to
      // avoid flicker. Leave draftConfigs as-is; the canvas will naturally
      // fall back to section.config after the sections list refreshes.
      return next;
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Canvas selection handler (clicking a section on the canvas)
  // ---------------------------------------------------------------------------

  const handleCanvasSelectSection = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  // ---------------------------------------------------------------------------
  // Canvas sections (convert HomepageSectionAdminItem → CanvasSection)
  // ---------------------------------------------------------------------------

  const canvasSections = useMemo(
    (): CanvasSection[] =>
      sections.map((s) => ({
        id: s.id,
        type: s.type,
        label: s.label,
        isEnabled: s.isEnabled,
        publishStatus: s.publishStatus,
        config: s.config as Record<string, unknown>,
      })),
    [sections],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-0 rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--background)]">

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setInspectorCollapsed((v) => !v)}
            className="sce-icon-button"
            title={inspectorCollapsed ? "Inspector öffnen" : "Inspector schliessen"}
          >
            {inspectorCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
          <p className="text-xs font-semibold text-[var(--foreground)]">Homepage Builder</p>
          <span className="text-[11px] text-[var(--muted)]">
            {sections.length} Sektion{sections.length !== 1 ? "en" : ""}
          </span>
        </div>
        <ViewportToolbar viewport={viewport} onChange={setViewport} />
        <div className="w-24" />
      </div>

      {/* Split-pane */}
      <div className="flex overflow-hidden" style={{ height: "calc(100vh - 18rem)" }}>

        {/* Live Preview Canvas */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[var(--surface-2)]">
          <LivePreviewCanvas
            sections={canvasSections}
            draftConfigs={draftConfigs}
            selectedId={selectedId}
            onSelectSection={handleCanvasSelectSection}
            viewport={viewport}
          />
        </div>

        {/* Inspector: HomepageSectionList */}
        {!inspectorCollapsed && (
          <div className="w-[480px] shrink-0 border-l border-[var(--border)] overflow-y-auto">
            <HomepageSectionList
              onSectionsChange={handleSectionsChange}
              onDraftChange={handleDraftChange}
              onEditingChange={handleEditingChange}
              onSaved={handleSaved}
              canvasSelectedId={selectedId}
            />
          </div>
        )}
      </div>
    </div>
  );
}
