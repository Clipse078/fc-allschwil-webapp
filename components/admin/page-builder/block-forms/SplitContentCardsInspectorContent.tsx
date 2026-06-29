"use client";

/**
 * components/admin/page-builder/block-forms/SplitContentCardsInspectorContent.tsx
 *
 * Inspector content adapter for the splitContentCards block.
 *
 * Used by InspectorPanel to render the Content and Style sections
 * without the full tabbed SplitContentCardsConfigForm wrapper.
 *
 * mode="content" (default)
 *   Renders: eyebrow, headline, rich text, cards CRUD + DnD, images (DAM).
 *   Same as the "Inhalt" tab in SplitContentCardsConfigForm.
 *
 * mode="style"
 *   Renders: column arrangement (TEXT_LEFT_CARDS_RIGHT / CARDS_LEFT_TEXT_RIGHT),
 *            image placement, card colour reference.
 *   Same as the "Kolumnen" tab in SplitContentCardsConfigForm.
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
  MoveHorizontal,
} from "lucide-react";
import dynamic from "next/dynamic";
import SharedMediaPicker from "@/components/admin/media/SharedMediaPicker";
import type { MediaAssetListItem } from "@/lib/media/types";
import type {
  SplitContentCardsSectionConfig,
  SplitContentCard,
  SplitContentImageRef,
  SplitContentCardVariant,
  SplitContentCardsLayout,
  SplitContentCardsMediaPlacement,
} from "@/lib/homepage/section-types";
import type { RichTextValue } from "@/lib/cms/rich-text";

// Lazy-load TipTap rich text editor to avoid SSR issues
const RichTextEditor = dynamic(() => import("@/components/admin/cms/RichTextEditor"), {
  ssr: false,
  loading: () => (
    <div className="h-24 animate-pulse rounded-lg border border-[var(--border)] bg-[var(--surface-2)]" />
  ),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SplitContentCardsInspectorContentProps = {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  /** content = eyebrow/headline/body/cards/images | style = layout/media-placement */
  mode?: "content" | "style";
};

// ---------------------------------------------------------------------------
// Card variants
// ---------------------------------------------------------------------------

const CARD_VARIANTS: { value: SplitContentCardVariant; label: string; color: string }[] = [
  { value: "orange", label: "Orange", color: "bg-orange-500" },
  { value: "blue", label: "Blau", color: "bg-blue-600" },
  { value: "red", label: "Rot", color: "bg-red-600" },
  { value: "neutral", label: "Neutral", color: "bg-gray-500" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function getCfg(raw: Record<string, unknown>): SplitContentCardsSectionConfig {
  return raw as SplitContentCardsSectionConfig;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">
      {children}
    </p>
  );
}

function FieldWrapper({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-[var(--foreground)]">{label}</label>
      {hint && <p className="text-[11px] text-[var(--muted)]">{hint}</p>}
      {children}
    </div>
  );
}

function CardEditorItem({
  card,
  index,
  onChange,
  onRemove,
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
      className={`rounded-lg border transition-colors ${
        isDragOver
          ? "border-blue-400 bg-blue-50"
          : "border-[var(--border)] bg-[var(--surface)]"
      }`}
    >
      <div className="flex items-center gap-2 px-2.5 py-2">
        <GripVertical className="h-3.5 w-3.5 flex-shrink-0 cursor-grab text-[var(--muted)]" />
        <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${variant.color}`} />
        <span className="flex-1 truncate text-xs font-medium text-[var(--foreground)]">
          {card.title || `Karte ${index + 1}`}
        </span>
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="sce-icon-button"
        >
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="sce-icon-button text-rose-500 hover:text-rose-700"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="space-y-3 border-t border-[var(--border)] px-3 pb-3 pt-3">
          <FieldWrapper label="Titel">
            <input
              type="text"
              value={card.title}
              onChange={(e) => onChange({ ...card, title: e.target.value })}
              placeholder="Kartenüberschrift"
              className="fca-input"
            />
          </FieldWrapper>
          <FieldWrapper label="Text">
            <textarea
              value={card.body}
              onChange={(e) => onChange({ ...card, body: e.target.value })}
              rows={2}
              placeholder="Kartentext"
              className="fca-input resize-none"
            />
          </FieldWrapper>
          <FieldWrapper label="Farbvariante">
            <div className="flex flex-wrap gap-1.5">
              {CARD_VARIANTS.map((v) => (
                <button
                  key={v.value}
                  type="button"
                  onClick={() => onChange({ ...card, variant: v.value })}
                  className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition ${
                    card.variant === v.value
                      ? "border-[var(--brand-primary,#f97316)] bg-orange-50 font-medium text-orange-700"
                      : "border-[var(--border)] hover:border-[var(--brand-primary,#f97316)]"
                  }`}
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${v.color}`} />
                  {v.label}
                </button>
              ))}
            </div>
          </FieldWrapper>
        </div>
      )}
    </div>
  );
}

function ImageEditorItem({
  image,
  index,
  onChange,
  onRemove,
}: {
  image: SplitContentImageRef;
  index: number;
  onChange: (updated: SplitContentImageRef) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2.5 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-3.5 w-3.5 flex-shrink-0 text-[var(--text-2)]" />
          <p className="text-xs font-medium text-[var(--foreground)]">Bild {index + 1}</p>
          <span className="max-w-[100px] truncate text-[10px] font-mono text-[var(--muted)]">
            {image.mediaAssetId}
          </span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="sce-icon-button text-rose-500 hover:text-rose-700"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <FieldWrapper label="Alt-Text">
          <input
            type="text"
            value={image.alt ?? ""}
            onChange={(e) => onChange({ ...image, alt: e.target.value })}
            placeholder="Bildbeschreibung"
            className="fca-input"
          />
        </FieldWrapper>
        <FieldWrapper label="Bildunterschrift">
          <input
            type="text"
            value={image.caption ?? ""}
            onChange={(e) => onChange({ ...image, caption: e.target.value })}
            placeholder="Optional"
            className="fca-input"
          />
        </FieldWrapper>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Content mode
// ---------------------------------------------------------------------------

function ContentMode({
  cfg,
  config,
  onChange,
}: {
  cfg: SplitContentCardsSectionConfig;
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}) {
  const [mediaPicker, setMediaPicker] = useState(false);
  const [cardDragSrc, setCardDragSrc] = useState<number | null>(null);
  const [cardDragOver, setCardDragOver] = useState<number | null>(null);

  const cards = cfg.cards ?? [];
  const images = cfg.images ?? [];

  function update(patch: Partial<SplitContentCardsSectionConfig>) {
    onChange({ ...config, ...patch });
  }

  function addCard() {
    update({ cards: [...cards, { id: generateId(), title: "", body: "", variant: "neutral" }] });
  }

  function updateCard(index: number, updated: SplitContentCard) {
    const next = [...cards];
    next[index] = updated;
    update({ cards: next });
  }

  function removeCard(index: number) {
    update({ cards: cards.filter((_, i) => i !== index) });
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
      <FieldWrapper label="Eyebrow" hint="Kleine Beschriftung über der Überschrift">
        <input
          type="text"
          value={cfg.eyebrow ?? ""}
          onChange={(e) => update({ eyebrow: e.target.value })}
          placeholder="z. B. Über uns"
          className="fca-input"
        />
      </FieldWrapper>

      <FieldWrapper label="Überschrift">
        <input
          type="text"
          value={cfg.headline ?? ""}
          onChange={(e) => update({ headline: e.target.value })}
          placeholder="Hauptüberschrift"
          className="fca-input"
        />
      </FieldWrapper>

      <FieldWrapper label="Fliesstext" hint="Unterstützt Fett, Kursiv, Links, Listen.">
        <RichTextEditor
          value={(cfg.bodyRichText as RichTextValue | null) ?? null}
          onChange={(val) => update({ bodyRichText: val })}
          placeholder="Beschreibungstext (optional)"
        />
      </FieldWrapper>

      {/* Cards */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <SectionLabel>Karten ({cards.length})</SectionLabel>
          <button
            type="button"
            onClick={addCard}
            className="flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-[11px] font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)] transition"
          >
            <Plus className="h-3.5 w-3.5" />
            Hinzufügen
          </button>
        </div>
        {cards.length === 0 && (
          <div className="rounded-lg border border-dashed border-[var(--border)] py-5 text-center text-xs text-[var(--muted)]">
            Noch keine Karten
          </div>
        )}
        <div className="space-y-1.5">
          {cards.map((card, idx) => (
            <CardEditorItem
              key={card.id}
              card={card}
              index={idx}
              onChange={(updated) => updateCard(idx, updated)}
              onRemove={() => removeCard(idx)}
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
      </div>

      {/* Images */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <SectionLabel>Bilder ({images.length})</SectionLabel>
          <button
            type="button"
            onClick={() => setMediaPicker(true)}
            className="flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-[11px] font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)] transition"
          >
            <Plus className="h-3.5 w-3.5" />
            Hinzufügen
          </button>
        </div>
        {images.length === 0 && (
          <div className="rounded-lg border border-dashed border-[var(--border)] py-5 text-center text-xs text-[var(--muted)]">
            Noch keine Bilder — aus Mediathek auswählen
          </div>
        )}
        <div className="space-y-1.5">
          {images.map((img, idx) => (
            <ImageEditorItem
              key={idx}
              image={img}
              index={idx}
              onChange={(updated) => updateImage(idx, updated)}
              onRemove={() => removeImage(idx)}
            />
          ))}
        </div>
      </div>

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

// ---------------------------------------------------------------------------
// Style mode (column arrangement + image placement)
// ---------------------------------------------------------------------------

function StyleMode({
  cfg,
  config,
  onChange,
}: {
  cfg: SplitContentCardsSectionConfig;
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}) {
  const layout = cfg.layout ?? "TEXT_LEFT_CARDS_RIGHT";
  const mediaPlacement = cfg.mediaPlacement ?? "NONE";

  function update(patch: Partial<SplitContentCardsSectionConfig>) {
    onChange({ ...config, ...patch });
  }

  const LAYOUT_OPTIONS: { value: SplitContentCardsLayout; label: string; desc: string }[] = [
    {
      value: "TEXT_LEFT_CARDS_RIGHT",
      label: "Text links · Karten rechts",
      desc: "Headline links, gestapelte Karten rechts",
    },
    {
      value: "CARDS_LEFT_TEXT_RIGHT",
      label: "Karten links · Text rechts",
      desc: "Gestapelte Karten links, Text rechts",
    },
  ];

  const PLACEMENT_OPTIONS: { value: SplitContentCardsMediaPlacement; label: string; desc: string }[] = [
    { value: "NONE", label: "Kein Bild", desc: "Reiner Textinhalt" },
    { value: "WITH_TEXT", label: "Bild bei Text", desc: "Unter dem Textbereich" },
    { value: "WITH_CARDS", label: "Bild bei Karten", desc: "Unter den Karten" },
    { value: "OPPOSITE_TEXT", label: "Gegenüber Text", desc: "Gegenüberliegende Seite" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <SectionLabel>Spaltenanordnung</SectionLabel>
        <div className="mt-2 space-y-1.5">
          {LAYOUT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update({ layout: opt.value })}
              className={`w-full rounded-lg border px-3 py-2.5 text-left transition ${
                layout === opt.value
                  ? "border-[var(--brand-primary,#f97316)] bg-orange-50"
                  : "border-[var(--border)] hover:border-[var(--brand-primary,#f97316)]"
              }`}
            >
              <div className="flex items-center gap-2">
                <MoveHorizontal className="h-3.5 w-3.5 flex-shrink-0 text-[var(--text-2)]" />
                <span className="text-xs font-semibold text-[var(--foreground)]">{opt.label}</span>
              </div>
              <p className="mt-0.5 pl-6 text-[11px] text-[var(--muted)]">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <SectionLabel>Bildplatzierung</SectionLabel>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {PLACEMENT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update({ mediaPlacement: opt.value })}
              className={`rounded-lg border px-2.5 py-2 text-left text-xs transition ${
                mediaPlacement === opt.value
                  ? "border-[var(--brand-primary,#f97316)] bg-orange-50 font-medium"
                  : "border-[var(--border)] hover:border-[var(--brand-primary,#f97316)]"
              }`}
            >
              <p className="font-medium text-[var(--foreground)]">{opt.label}</p>
              <p className="mt-0.5 text-[11px] text-[var(--muted)]">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <SectionLabel>Kartenfarben-Referenz</SectionLabel>
        <div className="mt-2 flex flex-wrap gap-2">
          {CARD_VARIANTS.map((v) => (
            <div key={v.value} className="flex items-center gap-1.5 text-xs text-[var(--text-2)]">
              <span className={`h-2.5 w-2.5 rounded-full ${v.color}`} />
              {v.label}
            </div>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-[var(--muted)]">
          Kartenvarianten werden pro Karte im Content-Bereich gesetzt.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export default function SplitContentCardsInspectorContent({
  config,
  onChange,
  mode = "content",
}: SplitContentCardsInspectorContentProps) {
  const cfg = getCfg(config);

  if (mode === "style") {
    return <StyleMode cfg={cfg} config={config} onChange={onChange} />;
  }

  return <ContentMode cfg={cfg} config={config} onChange={onChange} />;
}
