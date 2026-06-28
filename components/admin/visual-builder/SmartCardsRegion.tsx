"use client";

/**
 * components/admin/visual-builder/SmartCardsRegion.tsx
 *
 * CMS V3 — Smart Cards Region for the Visual Canvas.
 *
 * Renders the cards column with direct manipulation controls:
 *   - Inline title and body editing (via InlineEditableText)
 *   - Move up / move down per card
 *   - Duplicate card
 *   - Remove card
 *   - Quick variant selector
 *   - "+ Karte hinzufügen" at the bottom
 *
 * All state changes are propagated upward via onCardsChange.
 * No API calls here — the parent (CanvasEditController) triggers
 * autosave via the existing save endpoint.
 */

import { useState } from "react";
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Copy,
} from "lucide-react";
import InlineEditableText from "@/components/admin/visual-builder/InlineEditableText";
import type {
  SplitContentCard,
  SplitContentCardVariant,
} from "@/lib/homepage/section-types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CARD_VARIANT_CLASSES: Record<
  SplitContentCardVariant,
  { border: string; bg: string; titleColor: string; dot: string }
> = {
  orange: {
    border: "border-l-orange-500",
    bg: "bg-orange-50",
    titleColor: "text-orange-700",
    dot: "bg-orange-500",
  },
  blue: {
    border: "border-l-blue-600",
    bg: "bg-blue-50",
    titleColor: "text-blue-700",
    dot: "bg-blue-600",
  },
  red: {
    border: "border-l-red-600",
    bg: "bg-red-50",
    titleColor: "text-red-700",
    dot: "bg-red-600",
  },
  neutral: {
    border: "border-l-gray-400",
    bg: "bg-gray-50",
    titleColor: "text-gray-700",
    dot: "bg-gray-400",
  },
};

const VARIANT_OPTIONS: { value: SplitContentCardVariant; label: string }[] = [
  { value: "orange", label: "Orange" },
  { value: "blue", label: "Blau" },
  { value: "red", label: "Rot" },
  { value: "neutral", label: "Neutral" },
];

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type SmartCardsRegionProps = {
  cards: SplitContentCard[];
  onCardsChange: (cards: SplitContentCard[]) => void;
  darkMode?: boolean;
};

// ---------------------------------------------------------------------------
// Card item with inline editing + controls
// ---------------------------------------------------------------------------

function SmartCardItem({
  card,
  index,
  total,
  darkMode,
  onChange,
  onRemove,
  onDuplicate,
  onMoveUp,
  onMoveDown,
}: {
  card: SplitContentCard;
  index: number;
  total: number;
  darkMode?: boolean;
  onChange: (updated: SplitContentCard) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [showVariantPicker, setShowVariantPicker] = useState(false);
  const variant = CARD_VARIANT_CLASSES[card.variant] ?? CARD_VARIANT_CLASSES.neutral;

  return (
    <div
      className={`group/card relative rounded-lg border-l-4 p-4 shadow-sm transition-shadow hover:shadow-md ${
        variant.border
      } ${darkMode ? "bg-white/10" : variant.bg}`}
    >
      {/* Card action toolbar — visible on hover */}
      <div className="absolute -top-3 right-2 hidden group-hover/card:flex items-center gap-0.5 rounded-full border border-[var(--border)] bg-white shadow-sm px-1.5 py-0.5 z-10">
        {/* Move up */}
        <button
          type="button"
          onClick={onMoveUp}
          disabled={index === 0}
          className="rounded p-0.5 text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-30 transition"
          title="Karte nach oben"
          aria-label="Karte nach oben verschieben"
        >
          <ChevronUp className="h-3 w-3" />
        </button>
        {/* Move down */}
        <button
          type="button"
          onClick={onMoveDown}
          disabled={index === total - 1}
          className="rounded p-0.5 text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-30 transition"
          title="Karte nach unten"
          aria-label="Karte nach unten verschieben"
        >
          <ChevronDown className="h-3 w-3" />
        </button>
        {/* Variant picker */}
        <button
          type="button"
          onClick={() => setShowVariantPicker((v) => !v)}
          className="rounded p-0.5 transition hover:bg-gray-100"
          title="Farbvariante wählen"
          aria-label="Kartenfarbe ändern"
          aria-expanded={showVariantPicker}
        >
          <span className={`block h-2.5 w-2.5 rounded-full ${variant.dot}`} />
        </button>
        {/* Duplicate */}
        <button
          type="button"
          onClick={onDuplicate}
          className="rounded p-0.5 text-[var(--muted)] hover:text-[var(--foreground)] transition"
          title="Karte duplizieren"
          aria-label="Karte duplizieren"
        >
          <Copy className="h-3 w-3" />
        </button>
        {/* Remove */}
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-0.5 text-rose-500 hover:text-rose-700 transition"
          title="Karte entfernen"
          aria-label="Karte entfernen"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {/* Variant picker dropdown */}
      {showVariantPicker && (
        <div className="absolute -top-1 right-2 z-20 mt-6 rounded-lg border border-[var(--border)] bg-white p-2 shadow-lg">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Farbe
          </p>
          <div className="flex gap-1.5">
            {VARIANT_OPTIONS.map((opt) => {
              const vc = CARD_VARIANT_CLASSES[opt.value];
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange({ ...card, variant: opt.value });
                    setShowVariantPicker(false);
                  }}
                  className={`h-5 w-5 rounded-full border-2 transition ${vc.dot} ${
                    card.variant === opt.value
                      ? "border-blue-500 scale-110"
                      : "border-transparent hover:border-gray-400"
                  }`}
                  title={opt.label}
                  aria-label={opt.label}
                  aria-pressed={card.variant === opt.value}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Card title — inline editable */}
      <h4 className={`mb-1 text-sm font-semibold ${darkMode ? "text-white" : variant.titleColor}`}>
        <InlineEditableText
          value={card.title}
          onChange={(v) => onChange({ ...card, title: v })}
          placeholder="Kartentitel bearbeiten"
          className="block w-full"
          maxLength={200}
          ariaLabel="Kartentitel bearbeiten"
        />
      </h4>

      {/* Card body — inline editable (multiline) */}
      <p className={`text-sm leading-relaxed ${darkMode ? "text-gray-200" : "text-gray-600"}`}>
        <InlineEditableText
          value={card.body}
          onChange={(v) => onChange({ ...card, body: v })}
          placeholder="Kartentext bearbeiten"
          multiline
          className="block w-full"
          maxLength={2000}
          ariaLabel="Kartentext bearbeiten"
        />
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SmartCardsRegion
// ---------------------------------------------------------------------------

export default function SmartCardsRegion({
  cards,
  onCardsChange,
  darkMode = false,
}: SmartCardsRegionProps) {
  function updateCard(index: number, updated: SplitContentCard) {
    const next = [...cards];
    next[index] = updated;
    onCardsChange(next);
  }

  function removeCard(index: number) {
    onCardsChange(cards.filter((_, i) => i !== index));
  }

  function duplicateCard(index: number) {
    const copy: SplitContentCard = {
      ...cards[index],
      id: generateId(),
    };
    const next = [...cards];
    next.splice(index + 1, 0, copy);
    onCardsChange(next);
  }

  function moveCard(index: number, direction: "up" | "down") {
    const next = [...cards];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= next.length) return;
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    onCardsChange(next);
  }

  function addCard() {
    onCardsChange([
      ...cards,
      { id: generateId(), title: "", body: "", variant: "neutral" },
    ]);
  }

  return (
    <div className="flex flex-col gap-3">
      {cards.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-400">
          Noch keine Karten
        </div>
      ) : (
        cards.map((card, idx) => (
          <SmartCardItem
            key={card.id}
            card={card}
            index={idx}
            total={cards.length}
            darkMode={darkMode}
            onChange={(updated) => updateCard(idx, updated)}
            onRemove={() => removeCard(idx)}
            onDuplicate={() => duplicateCard(idx)}
            onMoveUp={() => moveCard(idx, "up")}
            onMoveDown={() => moveCard(idx, "down")}
          />
        ))
      )}

      {/* Add card button */}
      <button
        type="button"
        onClick={addCard}
        className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-blue-300 bg-blue-50/60 px-4 py-2.5 text-sm font-medium text-blue-600 transition hover:border-blue-400 hover:bg-blue-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
        aria-label="Karte hinzufügen"
      >
        <Plus className="h-4 w-4" />
        Karte hinzufügen
      </button>
    </div>
  );
}
