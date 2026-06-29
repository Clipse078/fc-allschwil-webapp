"use client";

/**
 * components/admin/visual-builder/SplitContentCardsEditableCanvas.tsx
 *
 * Visual Layout Manipulation canvas for the splitContentCards block.
 *
 * Wraps the live renderer with interactive overlays that let editors
 * manipulate layout directly on the canvas rather than through the Inspector:
 *
 *   1. Image / Column Placement — arrows to swap text ↔ cards column sides.
 *   2. Column Resize Handle     — drag the divider to change column ratio.
 *   3. Card Reorder             — drag cards up / down within the canvas.
 *   4. Undo / Redo              — Ctrl+Z / Ctrl+Y with toolbar buttons.
 *
 * Design principles:
 *   - All mutations go through onChange() — the same callback the Inspector
 *     uses. No second config model.
 *   - Handles are only visible when the section is selected (the parent passes
 *     the component in active-editing state).
 *   - Keyboard fallbacks exist for every drag interaction.
 *   - Inspector updates immediately because premiumConfig is shared state.
 *
 * Accessibility:
 *   - Move image left/right: buttons with aria-labels.
 *   - Column ratio: selector + keyboard-navigable handle.
 *   - Move card up/down: buttons with aria-labels.
 *   - Focus rings on all interactive elements.
 */

import { useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  ArrowRight,
  MoveHorizontal,
  GripVertical,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  RotateCw,
  LayoutPanelLeft,
} from "lucide-react";
import ColumnResizeHandle from "@/components/admin/visual-builder/ColumnResizeHandle";
import type {
  SplitContentCardsSectionConfig,
  SplitContentCard,
  SplitContentCardsLayout,
} from "@/lib/homepage/section-types";
import type { SectionColumns } from "@/lib/cms/layout-types";
import type { EditorHistory } from "@/lib/cms/use-editor-history";

// Lazy-load renderer to avoid SSR issues (it uses SectionShell + theme tokens)
const SplitContentCardsRenderer = dynamic(
  () => import("@/components/website/blocks/SplitContentCardsRenderer"),
  {
    ssr: false,
    loading: () => (
      <div className="h-48 animate-pulse rounded-lg bg-gray-100" />
    ),
  },
);

// ---------------------------------------------------------------------------
// Column preset options (shown in toolbar selector)
// ---------------------------------------------------------------------------

const COLUMN_PRESETS: { value: SectionColumns; label: string }[] = [
  { value: "25/75", label: "25 / 75" },
  { value: "33/66", label: "33 / 66" },
  { value: "50/50", label: "50 / 50" },
  { value: "66/33", label: "66 / 33" },
  { value: "75/25", label: "75 / 25" },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  /** Current full block config (shared with Inspector). */
  config: Record<string, unknown>;
  /** Mutate config — same callback as SplitContentCardsConfigForm.onChange. */
  onChange: (config: Record<string, unknown>) => void;
  /** Undo/Redo history from the parent editor session. */
  history: EditorHistory<Record<string, unknown>>;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCfg(raw: Record<string, unknown>): SplitContentCardsSectionConfig {
  return raw as SplitContentCardsSectionConfig;
}

// ---------------------------------------------------------------------------
// Card drag item — used in the canvas card list
// ---------------------------------------------------------------------------

type CardDragItemProps = {
  card: SplitContentCard;
  index: number;
  total: number;
  isDragSource: boolean;
  isDragTarget: boolean;
  onDragStart: (e: React.DragEvent, idx: number) => void;
  onDragOver: (e: React.DragEvent, idx: number) => void;
  onDrop: (e: React.DragEvent, idx: number) => void;
  onDragEnd: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
};

function CardDragItem({
  card,
  index,
  total,
  isDragSource,
  isDragTarget,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onMoveUp,
  onMoveDown,
}: CardDragItemProps) {
  const VARIANT_COLORS: Record<string, string> = {
    orange: "border-l-orange-500",
    blue: "border-l-blue-600",
    red: "border-l-red-600",
    neutral: "border-l-gray-400",
  };
  const borderColor = VARIANT_COLORS[card.variant] ?? VARIANT_COLORS.neutral;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
      onDragEnd={onDragEnd}
      className={`group flex items-center gap-2 rounded-lg border-l-4 bg-white px-3 py-2.5 shadow-sm transition-all ${borderColor} ${
        isDragSource ? "opacity-40 shadow-none" : ""
      } ${isDragTarget ? "ring-2 ring-blue-400 ring-offset-1" : ""}`}
    >
      {/* Drag grip */}
      <div
        className="cursor-grab text-gray-300 hover:text-gray-500 active:cursor-grabbing"
        title="Ziehen zum Neuanordnen"
        aria-hidden="true"
      >
        <GripVertical className="h-4 w-4" />
      </div>

      {/* Card label */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-gray-800">
          {card.title || `Karte ${index + 1}`}
        </p>
        {card.body && (
          <p className="truncate text-[10px] text-gray-400">{card.body}</p>
        )}
      </div>

      {/* Move buttons (keyboard fallback) */}
      <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={index === 0}
          className="rounded p-0.5 text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-30 focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
          aria-label={`Karte ${index + 1} nach oben bewegen`}
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={index === total - 1}
          className="rounded p-0.5 text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-30 focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
          aria-label={`Karte ${index + 1} nach unten bewegen`}
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SplitContentCardsEditableCanvas({
  config,
  onChange,
  history,
}: Props) {
  const cfg = getCfg(config);
  const containerRef = useRef<HTMLDivElement>(null);

  // Card drag state
  const [cardDragSrc, setCardDragSrc] = useState<number | null>(null);
  const [cardDragTarget, setCardDragTarget] = useState<number | null>(null);

  // Local flag to show the cards reorder panel
  const [showCardPanel, setShowCardPanel] = useState(false);

  // ---------------------------------------------------------------------------
  // Mutation helpers — always push snapshot BEFORE mutating
  // ---------------------------------------------------------------------------

  const mutate = useCallback(
    (patch: Partial<SplitContentCardsSectionConfig>) => {
      history.pushSnapshot(config);
      onChange({ ...config, ...patch });
    },
    [config, onChange, history],
  );

  // ---------------------------------------------------------------------------
  // Image / column placement
  // ---------------------------------------------------------------------------

  const currentLayout: SplitContentCardsLayout =
    cfg.layout ?? "TEXT_LEFT_CARDS_RIGHT";

  function swapColumns() {
    const next: SplitContentCardsLayout =
      currentLayout === "TEXT_LEFT_CARDS_RIGHT"
        ? "CARDS_LEFT_TEXT_RIGHT"
        : "TEXT_LEFT_CARDS_RIGHT";
    mutate({ layout: next });
  }

  // ---------------------------------------------------------------------------
  // Column ratio
  // ---------------------------------------------------------------------------

  const currentColumns: SectionColumns =
    (cfg._layout?.columns as SectionColumns | undefined) ?? "50/50";

  function setColumns(columns: SectionColumns) {
    // Only push snapshot if value actually changed
    if (columns === currentColumns) return;
    history.pushSnapshot(config);
    onChange({
      ...config,
      _layout: { ...(cfg._layout ?? {}), columns },
    });
  }

  // ---------------------------------------------------------------------------
  // Card reorder
  // ---------------------------------------------------------------------------

  const cards = cfg.cards ?? [];

  function handleCardDrop(targetIdx: number) {
    if (cardDragSrc === null || cardDragSrc === targetIdx) return;
    const next = [...cards];
    const [moved] = next.splice(cardDragSrc, 1);
    next.splice(targetIdx, 0, moved);
    mutate({ cards: next });
    setCardDragSrc(null);
    setCardDragTarget(null);
  }

  function moveCard(fromIdx: number, toIdx: number) {
    if (toIdx < 0 || toIdx >= cards.length) return;
    const next = [...cards];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    mutate({ cards: next });
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const isTextLeft = currentLayout === "TEXT_LEFT_CARDS_RIGHT";

  return (
    <div className="space-y-3">
      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
        {/* Undo / Redo */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              const prev = history.undo(config);
              if (prev !== null) onChange(prev);
            }}
            disabled={!history.canUndo}
            className="flex h-7 w-7 items-center justify-center rounded border border-transparent text-gray-500 transition hover:border-gray-200 hover:bg-white disabled:cursor-not-allowed disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            aria-label="Rückgängig (Ctrl+Z)"
            title="Rückgängig (Ctrl+Z)"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              const next = history.redo(config);
              if (next !== null) onChange(next);
            }}
            disabled={!history.canRedo}
            className="flex h-7 w-7 items-center justify-center rounded border border-transparent text-gray-500 transition hover:border-gray-200 hover:bg-white disabled:cursor-not-allowed disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            aria-label="Wiederholen (Ctrl+Y)"
            title="Wiederholen (Ctrl+Y)"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Divider */}
        <div className="h-4 w-px bg-blue-200" aria-hidden="true" />

        {/* Column swap button */}
        <button
          type="button"
          onClick={swapColumns}
          className="flex items-center gap-1.5 rounded border border-blue-200 bg-white px-2.5 py-1 text-xs font-medium text-blue-700 transition hover:border-blue-400 hover:bg-blue-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          aria-label={`Spalten tauschen: Bild ${isTextLeft ? "rechts" : "links"} nach ${isTextLeft ? "links" : "rechts"} verschieben`}
          title="Spalten tauschen"
        >
          {isTextLeft ? (
            <>
              <ArrowLeft className="h-3.5 w-3.5" />
              Inhalt nach links
            </>
          ) : (
            <>
              <ArrowRight className="h-3.5 w-3.5" />
              Inhalt nach rechts
            </>
          )}
        </button>

        {/* Divider */}
        <div className="h-4 w-px bg-blue-200" aria-hidden="true" />

        {/* Column ratio selector */}
        <div className="flex items-center gap-1.5">
          <LayoutPanelLeft className="h-3.5 w-3.5 text-blue-500" aria-hidden="true" />
          <select
            value={currentColumns}
            onChange={(e) => setColumns(e.target.value as SectionColumns)}
            className="rounded border border-blue-200 bg-white px-2 py-0.5 text-xs font-medium text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            aria-label="Spaltenverhältnis"
            title="Spaltenverhältnis"
          >
            {COLUMN_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {/* Divider */}
        <div className="h-4 w-px bg-blue-200" aria-hidden="true" />

        {/* Toggle card reorder panel */}
        <button
          type="button"
          onClick={() => setShowCardPanel((v) => !v)}
          className={`flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
            showCardPanel
              ? "border-blue-400 bg-blue-100 text-blue-700"
              : "border-blue-200 bg-white text-blue-700 hover:border-blue-400 hover:bg-blue-100"
          }`}
          aria-label={showCardPanel ? "Kartenliste ausblenden" : "Karten neu anordnen"}
          title="Karten neu anordnen"
        >
          <MoveHorizontal className="h-3.5 w-3.5" />
          {showCardPanel ? "Schliessen" : "Karten ordnen"}
        </button>

        {/* Layout swap label (informational) */}
        <span className="ml-auto text-[10px] text-blue-500">
          {isTextLeft ? "Text links · Karten rechts" : "Karten links · Text rechts"}
        </span>
      </div>

      {/* ── Visual preview with column resize handle ────────────────────── */}
      <div
        ref={containerRef}
        className="group/canvas relative overflow-hidden rounded-lg border-2 border-blue-200"
        style={{ minHeight: 100 }}
      >
        {/* Rendered preview */}
        <SplitContentCardsRenderer config={config} previewMode />

        {/* Column resize handle — positioned over the preview */}
        <ColumnResizeHandle
          columns={currentColumns}
          onChange={setColumns}
          containerRef={containerRef}
        />
      </div>

      {/* ── Card reorder panel ──────────────────────────────────────────── */}
      {showCardPanel && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
          <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Karten neu anordnen — {cards.length} Karte{cards.length !== 1 ? "n" : ""}
          </p>

          {cards.length === 0 ? (
            <p className="text-xs text-[var(--muted)] italic">
              Noch keine Karten vorhanden. Im Inhalt-Tab Karten hinzufügen.
            </p>
          ) : (
            <div className="space-y-1.5">
              {cards.map((card, idx) => (
                <CardDragItem
                  key={card.id}
                  card={card}
                  index={idx}
                  total={cards.length}
                  isDragSource={cardDragSrc === idx}
                  isDragTarget={cardDragTarget === idx && cardDragSrc !== idx}
                  onDragStart={(e) => {
                    setCardDragSrc(idx);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setCardDragTarget(idx);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleCardDrop(idx);
                  }}
                  onDragEnd={() => {
                    setCardDragSrc(null);
                    setCardDragTarget(null);
                  }}
                  onMoveUp={() => moveCard(idx, idx - 1)}
                  onMoveDown={() => moveCard(idx, idx + 1)}
                />
              ))}
            </div>
          )}

          <p className="mt-2 text-[10px] text-[var(--muted)]">
            Karten ziehen oder Pfeile nutzen · Reihenfolge wird sofort übernommen
          </p>
        </div>
      )}
    </div>
  );
}
