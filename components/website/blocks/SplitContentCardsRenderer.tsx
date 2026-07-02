"use client";

/**
 * components/website/blocks/SplitContentCardsRenderer.tsx
 *
 * Shared visual renderer for the splitContentCards block.
 *
 * Used by:
 *   1. Admin live preview inside PageBuilderClient (accurate real-time feedback)
 *   2. Public website — import and render using the same config shape
 *      received from /api/public/[tenant]/website/homepage or /pages/[slug]/layout
 *
 * The renderer is intentionally self-contained so that the public website can
 * import it directly (or copy it). It must never depend on admin-only modules.
 *
 * DESIGN SYSTEM
 *   All visual styling (typography, cards, shadows, radius) is resolved through
 *   the Design System via resolveDesignSystem(). No hardcoded Tailwind class
 *   strings exist for typography sizes, card styles, shadows or radius.
 *   Layout (spacing, theme, background, width) is delegated to SectionShell.
 *
 * CARD ACCENT COLOURS
 *   Card accent colours (orange / blue / red / neutral) are block-specific
 *   config values that control the left border colour and tint — they are not
 *   Design System card style tokens. They coexist with ds.cards.* tokens:
 *   ds.cards.* controls the card shell; CARD_ACCENT_CLASS controls the tint.
 *
 * Backward compatibility:
 *   When config has no `_layout` key (pre-migration data), SectionShell falls
 *   back to reading `style` and `background` via the legacyLayout helper.
 *
 * Props:
 *   config      — SplitContentCardsSectionConfig (the DB JSON column, parsed)
 *   previewMode — when true adds an admin border/label overlay (via SectionShell)
 */

import type {
  SplitContentCardsSectionConfig,
  SplitContentCard,
} from "@/lib/homepage/section-types";
import type { SectionLayout } from "@/lib/cms/layout-types";
import { THEME_TOKENS, resolveLayout } from "@/lib/cms/layout-types";
import type { RichTextValue } from "@/lib/cms/rich-text";
import { richTextToHtml, isRichTextValue } from "@/lib/cms/rich-text";
import SectionShell from "@/components/website/SectionShell";
import { resolveDesignSystem } from "@/lib/cms/token-resolver";

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
// Card accent colour classes (block-specific variant, not Design System card style)
// These control the left-border accent and background tint per card colour value.
// Design System card shell styles are applied via ds.cards.default.container.
// ---------------------------------------------------------------------------

const CARD_ACCENT_CLASS: Record<string, { border: string; bg: string; titleColor: string }> = {
  orange: { border: "border-l-orange-500", bg: "bg-orange-50", titleColor: "text-orange-700" },
  blue: { border: "border-l-blue-600", bg: "bg-blue-50", titleColor: "text-blue-700" },
  red: { border: "border-l-red-600", bg: "bg-red-50", titleColor: "text-red-700" },
  neutral: { border: "border-l-gray-400", bg: "bg-gray-50", titleColor: "text-gray-700" },
};

// ---------------------------------------------------------------------------
// Stacked card component
// ---------------------------------------------------------------------------

function ContentCard({ card, darkMode }: { card: SplitContentCard; darkMode?: boolean }) {
  const ds = resolveDesignSystem();
  const accent = CARD_ACCENT_CLASS[card.variant] ?? CARD_ACCENT_CLASS.neutral;
  return (
    <div
      className={`${ds.radius.medium} border-l-4 ${ds.shadows.small} p-4 ${accent.border} ${
        darkMode ? "bg-white/10" : accent.bg
      }`}
    >
      {card.title && (
        <h4 className={`mb-1 ${ds.typography.small} font-semibold ${darkMode ? "text-white" : accent.titleColor}`}>
          {card.title}
        </h4>
      )}
      {card.body && (
        <p className={`${ds.typography.small} ${darkMode ? "text-gray-200" : "text-gray-600"}`}>
          {card.body}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rich text renderer (inline, safe HTML)
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
// Inline edit import (admin canvas only)
// ---------------------------------------------------------------------------

import { CanvasInlineTextField } from "@/components/admin/homepage-builder/CanvasInlineTextField";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type SplitContentCardsRendererProps = {
  config: Record<string, unknown>;
  previewMode?: boolean;
  /** Resolved background image URL for canvas preview (admin only). */
  backgroundImageUrl?: string;
  /**
   * Admin canvas only. When provided, section headline becomes inline-editable.
   * Card-level inline editing is not supported in Slice K (see report gap 12).
   * The public website never passes this prop.
   */
  onFieldChange?: (field: string, value: string) => void;
  /** Admin canvas only: overrides CSS background-position for focal-point preview. */
  backgroundPositionOverride?: string;
  /** Admin canvas only: overrides the CSS background-size for zoom slider preview. */
  backgroundSizeOverride?: string;
};

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

export default function SplitContentCardsRenderer({
  config: rawConfig,
  previewMode = false,
  backgroundImageUrl,
  onFieldChange,
  backgroundPositionOverride,
  backgroundSizeOverride,
}: SplitContentCardsRendererProps) {
  const cfg = rawConfig as SplitContentCardsSectionConfig;
  const ds = resolveDesignSystem();

  const blockLayout = resolveBlockLayout(cfg);
  const resolved = resolveLayout(blockLayout);

  const themeTokens = THEME_TOKENS[resolved.theme];
  const isDarkMode = resolved.theme === "dark" || resolved.theme === "club";

  const columnLayout = cfg.layout ?? "TEXT_LEFT_CARDS_RIGHT";
  const isCardsLeft = columnLayout === "CARDS_LEFT_TEXT_RIGHT";
  const alignment = resolved.hAlign ?? "left";

  const cards = cfg.cards ?? [];

  const isInlineEdit = !!onFieldChange;

  // Text column — typography resolved from Design System
  const textColumn = (
    <div
      className={`flex flex-col justify-center ${
        alignment === "center" ? "items-center text-center" : ""
      }`}
    >
      {cfg.eyebrow && (
        <p
          className={`mb-2 text-xs font-semibold uppercase tracking-widest ${themeTokens.eyebrow}`}
        >
          {cfg.eyebrow}
        </p>
      )}
      {isInlineEdit ? (
        <CanvasInlineTextField
          value={(cfg.headline as string) ?? ""}
          onChange={(v) => onFieldChange("headline", v)}
          className={`mb-4 ${ds.typography.h2} ${themeTokens.text}`}
          placeholder="Überschrift eingeben…"
        />
      ) : (
        cfg.headline && (
          <h2
            className={`mb-4 ${ds.typography.h2} ${themeTokens.text}`}
          >
            {cfg.headline}
          </h2>
        )
      )}
      {isRichTextValue(cfg.bodyRichText) && (
        <RichTextDisplay
          value={cfg.bodyRichText as RichTextValue}
          className={
            isDarkMode
              ? "[&_*]:text-gray-200 [&_a]:text-orange-300"
              : "[&_p]:text-gray-600"
          }
        />
      )}
      {!cfg.eyebrow && !cfg.headline && !cfg.bodyRichText && !isInlineEdit && (
        <div className={`${ds.radius.medium} border border-dashed border-gray-300 px-4 py-6 text-center ${ds.typography.small} text-gray-400`}>
          Kein Textinhalt konfiguriert
        </div>
      )}
    </div>
  );

  // Cards column — spacing resolved from Design System
  const cardsColumn = (
    <div className={`flex flex-col ${ds.spacing.s}`}>
      {cards.length === 0 ? (
        <div className={`${ds.radius.medium} border border-dashed border-gray-300 px-4 py-6 text-center ${ds.typography.small} text-gray-400`}>
          Noch keine Karten
        </div>
      ) : (
        cards.map((card, index) => (
          <ContentCard key={card.id ?? `card:${index}`} card={card} darkMode={isDarkMode} />
        ))
      )}
    </div>
  );

  // Responsive stacking classes from shared layout
  const stackClass =
    resolved.responsive?.reverseStackOnMobile
      ? "grid grid-cols-1 gap-10 md:grid-cols-2 flex-col-reverse"
      : "grid grid-cols-1 gap-10 md:grid-cols-2";

  return (
    <SectionShell
      layout={blockLayout}
      previewMode={previewMode}
      blockType="splitContentCards"
      backgroundImageUrl={backgroundImageUrl}
      backgroundPositionOverride={backgroundPositionOverride}
      backgroundSizeOverride={backgroundSizeOverride}
    >
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
