"use client";

/**
 * components/admin/page-builder/SplitContentCardsEditableCanvas.tsx
 *
 * Admin-only WYSIWYG canvas for the splitContentCards block.
 *
 * This component is intentionally separate from the public SplitContentCardsRenderer.
 * It must NEVER be imported from public-website code.
 *
 * Features:
 *   - Inline editing: eyebrow, headline, card title, card body
 *   - Card hover toolbar: move up, move down, duplicate, delete
 *   - Image replacement via SharedMediaPicker (DAM)
 *   - All edits call onConfigChange → Inspector reflects change → autosave triggers
 *   - Escape cancels inline edit and reverts value
 *   - Keyboard accessible: Tab, Enter, Escape
 *
 * Architecture:
 *   One config object is the single source of truth.
 *   Canvas edits call onConfigChange(updated) which flows back to ConfigEditor
 *   premiumConfig state → autosave → API → DB.
 *   No second config store, no duplicate save logic.
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  ChevronUp,
  ChevronDown,
  Trash2,
  Copy,
  Image as ImageIcon,
  RefreshCw,
} from "lucide-react";
import type {
  SplitContentCardsSectionConfig,
  SplitContentCard,
  SplitContentImageRef,
} from "@/lib/homepage/section-types";
import type { SectionLayout } from "@/lib/cms/layout-types";
import { THEME_TOKENS, resolveLayout } from "@/lib/cms/layout-types";
import type { RichTextValue } from "@/lib/cms/rich-text";
import { richTextToHtml, isRichTextValue } from "@/lib/cms/rich-text";
import type { MediaAssetListItem } from "@/lib/media/types";
import SectionShell from "@/components/website/SectionShell";
import InlineEditableText from "@/components/admin/cms/InlineEditableText";
import SharedMediaPicker from "@/components/admin/media/SharedMediaPicker";

// ---------------------------------------------------------------------------
// Layout resolver (mirrors SplitContentCardsRenderer)
// ---------------------------------------------------------------------------

function resolveBlockLayout(cfg: SplitContentCardsSectionConfig): SectionLayout {
  if (cfg._layout) return cfg._layout;
  const style = cfg.style;
  const background = cfg.background;
  return {
    width: style?.width ?? "normal",
    spacingTop: style?.spacingTop ?? "md",
    spacingBottom: style?.spacingBottom ?? "md",
    theme: style?.theme ?? "light",
    hAlign: style?.alignment === "center" ? "center" : "left",
    background: (background ?? { type: "none" }) as SectionLayout["background"],
  };
}

// ---------------------------------------------------------------------------
// Card variant classes (mirrors SplitContentCardsRenderer)
// ---------------------------------------------------------------------------

const CARD_VARIANT_CLASS: Record<
  string,
  { border: string; bg: string; titleColor: string }
> = {
  orange: { border: "border-l-orange-500", bg: "bg-orange-50", titleColor: "text-orange-700" },
  blue: { border: "border-l-blue-600", bg: "bg-blue-50", titleColor: "text-blue-700" },
  red: { border: "border-l-red-600", bg: "bg-red-50", titleColor: "text-red-700" },
  neutral: { border: "border-l-gray-400", bg: "bg-gray-50", titleColor: "text-gray-700" },
};

// ---------------------------------------------------------------------------
// Unique ID helper for duplicated cards
// ---------------------------------------------------------------------------

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ---------------------------------------------------------------------------
// Rich text display (mirrors SplitContentCardsRenderer)
// ---------------------------------------------------------------------------

function RichTextDisplay({
  value,
  className = "",
}: {
  value: RichTextValue | null | undefined;
  className?: string;
}) {
  if (!isRichTextValue(value)) return null;
  const html = richTextToHtml(value);
  if (!html) return null;
  return (
    <div
      className={`prose prose-sm max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// ---------------------------------------------------------------------------
// useMediaUrl — fetches the direct URL for a mediaAssetId
// ---------------------------------------------------------------------------

function useMediaUrl(mediaAssetId: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!mediaAssetId) return;
    let cancelled = false;
    fetch(`/api/media/${mediaAssetId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d?.asset?.url) setUrl(d.asset.url as string);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [mediaAssetId]);

  // Return null synchronously when no assetId is supplied so callers
  // do not need to handle stale URL values from a previous assetId.
  return mediaAssetId ? url : null;
}

// ---------------------------------------------------------------------------
// EditableImage — single image with replace button
// ---------------------------------------------------------------------------

function EditableImage({
  imageRef,
  onReplace,
  onRemove,
  label,
}: {
  imageRef: SplitContentImageRef;
  onReplace: (asset: MediaAssetListItem) => void;
  onRemove: () => void;
  label: string;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const url = useMediaUrl(imageRef.mediaAssetId);

  return (
    <div className="group relative overflow-hidden rounded-lg">
      {url ? (
        <img
          src={url}
          alt={imageRef.alt ?? label}
          className="w-full rounded-lg object-cover"
          style={{ maxHeight: 280 }}
        />
      ) : (
        <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50">
          <RefreshCw className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      )}

      {/* Hover overlay */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg bg-black/0 transition-colors group-hover:pointer-events-auto group-hover:bg-black/30">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-gray-800 shadow-sm opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white"
          aria-label="Bild ersetzen"
        >
          Bild ersetzen
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-lg bg-rose-500/90 px-3 py-1.5 text-xs font-semibold text-white shadow-sm opacity-0 transition-opacity group-hover:opacity-100 hover:bg-rose-600"
          aria-label="Bild entfernen"
        >
          Entfernen
        </button>
      </div>

      <SharedMediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(asset) => {
          onReplace(asset);
          setPickerOpen(false);
        }}
        filterType="IMAGE"
        title="Bild ersetzen"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// EditableCard — single card with inline title/body + hover toolbar
// ---------------------------------------------------------------------------

function EditableCard({
  card,
  index,
  total,
  darkMode,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  onDuplicate,
}: {
  card: SplitContentCard;
  index: number;
  total: number;
  darkMode: boolean;
  onUpdate: (updated: SplitContentCard) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
}) {
  const variant = CARD_VARIANT_CLASS[card.variant] ?? CARD_VARIANT_CLASS.neutral;

  return (
    <div
      className={`group relative rounded-lg border-l-4 p-4 shadow-sm transition ${variant.border} ${
        darkMode ? "bg-white/10" : variant.bg
      }`}
    >
      {/* Card hover toolbar */}
      <div
        className="absolute -right-1 -top-1 z-20 hidden flex-col gap-0.5 rounded-lg border border-[var(--border)] bg-white p-0.5 shadow-md group-hover:flex"
        role="toolbar"
        aria-label={`Karte ${index + 1} Aktionen`}
      >
        <button
          type="button"
          onClick={onMoveUp}
          disabled={index === 0}
          className="rounded p-1 text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] disabled:opacity-30"
          title="Nach oben"
          aria-label="Karte nach oben"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={index === total - 1}
          className="rounded p-1 text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] disabled:opacity-30"
          title="Nach unten"
          aria-label="Karte nach unten"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onDuplicate}
          className="rounded p-1 text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
          title="Duplizieren"
          aria-label="Karte duplizieren"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-1 text-rose-400 hover:bg-rose-50 hover:text-rose-600"
          title="Entfernen"
          aria-label="Karte entfernen"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Editable title */}
      <InlineEditableText
        value={card.title}
        onChange={(newTitle) => onUpdate({ ...card, title: newTitle })}
        placeholder="Kartentitel…"
        as="h4"
        className={`mb-1 text-sm font-semibold ${
          darkMode ? "text-white" : variant.titleColor
        }`}
        inputClassName={`mb-1 text-sm font-semibold w-full rounded border border-blue-400 bg-white/90 px-1 py-0.5 outline-none ring-2 ring-blue-500 ${
          darkMode ? "text-gray-800" : variant.titleColor
        }`}
        ariaLabel="Kartentitel"
      />

      {/* Editable body */}
      <InlineEditableText
        value={card.body}
        onChange={(newBody) => onUpdate({ ...card, body: newBody })}
        placeholder="Kartentext…"
        multiline
        as="p"
        className={`text-sm leading-relaxed ${darkMode ? "text-gray-200" : "text-gray-600"}`}
        inputClassName={`text-sm leading-relaxed w-full rounded border border-blue-400 bg-white/90 px-1 py-0.5 outline-none ring-2 ring-blue-500 ${
          darkMode ? "text-gray-800" : "text-gray-600"
        } resize-none`}
        ariaLabel="Kartentext"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// AddImagePlaceholder
// ---------------------------------------------------------------------------

function AddImagePlaceholder({ onAdd }: { onAdd: (asset: MediaAssetListItem) => void }) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 py-8 text-sm text-gray-400 transition hover:border-blue-400 hover:text-blue-500"
        aria-label="Bild aus Mediathek hinzufügen"
      >
        <ImageIcon className="h-5 w-5" />
        Bild hinzufügen
      </button>
      <SharedMediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(asset) => {
          onAdd(asset);
          setPickerOpen(false);
        }}
        filterType="IMAGE"
        title="Bild aus Mediathek auswählen"
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type SplitContentCardsEditableCanvasProps = {
  config: Record<string, unknown>;
  onConfigChange: (updated: Record<string, unknown>) => void;
};

// ---------------------------------------------------------------------------
// SplitContentCardsEditableCanvas
// ---------------------------------------------------------------------------

export default function SplitContentCardsEditableCanvas({
  config: rawConfig,
  onConfigChange,
}: SplitContentCardsEditableCanvasProps) {
  const cfg = rawConfig as SplitContentCardsSectionConfig;

  const blockLayout = resolveBlockLayout(cfg);
  const resolved = resolveLayout(blockLayout);
  const themeTokens = THEME_TOKENS[resolved.theme];
  const isDarkMode = resolved.theme === "dark" || resolved.theme === "club";
  const columnLayout = cfg.layout ?? "TEXT_LEFT_CARDS_RIGHT";
  const isCardsLeft = columnLayout === "CARDS_LEFT_TEXT_RIGHT";
  const alignment = resolved.hAlign ?? "left";

  const cards = useMemo(() => cfg.cards ?? [], [cfg.cards]);
  const images = useMemo(() => cfg.images ?? [], [cfg.images]);

  // ---------------------------------------------------------------------------
  // Config update helpers
  // ---------------------------------------------------------------------------

  const update = useCallback(
    (patch: Partial<SplitContentCardsSectionConfig>) => {
      onConfigChange({ ...rawConfig, ...patch });
    },
    [rawConfig, onConfigChange],
  );

  // ---------------------------------------------------------------------------
  // Card operations
  // ---------------------------------------------------------------------------

  const updateCard = useCallback(
    (index: number, updated: SplitContentCard) => {
      const next = [...cards];
      next[index] = updated;
      update({ cards: next });
    },
    [cards, update],
  );

  const removeCard = useCallback(
    (index: number) => {
      update({ cards: cards.filter((_, i) => i !== index) });
    },
    [cards, update],
  );

  const moveCard = useCallback(
    (index: number, direction: "up" | "down") => {
      const next = [...cards];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= next.length) return;
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      update({ cards: next });
    },
    [cards, update],
  );

  const duplicateCard = useCallback(
    (index: number) => {
      const source = cards[index];
      if (!source) return;
      const duplicate: SplitContentCard = { ...source, id: generateId() };
      const next = [...cards];
      next.splice(index + 1, 0, duplicate);
      update({ cards: next });
    },
    [cards, update],
  );

  // ---------------------------------------------------------------------------
  // Image operations
  // ---------------------------------------------------------------------------

  const replaceImage = useCallback(
    (index: number, asset: MediaAssetListItem) => {
      const next = [...images];
      next[index] = {
        ...(next[index] ?? {}),
        mediaAssetId: asset.id,
        alt: asset.altText ?? "",
      };
      update({ images: next });
    },
    [images, update],
  );

  const removeImage = useCallback(
    (index: number) => {
      update({ images: images.filter((_, i) => i !== index) });
    },
    [images, update],
  );

  const addImage = useCallback(
    (asset: MediaAssetListItem) => {
      update({
        images: [
          ...images,
          { mediaAssetId: asset.id, alt: asset.altText ?? "", caption: "" },
        ],
      });
    },
    [images, update],
  );

  // ---------------------------------------------------------------------------
  // Text column
  // ---------------------------------------------------------------------------

  const textColumn = (
    <div
      className={`flex flex-col justify-center gap-1 ${
        alignment === "center" ? "items-center text-center" : ""
      }`}
    >
      {/* Editable eyebrow */}
      <InlineEditableText
        value={cfg.eyebrow ?? ""}
        onChange={(val) => update({ eyebrow: val })}
        placeholder="Eyebrow (z. B. Über uns)"
        as="p"
        className={`mb-2 text-xs font-semibold uppercase tracking-widest ${themeTokens.eyebrow}`}
        inputClassName="mb-2 text-xs font-semibold uppercase tracking-widest w-full rounded border border-blue-400 bg-white/90 px-1 py-0.5 outline-none ring-2 ring-blue-500"
        ariaLabel="Eyebrow"
      />

      {/* Editable headline */}
      <InlineEditableText
        value={cfg.headline ?? ""}
        onChange={(val) => update({ headline: val })}
        placeholder="Überschrift…"
        as="h2"
        className={`mb-4 text-2xl font-bold leading-tight sm:text-3xl ${themeTokens.text}`}
        inputClassName={`mb-4 text-2xl font-bold leading-tight sm:text-3xl w-full rounded border border-blue-400 bg-white/90 px-2 py-1 outline-none ring-2 ring-blue-500 ${themeTokens.text}`}
        ariaLabel="Überschrift"
      />

      {/* Rich text (read-only in canvas; edit in Inspector) */}
      {isRichTextValue(cfg.bodyRichText) && (
        <div className="rounded border border-dashed border-gray-200 px-2 py-1">
          <RichTextDisplay
            value={cfg.bodyRichText as RichTextValue}
            className={
              isDarkMode
                ? "[&_*]:text-gray-200 [&_a]:text-orange-300"
                : "[&_p]:text-gray-600"
            }
          />
          <p className="mt-1 text-[10px] text-gray-400 italic">
            Fliesstext → im Inspektor bearbeiten
          </p>
        </div>
      )}

      {/* No-content placeholder */}
      {!cfg.eyebrow && !cfg.headline && !cfg.bodyRichText && (
        <div className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-400">
          Klicken, um Eyebrow oder Überschrift zu bearbeiten
        </div>
      )}

      {/* Images placed WITH_TEXT */}
      {(cfg.mediaPlacement === "WITH_TEXT" || cfg.mediaPlacement === "OPPOSITE_TEXT") &&
        images.map((img, i) => (
          <EditableImage
            key={img.mediaAssetId || i}
            imageRef={img}
            onReplace={(asset) => replaceImage(i, asset)}
            onRemove={() => removeImage(i)}
            label={`Bild ${i + 1}`}
          />
        ))}
      {(cfg.mediaPlacement === "WITH_TEXT" || cfg.mediaPlacement === "OPPOSITE_TEXT") &&
        images.length === 0 && (
          <AddImagePlaceholder onAdd={addImage} />
        )}
    </div>
  );

  // ---------------------------------------------------------------------------
  // Cards column
  // ---------------------------------------------------------------------------

  const cardsColumn = (
    <div className="flex flex-col gap-3">
      {cards.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-400">
          Noch keine Karten — im Inspektor hinzufügen
        </div>
      ) : (
        cards.map((card, idx) => (
          <EditableCard
            key={card.id}
            card={card}
            index={idx}
            total={cards.length}
            darkMode={isDarkMode}
            onUpdate={(updated) => updateCard(idx, updated)}
            onRemove={() => removeCard(idx)}
            onMoveUp={() => moveCard(idx, "up")}
            onMoveDown={() => moveCard(idx, "down")}
            onDuplicate={() => duplicateCard(idx)}
          />
        ))
      )}

      {/* Images placed WITH_CARDS */}
      {cfg.mediaPlacement === "WITH_CARDS" &&
        images.map((img, i) => (
          <EditableImage
            key={img.mediaAssetId || i}
            imageRef={img}
            onReplace={(asset) => replaceImage(i, asset)}
            onRemove={() => removeImage(i)}
            label={`Bild ${i + 1}`}
          />
        ))}
      {cfg.mediaPlacement === "WITH_CARDS" && images.length === 0 && (
        <AddImagePlaceholder onAdd={addImage} />
      )}
    </div>
  );

  // ---------------------------------------------------------------------------
  // Grid
  // ---------------------------------------------------------------------------

  const stackClass =
    resolved.responsive?.reverseStackOnMobile
      ? "grid grid-cols-1 gap-10 md:grid-cols-2 flex-col-reverse"
      : "grid grid-cols-1 gap-10 md:grid-cols-2";

  return (
    <SectionShell layout={blockLayout} blockType="splitContentCards">
      {/* Canvas edit hint banner */}
      <div className="mb-4 flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] text-blue-700">
        <span className="font-semibold">Canvas-Modus:</span>
        Klicken zum Bearbeiten · Hover über Karten für Aktionen · Rich Text im Inspektor
      </div>

      <div className={stackClass}>
        {isCardsLeft ? (
          <>
            {cardsColumn}
            {textColumn}
          </>
        ) : (
          <>
            {textColumn}
            {cardsColumn}
          </>
        )}
      </div>
    </SectionShell>
  );
}
