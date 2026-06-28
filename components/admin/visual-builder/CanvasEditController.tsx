"use client";

/**
 * components/admin/visual-builder/CanvasEditController.tsx
 *
 * CMS V3 — Visual Canvas Editor for the splitContentCards block.
 *
 * Renders the full splitContentCards visual layout with inline editing
 * affordances for all editable regions:
 *
 *   Text region:
 *     - Eyebrow (InlineEditableText)
 *     - Headline (InlineEditableText)
 *     - Rich text body — property panel only (no unsafe inline rich-text)
 *
 *   Cards region (SmartCardsRegion):
 *     - Add / duplicate / remove / reorder cards
 *     - Inline card title and body editing
 *     - Quick variant selector
 *
 *   Images region (SmartImagesRegion):
 *     - Add / change / remove images via SharedMediaPicker (DAM)
 *     - Stores mediaAssetId references only
 *
 * Buttons region:
 *   - Not yet part of splitContentCards config schema — marked future-ready
 *
 * All edits call onConfigChange with the complete updated config object.
 * The parent (VisualCanvasPanel → PageBuilderClient) debounces and persists
 * via the existing PATCH /api/website-pages/[id]/sections/[sectionId] endpoint.
 *
 * Architecture rule: no direct API calls in this component.
 */

import type {
  SplitContentCardsSectionConfig,
  SplitContentImageRef,
  SplitContentCard,
} from "@/lib/homepage/section-types";
import type { SectionLayout } from "@/lib/cms/layout-types";
import { THEME_TOKENS, resolveLayout } from "@/lib/cms/layout-types";
import SectionShell from "@/components/website/SectionShell";
import InlineEditableText from "@/components/admin/visual-builder/InlineEditableText";
import SmartCardsRegion from "@/components/admin/visual-builder/SmartCardsRegion";
import SmartImagesRegion from "@/components/admin/visual-builder/SmartImagesRegion";

// ---------------------------------------------------------------------------
// Backward-compat: resolve layout from _layout OR legacy style + background
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
// Props
// ---------------------------------------------------------------------------

type CanvasEditControllerProps = {
  /** Current section config (from PageBuilderClient sections state). */
  config: Record<string, unknown>;
  /**
   * Called whenever any inline edit changes the config.
   * The parent debounces and persists via the existing save endpoint.
   */
  onConfigChange: (updated: Record<string, unknown>) => void;
};

// ---------------------------------------------------------------------------
// CanvasEditController
// ---------------------------------------------------------------------------

export default function CanvasEditController({
  config: rawConfig,
  onConfigChange,
}: CanvasEditControllerProps) {
  const cfg = rawConfig as SplitContentCardsSectionConfig;

  const blockLayout = resolveBlockLayout(cfg);
  const resolved = resolveLayout(blockLayout);

  const themeTokens = THEME_TOKENS[resolved.theme];
  const isDarkMode = resolved.theme === "dark" || resolved.theme === "club";

  const columnLayout = cfg.layout ?? "TEXT_LEFT_CARDS_RIGHT";
  const isCardsLeft = columnLayout === "CARDS_LEFT_TEXT_RIGHT";
  const alignment = resolved.hAlign ?? "left";

  const cards = cfg.cards ?? [];
  const images = cfg.images ?? [];

  // ---------------------------------------------------------------------------
  // Update helpers — always merge into existing config
  // ---------------------------------------------------------------------------

  function update(patch: Partial<SplitContentCardsSectionConfig>) {
    onConfigChange({ ...rawConfig, ...patch });
  }

  function handleCardsChange(updated: SplitContentCard[]) {
    update({ cards: updated });
  }

  function handleImagesChange(updated: SplitContentImageRef[]) {
    update({ images: updated });
  }

  // ---------------------------------------------------------------------------
  // Text column with inline editable eyebrow + headline
  // ---------------------------------------------------------------------------

  const textColumn = (
    <div
      className={`flex flex-col justify-center ${
        alignment === "center" ? "items-center text-center" : ""
      }`}
    >
      {/* Eyebrow */}
      <p className={`mb-2 text-xs font-semibold uppercase tracking-widest ${themeTokens.eyebrow}`}>
        <InlineEditableText
          value={cfg.eyebrow ?? ""}
          onChange={(v) => update({ eyebrow: v })}
          placeholder="Eyebrow bearbeiten"
          className="block"
          maxLength={200}
          ariaLabel="Eyebrow bearbeiten"
        />
      </p>

      {/* Headline */}
      <h2 className={`mb-4 text-2xl font-bold leading-tight sm:text-3xl ${themeTokens.text}`}>
        <InlineEditableText
          value={cfg.headline ?? ""}
          onChange={(v) => update({ headline: v })}
          placeholder="Überschrift bearbeiten"
          className="block"
          maxLength={300}
          ariaLabel="Überschrift bearbeiten"
        />
      </h2>

      {/* Rich text body — read-only on canvas (use property panel for editing) */}
      {cfg.bodyRichText && (
        <div className="rounded border border-dashed border-blue-200 bg-blue-50/40 px-3 py-2 text-[11px] text-blue-600">
          Fliesstext vorhanden — im Eigenschaften-Panel bearbeiten
        </div>
      )}

      {!cfg.eyebrow && !cfg.headline && !cfg.bodyRichText && (
        <div className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-400">
          Klicken zum Hinzufügen von Eyebrow oder Überschrift
        </div>
      )}

      {/* Images region (if placement is WITH_TEXT) */}
      {(cfg.mediaPlacement === "WITH_TEXT" || images.length > 0) && (
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-blue-600">
            Bilder
          </p>
          <SmartImagesRegion
            images={images}
            onImagesChange={handleImagesChange}
          />
        </div>
      )}
    </div>
  );

  // ---------------------------------------------------------------------------
  // Cards column with smart region controls
  // ---------------------------------------------------------------------------

  const cardsColumn = (
    <div className="flex flex-col gap-3">
      {/* Cards region heading */}
      <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-600">
        Karten ({cards.length})
      </p>
      <SmartCardsRegion
        cards={cards}
        onCardsChange={handleCardsChange}
        darkMode={isDarkMode}
      />

      {/* Images region (if placement is WITH_CARDS) */}
      {cfg.mediaPlacement === "WITH_CARDS" && (
        <div className="mt-2">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-blue-600">
            Bilder
          </p>
          <SmartImagesRegion
            images={images}
            onImagesChange={handleImagesChange}
          />
        </div>
      )}
    </div>
  );

  // ---------------------------------------------------------------------------
  // Buttons region — future-ready placeholder
  // ---------------------------------------------------------------------------
  // Note: buttons are not yet part of SplitContentCardsSectionConfig.
  // The region is prepared here for the next evolution of the schema.

  // ---------------------------------------------------------------------------
  // Responsive stacking classes (mirrors SplitContentCardsRenderer)
  // ---------------------------------------------------------------------------

  const stackClass =
    resolved.responsive?.reverseStackOnMobile
      ? "grid grid-cols-1 gap-10 md:grid-cols-2 flex-col-reverse"
      : "grid grid-cols-1 gap-10 md:grid-cols-2";

  return (
    <SectionShell
      layout={blockLayout}
      previewMode
      blockType="splitContentCards"
    >
      {/* Edit mode indicator */}
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] text-blue-700">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
        Direktbearbeitung aktiv — Klicken zum Bearbeiten von Texten, Karten und Bildern
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
