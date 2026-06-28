"use client";

/**
 * components/admin/visual-builder/VisualCanvas.tsx
 *
 * CMS V3 Visual Canvas — core visual editing shell.
 *
 * Renders existing CMS sections as a page-like canvas where editors can:
 *   - See sections visually using existing renderers (SplitContentCardsRenderer)
 *     or lightweight canvas previews (for blocks without a full renderer yet)
 *   - Click a section to select it
 *   - Use the selection toolbar: Bearbeiten / Duplizieren / Nach oben / Nach unten / Löschen
 *   - Click insertion points between sections to add new blocks
 *   - Switch viewport mode: Desktop / Laptop / Tablet / Mobile
 *
 * Architecture:
 *   - Reuses SectionShell for the layout layer (same as public website)
 *   - Reuses SplitContentCardsRenderer for the one existing full renderer
 *   - Uses canvas-specific lightweight previews for blocks without a renderer
 *   - Does NOT duplicate renderer logic; canvas previews are clearly approximate
 *   - No separate state model — forwards all changes to parent action handlers
 *
 * Data flow:
 *   Canvas selection → parent action handler → existing API → existing workflow
 */

import { useState, Suspense } from "react";
import dynamic from "next/dynamic";
import {
  Blocks,
  Newspaper,
  Calendar,
  Users,
  CalendarDays,
  MousePointerClick,
  Award,
  LayoutTemplate,
  Eye,
  EyeOff,
  Globe,
  GlobeLock,
  RefreshCw,
} from "lucide-react";
import type { SectionLayout } from "@/lib/cms/layout-types";
import SectionShell from "@/components/website/SectionShell";
import { getBlockDefinition } from "@/lib/homepage/block-registry";
import ViewportSwitcher, { type ViewportMode, VIEWPORT_CONFIGS } from "./ViewportSwitcher";
import CanvasInsertionPoint from "./CanvasInsertionPoint";
import CanvasToolbar from "./CanvasToolbar";
import InlineEditableText from "./InlineEditableText";

// ---------------------------------------------------------------------------
// Lazy-load existing renderers to avoid SSR issues
// ---------------------------------------------------------------------------

const SplitContentCardsRenderer = dynamic(
  () => import("@/components/website/blocks/SplitContentCardsRenderer"),
  {
    ssr: false,
    loading: () => <div className="h-40 animate-pulse bg-gray-100" />,
  },
);

// ---------------------------------------------------------------------------
// Normalised section type (works for both HomepageSection + WebsitePageSection)
// ---------------------------------------------------------------------------

export type CanvasSection = {
  id: string;
  type: string;
  label: string;
  sortOrder: number;
  isEnabled: boolean;
  publishStatus: string;
  approvalStatus: string;
  config: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Canvas action handlers
// ---------------------------------------------------------------------------

export type CanvasActions = {
  onEdit: (sectionId: string) => void;
  onMoveUp: (sectionId: string) => void;
  onMoveDown: (sectionId: string) => void;
  onDuplicate?: (sectionId: string) => void;
  onDelete: (sectionId: string) => void;
  /** afterIndex=-1 → insert before first section */
  onInsertAt: (afterIndex: number) => void;
  /** Inline text field update — patches config and triggers autosave */
  onInlineUpdate?: (sectionId: string, patch: Record<string, unknown>) => void;
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type VisualCanvasProps = {
  sections: CanvasSection[];
  actionPending: string | null;
  canvasActions: CanvasActions;
};

// ---------------------------------------------------------------------------
// VisualCanvas
// ---------------------------------------------------------------------------

export default function VisualCanvas({
  sections,
  actionPending,
  canvasActions,
}: VisualCanvasProps) {
  const [viewport, setViewport] = useState<ViewportMode>("desktop");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const vcfg = VIEWPORT_CONFIGS[viewport];

  function handleSelect(id: string) {
    setSelectedId((prev) => (prev === id ? null : id));
  }

  function handleCanvasClick(e: React.MouseEvent) {
    // Deselect when clicking canvas background
    if ((e.target as HTMLElement).closest("[data-canvas-section]") === null) {
      setSelectedId(null);
    }
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Canvas top bar */}
      <div className="flex items-center justify-between rounded-t-xl border border-b-0 border-[var(--border)] bg-[var(--surface)] px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
          <Eye className="h-3.5 w-3.5" />
          <span className="font-medium text-[var(--text-2)]">Visueller Editor</span>
          <span>·</span>
          <span>{sections.length} Abschnitt{sections.length !== 1 ? "e" : ""}</span>
        </div>
        <ViewportSwitcher mode={viewport} onChange={setViewport} />
      </div>

      {/* Canvas area */}
      <div
        className="rounded-b-xl border border-[var(--border)] bg-[var(--surface-2)] p-4"
        onClick={handleCanvasClick}
      >
        {/* Constrained canvas */}
        <div
          className="mx-auto transition-all duration-300"
          style={{ maxWidth: vcfg.maxWidth }}
        >
          {sections.length === 0 ? (
            <EmptyCanvasState onInsert={() => canvasActions.onInsertAt(0)} />
          ) : (
            <div className="space-y-0">
              {/* Top insertion point */}
              <CanvasInsertionPoint
                insertIndex={0}
                onInsert={canvasActions.onInsertAt}
                variant="boundary"
              />

              {sections.map((section, idx) => {
                const isSelected = selectedId === section.id;
                const isPending = actionPending === section.id;

                return (
                  <div key={section.id}>
                    {/* Section frame */}
                    <CanvasSectionFrame
                      section={section}
                      index={idx}
                      isSelected={isSelected}
                      isPending={isPending}
                      canMoveUp={idx > 0}
                      canMoveDown={idx < sections.length - 1}
                      onSelect={() => handleSelect(section.id)}
                      onEdit={() => canvasActions.onEdit(section.id)}
                      onMoveUp={() => canvasActions.onMoveUp(section.id)}
                      onMoveDown={() => canvasActions.onMoveDown(section.id)}
                      onDuplicate={
                        canvasActions.onDuplicate
                          ? () => canvasActions.onDuplicate!(section.id)
                          : undefined
                      }
                      onDelete={() => canvasActions.onDelete(section.id)}
                      onInlineUpdate={
                        canvasActions.onInlineUpdate
                          ? (patch) => canvasActions.onInlineUpdate!(section.id, patch)
                          : undefined
                      }
                    />

                    {/* Insertion point after each section */}
                    <CanvasInsertionPoint
                      insertIndex={idx + 1}
                      onInsert={canvasActions.onInsertAt}
                      variant={idx === sections.length - 1 ? "boundary" : "between"}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CanvasSectionFrame
// ---------------------------------------------------------------------------

type CanvasSectionFrameProps = {
  section: CanvasSection;
  index: number;
  isSelected: boolean;
  isPending: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate?: () => void;
  onDelete: () => void;
  onInlineUpdate?: (patch: Record<string, unknown>) => void;
};

function CanvasSectionFrame({
  section,
  index,
  isSelected,
  isPending,
  canMoveUp,
  canMoveDown,
  onSelect,
  onEdit,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
  onInlineUpdate,
}: CanvasSectionFrameProps) {
  const def = getBlockDefinition(section.type);

  return (
    <div
      data-canvas-section={section.id}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      className={`group/frame relative overflow-visible rounded-sm transition-all duration-150 ${
        isSelected
          ? "ring-2 ring-blue-500 ring-offset-1"
          : "ring-1 ring-transparent hover:ring-[var(--border)]"
      } ${isPending ? "opacity-60" : ""}`}
    >
      {/* Section meta strip */}
      <div
        className={`flex items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-1.5 text-[11px] transition-colors ${
          isSelected
            ? "bg-blue-50"
            : "bg-[var(--surface)] group-hover/frame:bg-[var(--surface-2)]"
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-5 shrink-0 text-right font-mono text-[var(--muted)]">
            {index + 1}.
          </span>
          <span className="truncate font-medium text-[var(--foreground)]">{section.label}</span>
          <span className="shrink-0 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] text-[var(--text-2)]">
            {def?.displayName ?? section.type}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Enabled indicator */}
          {section.isEnabled ? (
            <Eye className="h-3 w-3 text-emerald-500" />
          ) : (
            <EyeOff className="h-3 w-3 text-[var(--muted)]" />
          )}
          {/* Publish indicator */}
          {section.publishStatus === "PUBLISHED" ? (
            <Globe className="h-3 w-3 text-blue-500" />
          ) : (
            <GlobeLock className="h-3 w-3 text-[var(--muted)]" />
          )}
          {/* Spinner for pending action */}
          {isPending && <RefreshCw className="h-3 w-3 animate-spin text-[var(--muted)]" />}
        </div>
      </div>

      {/* Floating toolbar — shown when selected */}
      {isSelected && (
        <div className="absolute right-2 top-0 z-20 -translate-y-full pt-1">
          <CanvasToolbar
            sectionId={section.id}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
            actionPending={isPending}
            onEdit={onEdit}
            onDuplicate={onDuplicate}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            onDelete={onDelete}
          />
        </div>
      )}

      {/* Block visual content */}
      <div className={`pointer-events-none ${isSelected ? "pointer-events-none" : ""}`}>
        <CanvasBlockPreview
          type={section.type}
          config={section.config}
          onInlineUpdate={onInlineUpdate}
          isInteractive={isSelected}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CanvasBlockPreview — dispatches to correct renderer or placeholder
// ---------------------------------------------------------------------------

type CanvasBlockPreviewProps = {
  type: string;
  config: Record<string, unknown>;
  onInlineUpdate?: (patch: Record<string, unknown>) => void;
  isInteractive?: boolean;
};

function CanvasBlockPreview({ type, config, onInlineUpdate, isInteractive }: CanvasBlockPreviewProps) {
  const layout = (config._layout as SectionLayout | undefined) ?? {};

  // ── Premium block: use the real renderer (includes SectionShell internally) ──
  if (type === "splitContentCards") {
    return (
      <Suspense fallback={<div className="h-40 animate-pulse bg-gray-100" />}>
        <SplitContentCardsRenderer config={config} previewMode={false} />
      </Suspense>
    );
  }

  // ── All other blocks: SectionShell wraps a canvas-specific placeholder ──
  // SectionShell provides the same layout layer as production (spacing, theme, width, bg).
  // Inner content is a canvas placeholder since no production renderer exists yet.
  return (
    <SectionShell layout={layout} blockType={type}>
      <CanvasBlockPlaceholder
        type={type}
        config={config}
        onInlineUpdate={onInlineUpdate}
        isInteractive={isInteractive}
      />
    </SectionShell>
  );
}

// ---------------------------------------------------------------------------
// CanvasBlockPlaceholder — per-type lightweight canvas previews
// ---------------------------------------------------------------------------

type CanvasBlockPlaceholderProps = {
  type: string;
  config: Record<string, unknown>;
  onInlineUpdate?: (patch: Record<string, unknown>) => void;
  isInteractive?: boolean;
};

function CanvasBlockPlaceholder({ type, config, onInlineUpdate, isInteractive }: CanvasBlockPlaceholderProps) {
  const def = getBlockDefinition(type);

  function handleInlineCommit(key: string, value: string) {
    if (onInlineUpdate && isInteractive) {
      onInlineUpdate({ [key]: value });
    }
  }

  switch (type) {
    case "hero":
      return <HeroPlaceholder config={config} onCommit={isInteractive ? handleInlineCommit : undefined} />;
    case "callToAction":
      return <CtaPlaceholder config={config} onCommit={isInteractive ? handleInlineCommit : undefined} />;
    case "newsTeaser":
      return <NewsTeaserPlaceholder config={config} />;
    case "eventsTeaser":
      return <EventsTeaserPlaceholder config={config} />;
    case "teamsTeaser":
      return <TeamsTeaserPlaceholder config={config} />;
    case "weekplanTeaser":
      return <WeekplanTeaserPlaceholder />;
    case "sponsorsTeaser":
      return <SponsorsTeaserPlaceholder />;
    default:
      return <GenericBlockPlaceholder def={def} type={type} />;
  }
}

// ---------------------------------------------------------------------------
// Hero placeholder
// ---------------------------------------------------------------------------

function HeroPlaceholder({
  config,
  onCommit,
}: {
  config: Record<string, unknown>;
  onCommit?: (key: string, value: string) => void;
}) {
  const title = typeof config.title === "string" ? config.title : "";
  const subtitle = typeof config.subtitle === "string" ? config.subtitle : "";
  const ctaLabel = typeof config.ctaLabel === "string" ? config.ctaLabel : "";

  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-2)]">
        <LayoutTemplate className="h-6 w-6 text-[var(--text-2)]" />
      </div>

      {onCommit ? (
        <InlineEditableText
          value={title}
          onCommit={(v) => onCommit("title", v)}
          as="h2"
          className="text-3xl font-bold text-[var(--foreground)]"
          placeholder="Haupttitel eingeben…"
        />
      ) : (
        <h2 className="text-3xl font-bold text-[var(--foreground)]">
          {title || <span className="opacity-40 italic text-xl">Haupttitel</span>}
        </h2>
      )}

      {onCommit ? (
        <InlineEditableText
          value={subtitle}
          onCommit={(v) => onCommit("subtitle", v)}
          as="p"
          className="max-w-xl text-[var(--text-2)]"
          placeholder="Untertitel eingeben…"
        />
      ) : (
        <p className="max-w-xl text-[var(--text-2)]">
          {subtitle || <span className="opacity-40 italic">Untertitel</span>}
        </p>
      )}

      {(ctaLabel || onCommit) && (
        <div className="flex items-center gap-3 mt-2">
          <span className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
            {ctaLabel || "Call-to-Action"}
          </span>
        </div>
      )}

      <CanvasPreviewNote />
    </div>
  );
}

// ---------------------------------------------------------------------------
// CTA placeholder
// ---------------------------------------------------------------------------

function CtaPlaceholder({
  config,
  onCommit,
}: {
  config: Record<string, unknown>;
  onCommit?: (key: string, value: string) => void;
}) {
  const title = typeof config.title === "string" ? config.title : "";
  const body = typeof config.body === "string" ? config.body : "";
  const primaryLabel = typeof config.primaryLabel === "string" ? config.primaryLabel : "";
  const secondaryLabel = typeof config.secondaryLabel === "string" ? config.secondaryLabel : "";

  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <MousePointerClick className="h-8 w-8 text-[var(--text-2)] opacity-60" />

      {onCommit ? (
        <InlineEditableText
          value={title}
          onCommit={(v) => onCommit("title", v)}
          as="h3"
          className="text-2xl font-bold text-[var(--foreground)]"
          placeholder="CTA-Titel eingeben…"
        />
      ) : (
        <h3 className="text-2xl font-bold text-[var(--foreground)]">
          {title || <span className="opacity-40 italic">CTA-Titel</span>}
        </h3>
      )}

      <p className="max-w-lg text-sm text-[var(--text-2)]">
        {body || <span className="opacity-40 italic">Beschreibungstext</span>}
      </p>

      <div className="flex items-center gap-3 mt-1">
        {(primaryLabel || !body) && (
          <span className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
            {primaryLabel || "Primär-Button"}
          </span>
        )}
        {secondaryLabel && (
          <span className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]">
            {secondaryLabel}
          </span>
        )}
      </div>

      <CanvasPreviewNote />
    </div>
  );
}

// ---------------------------------------------------------------------------
// News Teaser placeholder
// ---------------------------------------------------------------------------

function NewsTeaserPlaceholder({ config }: { config: Record<string, unknown> }) {
  const heading = typeof config.heading === "string" ? config.heading : "Aktuelles";
  const itemCount = typeof config.itemCount === "number" ? Math.min(config.itemCount, 4) : 3;

  return (
    <div className="py-6">
      <div className="mb-4 flex items-center gap-2">
        <Newspaper className="h-4 w-4 text-[var(--text-2)]" />
        <span className="font-semibold text-[var(--foreground)]">{heading}</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: itemCount }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <div className="mb-2 h-2 w-16 rounded bg-[var(--surface-2)]" />
            <div className="mb-1 h-3 w-full rounded bg-[var(--surface-2)]" />
            <div className="h-3 w-3/4 rounded bg-[var(--surface-2)]" />
          </div>
        ))}
      </div>
      <CanvasPreviewNote />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Events Teaser placeholder
// ---------------------------------------------------------------------------

function EventsTeaserPlaceholder({ config }: { config: Record<string, unknown> }) {
  const heading = typeof config.heading === "string" ? config.heading : "Veranstaltungen";
  const itemCount = typeof config.itemCount === "number" ? Math.min(config.itemCount, 4) : 3;

  return (
    <div className="py-6">
      <div className="mb-4 flex items-center gap-2">
        <Calendar className="h-4 w-4 text-[var(--text-2)]" />
        <span className="font-semibold text-[var(--foreground)]">{heading}</span>
      </div>
      <div className="space-y-2">
        {Array.from({ length: itemCount }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3"
          >
            <div className="h-10 w-10 shrink-0 rounded-md bg-[var(--surface-2)]" />
            <div className="flex-1">
              <div className="mb-1 h-3 w-2/3 rounded bg-[var(--surface-2)]" />
              <div className="h-2 w-1/3 rounded bg-[var(--surface-2)]" />
            </div>
          </div>
        ))}
      </div>
      <CanvasPreviewNote />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Teams Teaser placeholder
// ---------------------------------------------------------------------------

function TeamsTeaserPlaceholder({ config }: { config: Record<string, unknown> }) {
  const heading = typeof config.heading === "string" ? config.heading : "Unsere Teams";
  const itemCount = typeof config.itemCount === "number" ? Math.min(config.itemCount, 6) : 6;

  return (
    <div className="py-6">
      <div className="mb-4 flex items-center gap-2">
        <Users className="h-4 w-4 text-[var(--text-2)]" />
        <span className="font-semibold text-[var(--foreground)]">{heading}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: itemCount }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-center"
          >
            <div className="mx-auto mb-2 h-10 w-10 rounded-full bg-[var(--surface-2)]" />
            <div className="mx-auto h-2 w-20 rounded bg-[var(--surface-2)]" />
          </div>
        ))}
      </div>
      <CanvasPreviewNote />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Weekplan Teaser placeholder
// ---------------------------------------------------------------------------

function WeekplanTeaserPlaceholder() {
  return (
    <div className="py-6">
      <div className="mb-4 flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-[var(--text-2)]" />
        <span className="font-semibold text-[var(--foreground)]">Wochenplan</span>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((day) => (
          <div key={day} className="rounded border border-[var(--border)] bg-[var(--surface)] p-2 text-center">
            <div className="mb-1 text-[10px] font-medium text-[var(--muted)]">{day}</div>
            <div className="mx-auto h-2 w-full rounded bg-[var(--surface-2)]" />
          </div>
        ))}
      </div>
      <CanvasPreviewNote />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sponsors Teaser placeholder
// ---------------------------------------------------------------------------

function SponsorsTeaserPlaceholder() {
  return (
    <div className="py-6">
      <div className="mb-4 flex items-center gap-2">
        <Award className="h-4 w-4 text-[var(--text-2)]" />
        <span className="font-semibold text-[var(--foreground)]">Sponsoren</span>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex h-14 w-28 items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] text-[10px] text-[var(--muted)]"
          >
            Sponsor {i + 1}
          </div>
        ))}
      </div>
      <CanvasPreviewNote />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generic block placeholder (fallback)
// ---------------------------------------------------------------------------

function GenericBlockPlaceholder({
  def,
  type,
}: {
  def: ReturnType<typeof getBlockDefinition>;
  type: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)]">
        <Blocks className="h-6 w-6 text-[var(--muted)]" />
      </div>
      <div>
        <p className="font-semibold text-[var(--foreground)]">{def?.displayName ?? type}</p>
        {def?.description && (
          <p className="mt-1 max-w-xs text-xs text-[var(--text-2)]">{def.description}</p>
        )}
      </div>
      <CanvasPreviewNote />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty canvas state
// ---------------------------------------------------------------------------

function EmptyCanvasState({ onInsert }: { onInsert: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--surface-2)]">
        <Blocks className="h-8 w-8 text-[var(--muted)]" />
      </div>
      <div>
        <p className="font-semibold text-[var(--foreground)]">Keine Abschnitte</p>
        <p className="mt-1 text-sm text-[var(--text-2)]">
          Füge den ersten Block hinzu, um die Seite zu gestalten.
        </p>
      </div>
      <button
        type="button"
        onClick={onInsert}
        className="fca-button-primary"
      >
        Block hinzufügen
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Preview note — small disclaimer for placeholder previews
// ---------------------------------------------------------------------------

function CanvasPreviewNote() {
  return (
    <p className="mt-3 text-[10px] text-[var(--muted)] italic">
      Canvas-Vorschau — genaue Darstellung auf der Website
    </p>
  );
}
