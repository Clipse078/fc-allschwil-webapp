"use client";

/**
 * components/admin/page-builder/LivePreviewCanvas.tsx
 *
 * Visual canvas for the Page Builder and Homepage Builder.
 *
 * Renders all sections using the exact same components as the public website
 * (via BLOCK_RENDERERS). Inspector draft config flows in via `draftConfigs`
 * so every property change is immediately visible — no save required.
 *
 * Features:
 *   - Per-section live rendering using production renderers
 *   - Section selection via click (highlights + notifies parent)
 *   - Hover affordances (hover ring, edit overlay)
 *   - Viewport simulation: Desktop / Laptop / Tablet / Mobile
 *   - Empty state
 *   - Scrolls selected section into view when `selectedId` changes
 *
 * Props:
 *   sections       — all sections (saved server state shapes)
 *   draftConfigs   — map of sectionId → live draft config (updated every keystroke)
 *   selectedId     — currently selected section id (drives highlight)
 *   onSelectSection — callback when a section is clicked on the canvas
 *   viewport        — viewport width preset
 *   onViewportChange — callback to change viewport
 */

import {
  useRef,
  useEffect,
  Suspense,
  memo,
  useState,
} from "react";
import {
  Monitor,
  Laptop,
  Tablet,
  Smartphone,
  Blocks,
  MousePointerClick,
} from "lucide-react";
import dynamic from "next/dynamic";
import { getBlockRenderer } from "@/components/website/blocks/index";
import { getBlockDefinition } from "@/lib/homepage/block-registry";

// ---------------------------------------------------------------------------
// Viewport config
// ---------------------------------------------------------------------------

export type ViewportMode = "desktop" | "laptop" | "tablet" | "mobile";

export const VIEWPORT_CONFIG: Record<
  ViewportMode,
  { label: string; icon: React.ElementType; width: number | null; description: string }
> = {
  desktop: {
    label: "Desktop",
    icon: Monitor,
    width: null,
    description: "Vollbreite",
  },
  laptop: {
    label: "Laptop",
    icon: Laptop,
    width: 1280,
    description: "1280px",
  },
  tablet: {
    label: "Tablet",
    icon: Tablet,
    width: 768,
    description: "768px",
  },
  mobile: {
    label: "Mobile",
    icon: Smartphone,
    width: 375,
    description: "375px",
  },
};

// ---------------------------------------------------------------------------
// Section shape (minimal, compatible with both page + homepage builders)
// ---------------------------------------------------------------------------

export type CanvasSection = {
  id: string;
  type: string;
  label: string;
  isEnabled: boolean;
  publishStatus?: string;
  config: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Viewport toolbar
// ---------------------------------------------------------------------------

type ViewportToolbarProps = {
  viewport: ViewportMode;
  onChange: (v: ViewportMode) => void;
};

export function ViewportToolbar({ viewport, onChange }: ViewportToolbarProps) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5">
      {(Object.keys(VIEWPORT_CONFIG) as ViewportMode[]).map((v) => {
        const vc = VIEWPORT_CONFIG[v];
        const Icon = vc.icon;
        const isActive = viewport === v;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            title={`${vc.label} (${vc.description})`}
            className={`flex items-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition ${
              isActive
                ? "bg-white text-[var(--foreground)] shadow-sm ring-1 ring-[var(--border)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{vc.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single section preview tile
// ---------------------------------------------------------------------------

type SectionTileProps = {
  section: CanvasSection;
  draftConfig: Record<string, unknown> | undefined;
  isSelected: boolean;
  onSelect: () => void;
};

const SectionTile = memo(function SectionTile({
  section,
  draftConfig,
  isSelected,
  onSelect,
}: SectionTileProps) {
  const [isHovered, setIsHovered] = useState(false);
  const tileRef = useRef<HTMLDivElement>(null);
  const Renderer = getBlockRenderer(section.type);
  const def = getBlockDefinition(section.type);
  const config = draftConfig ?? section.config;

  return (
    <div
      ref={tileRef}
      data-section-id={section.id}
      className={`relative cursor-pointer transition-all duration-150 ${
        isSelected
          ? "ring-2 ring-blue-500 ring-inset"
          : isHovered
          ? "ring-2 ring-blue-300 ring-inset"
          : ""
      }`}
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      tabIndex={0}
      role="button"
      aria-pressed={isSelected}
      aria-label={`Sektion: ${section.label}`}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } }}
    >
      {/* Hover / selected overlay with label */}
      {(isHovered || isSelected) && (
        <div
          className={`absolute inset-x-0 top-0 z-20 flex items-center justify-between px-3 py-1.5 text-white text-[11px] font-semibold pointer-events-none ${
            isSelected ? "bg-blue-500/90" : "bg-blue-400/80"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <MousePointerClick className="h-3 w-3" />
            {section.label}
          </span>
          <span className="opacity-70">
            {def?.displayName ?? section.type}
          </span>
        </div>
      )}

      {/* Disabled / draft dimmer */}
      {!section.isEnabled && (
        <div className="absolute inset-0 z-10 bg-white/60 pointer-events-none flex items-center justify-center">
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
            Deaktiviert
          </span>
        </div>
      )}

      {/* Block renderer */}
      <Suspense
        fallback={
          <div className="h-32 w-full animate-pulse bg-gray-100 flex items-center justify-center">
            <span className="text-xs text-gray-400">Lädt…</span>
          </div>
        }
      >
        {Renderer ? (
          <Renderer config={config} previewMode={false} />
        ) : (
          <UnknownBlockFallback type={section.type} />
        )}
      </Suspense>
    </div>
  );
});

function UnknownBlockFallback({ type }: { type: string }) {
  return (
    <div className="flex items-center justify-center py-10 bg-gray-50">
      <div className="text-center space-y-1">
        <Blocks className="h-6 w-6 text-gray-300 mx-auto" />
        <p className="text-xs text-gray-400">Kein Renderer für: {type}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main canvas
// ---------------------------------------------------------------------------

type LivePreviewCanvasProps = {
  sections: CanvasSection[];
  draftConfigs: Map<string, Record<string, unknown>>;
  selectedId: string | null;
  onSelectSection: (id: string) => void;
  viewport: ViewportMode;
};

export default function LivePreviewCanvas({
  sections,
  draftConfigs,
  selectedId,
  onSelectSection,
  viewport,
}: LivePreviewCanvasProps) {
  const selectedRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll selected section into view when it changes
  useEffect(() => {
    if (!selectedId || !containerRef.current) return;
    const el = containerRef.current.querySelector(
      `[data-section-id="${selectedId}"]`,
    );
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedId]);

  const vc = VIEWPORT_CONFIG[viewport];
  const maxWidth = vc.width ? `${vc.width}px` : "100%";

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto bg-[var(--surface-2)] p-4 flex flex-col items-center"
    >
      {sections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-[var(--muted)] w-full">
          <Blocks className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm font-medium">Noch keine Sektionen</p>
          <p className="text-xs mt-1 opacity-70">
            Füge Sektionen über den Inspector links hinzu.
          </p>
        </div>
      ) : (
        <div
          className="w-full overflow-hidden rounded-lg border border-[var(--border)] bg-white shadow-sm transition-all duration-300"
          style={{ maxWidth }}
          ref={selectedRef}
        >
          {sections.map((section) => (
            <SectionTile
              key={section.id}
              section={section}
              draftConfig={draftConfigs.get(section.id)}
              isSelected={selectedId === section.id}
              onSelect={() => onSelectSection(section.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
