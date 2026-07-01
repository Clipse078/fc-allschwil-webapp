"use client";

/**
 * components/admin/page-builder/block-forms/SplitContentCardsConfigForm.tsx
 *
 * Premium property panel for the splitContentCards block.
 *
 * Tabs:
 *   Content  — eyebrow, headline, rich text, cards CRUD + DnD, images (DAM)
 *   Kolumnen — column arrangement (TEXT_LEFT_CARDS_RIGHT / CARDS_LEFT_TEXT_RIGHT),
 *              image placement, responsive column behaviour
 *   Layout   — shared LayoutConfigPanel (width, spacing, theme, alignment,
 *              background) — same UI as every other block type
 *
 * Rules:
 *   - Images are always stored as mediaAssetId (DAM reference), never raw URL.
 *   - Rich text stored as TipTap JSON (RichTextValue).
 *   - Cards are reordered via drag-and-drop using native HTML5 DnD.
 *   - No publishing logic here — handled by PageBuilderClient WorkflowPanel.
 *   - Layout (spacing, theme, background) is now stored in `_layout` via the
 *     shared LayoutConfigPanel. Legacy `style` and `background` keys are
 *     migrated on first render for backward compatibility.
 */

import { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  X,
  MoveHorizontal,
  AlignLeft,
  LayoutPanelLeft,
  Layout,
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
import type { SectionLayout } from "@/lib/cms/layout-types";
import LayoutConfigPanel from "@/components/admin/cms/LayoutConfigPanel";

// Lazy-load rich text editor to avoid SSR hydration issues
const RichTextEditor = dynamic(() => import("@/components/admin/cms/RichTextEditor"), {
  ssr: false,
  loading: () => (
    <div className="h-24 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] animate-pulse" />
  ),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
};

// ---------------------------------------------------------------------------
// Legacy migration: convert old style + background → _layout
// ---------------------------------------------------------------------------

function migrateToLayout(raw: Record<string, unknown>): SectionLayout {
  if (raw._layout) return raw._layout as SectionLayout;

  const style = raw.style as {
    theme?: string;
    spacingTop?: string;
    spacingBottom?: string;
    width?: string;
    alignment?: string;
  } | undefined;

  const bg = raw.background as { type?: string } | undefined;

  return {
    width: (style?.width as SectionLayout["width"]) ?? "normal",
    spacingTop: (style?.spacingTop as SectionLayout["spacingTop"]) ?? "md",
    spacingBottom: (style?.spacingBottom as SectionLayout["spacingBottom"]) ?? "md",
    theme: (style?.theme as SectionLayout["theme"]) ?? "light",
    hAlign: style?.alignment === "center" ? "center" : "left",
    background: (bg ?? { type: "none" }) as SectionLayout["background"],
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getConfig(raw: Record<string, unknown>): SplitContentCardsSectionConfig {
  return raw as SplitContentCardsSectionConfig;
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

const CARD_VARIANTS: { value: SplitContentCardVariant; label: string; color: string }[] = [
  { value: "orange", label: "Orange", color: "bg-orange-500" },
  { value: "blue", label: "Blau", color: "bg-blue-600" },
  { value: "red", label: "Rot", color: "bg-red-600" },
  { value: "neutral", label: "Neutral", color: "bg-gray-500" },
];

// ---------------------------------------------------------------------------
// Field wrapper
// ---------------------------------------------------------------------------

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-[var(--foreground)]">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {hint && <p className="mb-1.5 text-[11px] text-[var(--muted)]">{hint}</p>}
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section heading
// ---------------------------------------------------------------------------

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="pt-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
      {children}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Tab bar
// ---------------------------------------------------------------------------

type Tab = "content" | "columns" | "layout";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "content", label: "Inhalt", icon: <AlignLeft className="h-3.5 w-3.5" /> },
  { id: "columns", label: "Kolumnen", icon: <LayoutPanelLeft className="h-3.5 w-3.5" /> },
  { id: "layout", label: "Layout", icon: <Layout className="h-3.5 w-3.5" /> },
];

// ---------------------------------------------------------------------------
// Card editor item
// ---------------------------------------------------------------------------

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
      className={`rounded-lg border ${
        isDragOver
          ? "border-blue-400 bg-blue-50"
          : "border-[var(--border)] bg-[var(--surface)]"
      } transition-colors`}
    >
      {/* Card header */}
      <div className="flex items-center gap-2 px-2.5 py-2">
        <GripVertical className="h-3.5 w-3.5 flex-shrink-0 cursor-grab text-[var(--muted)] active:cursor-grabbing" />
        <span
          className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${variant.color}`}
          title={variant.label}
        />
        <span className="flex-1 truncate text-xs font-medium text-[var(--foreground)]">
          {card.title || `Karte ${index + 1}`}
        </span>
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="sce-icon-button"
          title={expanded ? "Einklappen" : "Aufklappen"}
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="sce-icon-button text-rose-500 hover:text-rose-700"
          title="Karte entfernen"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Expanded fields */}
      {expanded && (
        <div className="space-y-3 border-t border-[var(--border)] px-3 pb-3 pt-3">
          <Field label="Titel">
            <input
              type="text"
              value={card.title}
              onChange={(e) => onChange({ ...card, title: e.target.value })}
              placeholder="Kartenüberschrift"
              className="fca-input"
            />
          </Field>
          <Field label="Text">
            <textarea
              value={card.body}
              onChange={(e) => onChange({ ...card, body: e.target.value })}
              rows={3}
              placeholder="Kartentext"
              className="fca-input resize-none"
            />
          </Field>
          <Field label="Farbvariante">
            <div className="flex flex-wrap gap-2">
              {CARD_VARIANTS.map((v) => (
                <button
                  key={v.value}
                  type="button"
                  onClick={() => onChange({ ...card, variant: v.value })}
                  className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition ${
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
          </Field>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Image editor item
// ---------------------------------------------------------------------------

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
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-[var(--text-2)] flex-shrink-0" />
          <p className="text-xs font-medium text-[var(--foreground)]">Bild {index + 1}</p>
          <span className="truncate max-w-[120px] text-[10px] font-mono text-[var(--muted)]">
            {image.mediaAssetId}
          </span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="sce-icon-button text-rose-500 hover:text-rose-700"
          title="Bild entfernen"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Alt-Text">
          <input
            type="text"
            value={image.alt ?? ""}
            onChange={(e) => onChange({ ...image, alt: e.target.value })}
            placeholder="Beschreibung des Bildes"
            className="fca-input"
          />
        </Field>
        <Field label="Bildunterschrift">
          <input
            type="text"
            value={image.caption ?? ""}
            onChange={(e) => onChange({ ...image, caption: e.target.value })}
            placeholder="Optional"
            className="fca-input"
          />
        </Field>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Content tab
// ---------------------------------------------------------------------------

function ContentTab({
  cfg,
  update,
}: {
  cfg: SplitContentCardsSectionConfig;
  update: (patch: Partial<SplitContentCardsSectionConfig>) => void;
}) {
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
      {/* Text content */}
      <SectionHeading>Text</SectionHeading>

      <Field label="Eyebrow" hint="Kleine Beschriftung über der Überschrift (z. B. Abteilung, Kategorie)">
        <input
          type="text"
          value={cfg.eyebrow ?? ""}
          onChange={(e) => update({ eyebrow: e.target.value })}
          placeholder="z. B. Über uns · FC Allschwil"
          className="fca-input"
        />
      </Field>

      <Field label="Überschrift">
        <input
          type="text"
          value={cfg.headline ?? ""}
          onChange={(e) => update({ headline: e.target.value })}
          placeholder="Hauptüberschrift des Blocks"
          className="fca-input"
        />
      </Field>

      <Field label="Fliesstext" hint="Unterstützt Fett, Kursiv, Links, Listen und Zitate.">
        <RichTextEditor
          value={(cfg.bodyRichText as RichTextValue | null) ?? null}
          onChange={(val) => update({ bodyRichText: val })}
          placeholder="Beschreibungstext (optional)"
        />
      </Field>

      {/* Cards */}
      <div className="pt-1">
        <div className="flex items-center justify-between mb-2">
          <SectionHeading>Karten ({cards.length})</SectionHeading>
          <button
            type="button"
            onClick={addCard}
            className="flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-[11px] font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)] transition"
          >
            <Plus className="h-3.5 w-3.5" />
            Karte hinzufügen
          </button>
        </div>

        {cards.length === 0 && (
          <div className="rounded-lg border border-dashed border-[var(--border)] py-6 text-center text-xs text-[var(--muted)]">
            Noch keine Karten. Karten hinzufügen, um gestapelte Inhaltsbereiche zu erstellen.
          </div>
        )}

        <div className="space-y-2">
          {cards.map((card, idx) => (
            <CardEditorItem
              key={card.id ?? `card:${idx}`}
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
      <div className="pt-1">
        <div className="flex items-center justify-between mb-2">
          <SectionHeading>Bilder ({images.length})</SectionHeading>
          <button
            type="button"
            onClick={() => setMediaPicker(true)}
            className="flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-[11px] font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)] transition"
          >
            <Plus className="h-3.5 w-3.5" />
            Bild hinzufügen
          </button>
        </div>

        <p className="mb-2 text-[11px] text-[var(--muted)]">
          Bilder werden als DAM-Referenz gespeichert. Platzierung im Kolumnen-Tab konfigurierbar.
        </p>

        {images.length === 0 && (
          <div className="rounded-lg border border-dashed border-[var(--border)] py-6 text-center text-xs text-[var(--muted)]">
            Noch keine Bilder. Aus der Mediathek auswählen.
          </div>
        )}

        <div className="space-y-2">
          {images.map((img, idx) => (
            <ImageEditorItem
              key={`${img.mediaAssetId}:${idx}`}
              image={img}
              index={idx}
              onChange={(updated) => updateImage(idx, updated)}
              onRemove={() => removeImage(idx)}
            />
          ))}
        </div>
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

// ---------------------------------------------------------------------------
// Columns tab (block-specific layout — column arrangement and image placement)
// ---------------------------------------------------------------------------

function ColumnsTab({
  cfg,
  update,
}: {
  cfg: SplitContentCardsSectionConfig;
  update: (patch: Partial<SplitContentCardsSectionConfig>) => void;
}) {
  const layout = cfg.layout ?? "TEXT_LEFT_CARDS_RIGHT";
  const mediaPlacement = cfg.mediaPlacement ?? "NONE";

  const LAYOUT_OPTIONS: { value: SplitContentCardsLayout; label: string; desc: string }[] = [
    {
      value: "TEXT_LEFT_CARDS_RIGHT",
      label: "Text links · Karten rechts",
      desc: "Eyebrow, Headline und Fliesstext auf der linken Seite; gestapelte Karten rechts.",
    },
    {
      value: "CARDS_LEFT_TEXT_RIGHT",
      label: "Karten links · Text rechts",
      desc: "Gestapelte Karten auf der linken Seite; Text rechts.",
    },
  ];

  const PLACEMENT_OPTIONS: { value: SplitContentCardsMediaPlacement; label: string; desc: string }[] = [
    { value: "NONE", label: "Kein Bild", desc: "Reiner Textinhalt ohne Bild." },
    { value: "WITH_TEXT", label: "Bild bei Text", desc: "Bild erscheint unter dem Textbereich." },
    { value: "WITH_CARDS", label: "Bild bei Karten", desc: "Bild erscheint unter den Karten." },
    {
      value: "OPPOSITE_TEXT",
      label: "Bild gegenüber Text",
      desc: "Bild füllt die gegenüberliegende Seite des Textes.",
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <p className="pt-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
          Spaltenanordnung
        </p>
        <div className="mt-2 space-y-2">
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
        <p className="pt-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
          Bildplatzierung
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
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

      {/* Card colour reference */}
      <div>
        <p className="pt-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
          Kartenfarben-Referenz
        </p>
        <p className="mt-1.5 text-[11px] text-[var(--muted)]">
          Kartenvarianten werden pro Karte im Inhalt-Tab gesetzt.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {CARD_VARIANTS.map((v) => (
            <div key={v.value} className="flex items-center gap-1.5 text-xs text-[var(--text-2)]">
              <span className={`h-3 w-3 rounded-full ${v.color}`} />
              {v.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main SplitContentCardsConfigForm
// ---------------------------------------------------------------------------

export default function SplitContentCardsConfigForm({ config, onChange }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("content");

  const cfg = getConfig(config);

  // On first render, migrate legacy style + background → _layout
  useEffect(() => {
    if (!config._layout && (config.style || config.background)) {
      const migratedLayout = migrateToLayout(config);
      onChange({ ...config, _layout: migratedLayout });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update(patch: Partial<SplitContentCardsSectionConfig>) {
    onChange({ ...config, ...patch });
  }

  const currentLayout = migrateToLayout(config);

  return (
    <div className="space-y-0">
      {/* Tab bar */}
      <div className="mb-4 flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-0.5">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs transition ${
              activeTab === tab.id
                ? "bg-white font-semibold text-[var(--foreground)] shadow-sm"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "content" && <ContentTab cfg={cfg} update={update} />}
      {activeTab === "columns" && <ColumnsTab cfg={cfg} update={update} />}
      {activeTab === "layout" && (
        <LayoutConfigPanel
          layout={currentLayout}
          onChange={(layout) => update({ _layout: layout })}
          features={{ responsive: true }}
        />
      )}
    </div>
  );
}
