"use client";

/**
 * components/admin/page-builder/block-forms/SplitContentCardsInspectorContent.tsx
 *
 * Inspector-optimised Content section for the splitContentCards block.
 * Renders the "Inhalt" accordion panel:
 *   - Eyebrow / Headline / Fliesstext
 *   - Smart Cards region (compact, drag-sortable, variant pills)
 *   - Smart Images region (thumbnail-based, DAM-only)
 *
 * Columns and Layout are rendered as separate Inspector accordion sections
 * using ColumnsInspectorContent and LayoutConfigPanel respectively.
 */

import { useState } from "react";
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  X,
  Copy,
  LayoutGrid,
} from "lucide-react";
import dynamic from "next/dynamic";
import SharedMediaPicker from "@/components/admin/media/SharedMediaPicker";
import type { MediaAssetListItem } from "@/lib/media/types";
import type {
  SplitContentCardsSectionConfig,
  SplitContentCard,
  SplitContentImageRef,
  SplitContentCardVariant,
} from "@/lib/homepage/section-types";
import type { RichTextValue } from "@/lib/cms/rich-text";

const RichTextEditor = dynamic(() => import("@/components/admin/cms/RichTextEditor"), {
  ssr: false,
  loading: () => (
    <div className="h-24 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] animate-pulse" />
  ),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

const CARD_VARIANTS: { value: SplitContentCardVariant; label: string; color: string; dot: string }[] = [
  { value: "orange", label: "Orange", color: "bg-orange-500", dot: "bg-orange-500" },
  { value: "blue", label: "Blau", color: "bg-blue-600", dot: "bg-blue-600" },
  { value: "red", label: "Rot", color: "bg-red-600", dot: "bg-red-600" },
  { value: "neutral", label: "Neutral", color: "bg-gray-500", dot: "bg-gray-400" },
];

// ---------------------------------------------------------------------------
// Smart Card Item
// ---------------------------------------------------------------------------

function SmartCardItem({
  card,
  index,
  onChange,
  onRemove,
  onDuplicate,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragOver,
}: {
  card: SplitContentCard;
  index: number;
  onChange: (updated: SplitContentCard) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  isDragOver: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const variant = CARD_VARIANTS.find((v) => v.value === card.variant) ?? CARD_VARIANTS[3];

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`group rounded-lg border transition-all duration-100 ${
        isDragOver
          ? "border-blue-400 bg-blue-50 shadow-sm"
          : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)] hover:shadow-sm"
      }`}
    >
      {/* Card header — always visible */}
      <div className="flex items-center gap-1.5 px-2.5 py-2">
        <button
          type="button"
          className="flex-shrink-0 cursor-grab text-[var(--muted)] hover:text-[var(--text-2)] active:cursor-grabbing transition-colors"
          tabIndex={-1}
          aria-label="Karte verschieben"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>

        {/* Variant pill */}
        <span
          className={`flex-shrink-0 h-2 w-2 rounded-full ${variant.dot}`}
          title={variant.label}
        />

        {/* Collapsed preview */}
        {!expanded && (
          <div className="flex flex-1 flex-col min-w-0 leading-tight">
            <span className="truncate text-[11px] font-semibold text-[var(--foreground)]">
              {card.title || `Karte ${index + 1}`}
            </span>
            {card.body && (
              <span className="truncate text-[10px] text-[var(--muted)]">
                {card.body.slice(0, 60)}{card.body.length > 60 ? "…" : ""}
              </span>
            )}
          </div>
        )}

        {expanded && (
          <span className="flex-1 text-[11px] font-semibold text-[var(--foreground)]">
            {card.title || `Karte ${index + 1}`}
          </span>
        )}

        {/* Actions — visible on hover + expanded */}
        <div className={`flex flex-shrink-0 items-center gap-0.5 transition-opacity duration-100 ${expanded ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
          <button
            type="button"
            onClick={onDuplicate}
            className="rounded p-1 text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-2)] transition-colors"
            title="Karte duplizieren"
          >
            <Copy className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="rounded p-1 text-[var(--muted)] hover:bg-red-50 hover:text-red-600 transition-colors"
            title="Karte entfernen"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex-shrink-0 rounded p-1 text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] transition-colors"
          title={expanded ? "Einklappen" : "Bearbeiten"}
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Expanded edit fields */}
      {expanded && (
        <div className="space-y-3 border-t border-[var(--border)] px-3 pb-3 pt-3">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">
              Titel
            </label>
            <input
              type="text"
              value={card.title}
              onChange={(e) => onChange({ ...card, title: e.target.value })}
              placeholder="Kartenüberschrift"
              className="fca-input text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">
              Text
            </label>
            <textarea
              value={card.body}
              onChange={(e) => onChange({ ...card, body: e.target.value })}
              rows={3}
              placeholder="Kartentext"
              className="fca-input resize-none text-sm"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">
              Farbvariante
            </label>
            <div className="flex gap-1.5">
              {CARD_VARIANTS.map((v) => (
                <button
                  key={v.value}
                  type="button"
                  onClick={() => onChange({ ...card, variant: v.value })}
                  className={`flex flex-1 flex-col items-center gap-1 rounded-md border py-2 text-[10px] font-medium transition-all duration-100 ${
                    card.variant === v.value
                      ? "border-[var(--brand-primary,#f97316)] bg-orange-50 text-orange-700 shadow-sm"
                      : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--border-strong)] hover:text-[var(--text-2)]"
                  }`}
                >
                  <span className={`h-3 w-3 rounded-full ${v.dot}`} />
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Smart Image Item
// ---------------------------------------------------------------------------

function SmartImageItem({
  image,
  index,
  thumbnailUrl,
  onChange,
  onRemove,
}: {
  image: SplitContentImageRef;
  index: number;
  thumbnailUrl?: string;
  onChange: (updated: SplitContentImageRef) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="group rounded-lg border border-[var(--border)] bg-[var(--surface)] transition-all duration-100 hover:border-[var(--border-strong)] hover:shadow-sm">
      <div className="flex items-center gap-2 px-2.5 py-2">
        {/* Thumbnail or icon */}
        <div className="flex-shrink-0 h-8 w-8 rounded overflow-hidden border border-[var(--border)] bg-[var(--surface-2)] flex items-center justify-center">
          {thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnailUrl}
              alt={image.alt ?? ""}
              className="h-full w-full object-cover"
            />
          ) : (
            <ImageIcon className="h-4 w-4 text-[var(--muted)]" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="truncate text-[11px] font-semibold text-[var(--foreground)]">
            {image.alt || `Bild ${index + 1}`}
          </p>
          <p className="truncate text-[10px] text-[var(--muted)] font-mono">
            {image.mediaAssetId}
          </p>
        </div>

        <div className={`flex flex-shrink-0 items-center gap-0.5 transition-opacity duration-100 ${expanded ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
          <button
            type="button"
            onClick={onRemove}
            className="rounded p-1 text-[var(--muted)] hover:bg-red-50 hover:text-red-600 transition-colors"
            title="Bild entfernen"
          >
            <X className="h-3 w-3" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex-shrink-0 rounded p-1 text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] transition-colors"
          title={expanded ? "Einklappen" : "Details"}
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {expanded && (
        <div className="grid grid-cols-1 gap-2 border-t border-[var(--border)] px-3 pb-3 pt-2.5">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">
              Alt-Text
            </label>
            <input
              type="text"
              value={image.alt ?? ""}
              onChange={(e) => onChange({ ...image, alt: e.target.value })}
              placeholder="Beschreibung des Bildes"
              className="fca-input text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">
              Bildunterschrift
            </label>
            <input
              type="text"
              value={image.caption ?? ""}
              onChange={(e) => onChange({ ...image, caption: e.target.value })}
              placeholder="Optional"
              className="fca-input text-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

type Props = {
  cfg: SplitContentCardsSectionConfig;
  update: (patch: Partial<SplitContentCardsSectionConfig>) => void;
};

/**
 * Content section for SplitContentCards inspector panel.
 * Text fields, smart cards region, smart images region.
 */
export function SplitContentCardsContentSection({ cfg, update }: Props) {
  const [mediaPicker, setMediaPicker] = useState(false);
  const [cardDragSrc, setCardDragSrc] = useState<number | null>(null);
  const [cardDragOver, setCardDragOver] = useState<number | null>(null);

  const cards = cfg.cards ?? [];
  const images = cfg.images ?? [];

  function addCard() {
    update({
      cards: [
        ...cards,
        { id: generateId(), title: "", body: "", variant: "neutral" },
      ],
    });
  }

  function updateCard(index: number, updated: SplitContentCard) {
    const next = [...cards];
    next[index] = updated;
    update({ cards: next });
  }

  function removeCard(index: number) {
    update({ cards: cards.filter((_, i) => i !== index) });
  }

  function duplicateCard(index: number) {
    const original = cards[index];
    const copy: SplitContentCard = { ...original, id: generateId() };
    const next = [...cards];
    next.splice(index + 1, 0, copy);
    update({ cards: next });
  }

  function handleCardDrop(targetIndex: number) {
    if (cardDragSrc === null || cardDragSrc === targetIndex) return;
    const next = [...cards];
    const [moved] = next.splice(cardDragSrc, 1);
    next.splice(targetIndex, 0, moved);
    update({ cards: next });
    setCardDragSrc(null);
    setCardDragOver(null);
  }

  function addImage(asset: MediaAssetListItem) {
    update({
      images: [...images, { mediaAssetId: asset.id, alt: asset.altText ?? "", caption: "" }],
    });
    setMediaPicker(false);
  }

  function updateImage(index: number, updated: SplitContentImageRef) {
    const next = [...images];
    next[index] = updated;
    update({ images: next });
  }

  function removeImage(index: number) {
    update({ images: images.filter((_, i) => i !== index) });
  }

  return (
    <div className="space-y-4">
      {/* ── Text content ─────────────────────────────────────────── */}
      <div className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
          Text
        </p>

        <div>
          <label className="mb-1 block text-[11px] font-medium text-[var(--foreground)]">
            Eyebrow
            <span className="ml-1.5 text-[10px] font-normal text-[var(--muted)]">
              Kleine Beschriftung über der Überschrift
            </span>
          </label>
          <input
            type="text"
            value={cfg.eyebrow ?? ""}
            onChange={(e) => update({ eyebrow: e.target.value })}
            placeholder="z. B. Über uns · FC Allschwil"
            className="fca-input"
          />
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium text-[var(--foreground)]">
            Überschrift
          </label>
          <input
            type="text"
            value={cfg.headline ?? ""}
            onChange={(e) => update({ headline: e.target.value })}
            placeholder="Hauptüberschrift des Blocks"
            className="fca-input"
          />
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium text-[var(--foreground)]">
            Fliesstext
            <span className="ml-1.5 text-[10px] font-normal text-[var(--muted)]">
              Fett, Kursiv, Links, Listen
            </span>
          </label>
          <RichTextEditor
            value={(cfg.bodyRichText as RichTextValue | null) ?? null}
            onChange={(val) => update({ bodyRichText: val })}
            placeholder="Beschreibungstext (optional)"
          />
        </div>
      </div>

      {/* ── Smart Cards region ────────────────────────────────────── */}
      <div>
        <div className="mb-2.5 flex items-center gap-2 border-t border-[var(--border)] pt-3">
          <LayoutGrid className="h-3.5 w-3.5 flex-shrink-0 text-[var(--text-2)]" />
          <p className="flex-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
            Karten
            {cards.length > 0 && (
              <span className="ml-1.5 rounded-full bg-[var(--surface-3)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--text-2)]">
                {cards.length}
              </span>
            )}
          </p>
          <button
            type="button"
            onClick={addCard}
            className="flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-[11px] font-medium text-[var(--text-2)] transition-all duration-100 hover:border-[var(--brand-primary,#f97316)] hover:bg-orange-50 hover:text-orange-700"
          >
            <Plus className="h-3 w-3" />
            Hinzufügen
          </button>
        </div>

        {cards.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--border)] py-6 text-center">
            <LayoutGrid className="mx-auto mb-2 h-5 w-5 text-[var(--muted)]" />
            <p className="text-[11px] text-[var(--muted)]">
              Noch keine Karten vorhanden.
            </p>
            <p className="mt-0.5 text-[10px] text-[var(--muted)]">
              Karten hinzufügen, um gestapelte Inhaltsbereiche zu erstellen.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {cards.map((card, idx) => (
              <SmartCardItem
                key={card.id}
                card={card}
                index={idx}
                onChange={(updated) => updateCard(idx, updated)}
                onRemove={() => removeCard(idx)}
                onDuplicate={() => duplicateCard(idx)}
                onDragStart={(e) => {
                  setCardDragSrc(idx);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setCardDragOver(idx);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleCardDrop(idx);
                }}
                onDragEnd={() => {
                  setCardDragSrc(null);
                  setCardDragOver(null);
                }}
                isDragOver={cardDragOver === idx && cardDragSrc !== idx}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Smart Images region ───────────────────────────────────── */}
      <div>
        <div className="mb-2.5 flex items-center gap-2 border-t border-[var(--border)] pt-3">
          <ImageIcon className="h-3.5 w-3.5 flex-shrink-0 text-[var(--text-2)]" />
          <p className="flex-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
            Bilder
            {images.length > 0 && (
              <span className="ml-1.5 rounded-full bg-[var(--surface-3)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--text-2)]">
                {images.length}
              </span>
            )}
          </p>
          <button
            type="button"
            onClick={() => setMediaPicker(true)}
            className="flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-[11px] font-medium text-[var(--text-2)] transition-all duration-100 hover:border-[var(--brand-primary,#f97316)] hover:bg-orange-50 hover:text-orange-700"
          >
            <Plus className="h-3 w-3" />
            Hinzufügen
          </button>
        </div>

        <p className="mb-2 text-[10px] text-[var(--muted)]">
          Bilder werden als DAM-Referenz gespeichert. Platzierung im Kolumnen-Abschnitt.
        </p>

        {images.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--border)] py-5 text-center">
            <ImageIcon className="mx-auto mb-1.5 h-5 w-5 text-[var(--muted)]" />
            <p className="text-[11px] text-[var(--muted)]">Noch keine Bilder.</p>
            <p className="mt-0.5 text-[10px] text-[var(--muted)]">Aus der Mediathek auswählen.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {images.map((img, idx) => (
              <SmartImageItem
                key={`${img.mediaAssetId}-${idx}`}
                image={img}
                index={idx}
                onChange={(updated) => updateImage(idx, updated)}
                onRemove={() => removeImage(idx)}
              />
            ))}
          </div>
        )}
      </div>

      {/* DAM Picker */}
      <SharedMediaPicker
        open={mediaPicker}
        onClose={() => setMediaPicker(false)}
        onSelect={addImage}
        filterType="IMAGE"
        title="Bild aus Mediathek auswählen"
      />
    </div>
  );
}

/**
 * Columns section for SplitContentCards inspector panel.
 */
export function SplitContentCardsColumnsSection({ cfg, update }: Props) {
  const layout = cfg.layout ?? "TEXT_LEFT_CARDS_RIGHT";
  const mediaPlacement = cfg.mediaPlacement ?? "NONE";

  const LAYOUT_OPTIONS = [
    {
      value: "TEXT_LEFT_CARDS_RIGHT" as const,
      label: "Text links · Karten rechts",
      desc: "Eyebrow, Headline und Fliesstext links; Karten rechts.",
    },
    {
      value: "CARDS_LEFT_TEXT_RIGHT" as const,
      label: "Karten links · Text rechts",
      desc: "Karten links; Text rechts.",
    },
  ];

  const PLACEMENT_OPTIONS = [
    { value: "NONE" as const, label: "Kein Bild", desc: "Reiner Textinhalt." },
    { value: "WITH_TEXT" as const, label: "Bei Text", desc: "Bild unter dem Textbereich." },
    { value: "WITH_CARDS" as const, label: "Bei Karten", desc: "Bild unter den Karten." },
    { value: "OPPOSITE_TEXT" as const, label: "Gegenüber Text", desc: "Bild füllt die gegenüberliegende Seite." },
  ];

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
          Spaltenanordnung
        </p>
        <div className="space-y-1.5">
          {LAYOUT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update({ layout: opt.value })}
              className={`w-full rounded-lg border px-3 py-2.5 text-left transition-all duration-100 ${
                layout === opt.value
                  ? "border-[var(--brand-primary,#f97316)] bg-orange-50 shadow-sm"
                  : "border-[var(--border)] hover:border-[var(--border-strong)]"
              }`}
            >
              <p className={`text-xs font-semibold ${layout === opt.value ? "text-orange-700" : "text-[var(--foreground)]"}`}>
                {opt.label}
              </p>
              <p className="mt-0.5 text-[10px] text-[var(--muted)]">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
          Bildplatzierung
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {PLACEMENT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update({ mediaPlacement: opt.value })}
              className={`rounded-lg border px-2.5 py-2 text-left transition-all duration-100 ${
                mediaPlacement === opt.value
                  ? "border-[var(--brand-primary,#f97316)] bg-orange-50 shadow-sm"
                  : "border-[var(--border)] hover:border-[var(--border-strong)]"
              }`}
            >
              <p className={`text-[11px] font-semibold ${mediaPlacement === opt.value ? "text-orange-700" : "text-[var(--foreground)]"}`}>
                {opt.label}
              </p>
              <p className="mt-0.5 text-[10px] text-[var(--muted)]">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Variant reference */}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
          Kartenfarben-Referenz
        </p>
        <div className="flex flex-wrap gap-3">
          {CARD_VARIANTS.map((v) => (
            <div key={v.value} className="flex items-center gap-1.5 text-[11px] text-[var(--text-2)]">
              <span className={`h-3 w-3 rounded-full ${v.dot}`} />
              {v.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
