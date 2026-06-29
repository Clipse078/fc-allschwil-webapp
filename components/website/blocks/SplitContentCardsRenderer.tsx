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
 * Layout (spacing, theme, background, width) is delegated to SectionShell —
 * this renderer focuses exclusively on the two-column content grid:
 *   - Text column (eyebrow, headline, rich text)
 *   - Cards column (stacked content cards)
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
// Card variant classes
// ---------------------------------------------------------------------------

const CARD_VARIANT_CLASS: Record<string, { border: string; bg: string; titleColor: string }> = {
  orange: { border: "border-l-orange-500", bg: "bg-orange-50", titleColor: "text-orange-700" },
  blue: { border: "border-l-blue-600", bg: "bg-blue-50", titleColor: "text-blue-700" },
  red: { border: "border-l-red-600", bg: "bg-red-50", titleColor: "text-red-700" },
  neutral: { border: "border-l-gray-400", bg: "bg-gray-50", titleColor: "text-gray-700" },
};

// ---------------------------------------------------------------------------
// Stacked card component
// ---------------------------------------------------------------------------

function ContentCard({ card, darkMode }: { card: SplitContentCard; darkMode?: boolean }) {
  const variant = CARD_VARIANT_CLASS[card.variant] ?? CARD_VARIANT_CLASS.neutral;
  return (
    <div
      className={`rounded-lg border-l-4 p-4 shadow-sm ${variant.border} ${
        darkMode ? "bg-white/10" : variant.bg
      }`}
    >
      {card.title && (
        <h4 className={`mb-1 text-sm font-semibold ${darkMode ? "text-white" : variant.titleColor}`}>
          {card.title}
        </h4>
      )}
      {card.body && (
        <p className={`text-sm leading-relaxed ${darkMode ? "text-gray-200" : "text-gray-600"}`}>
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
// Props
// ---------------------------------------------------------------------------

type SplitContentCardsRendererProps = {
  config: Record<string, unknown>;
  previewMode?: boolean;
};

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

export default function SplitContentCardsRenderer({
  config: rawConfig,
  previewMode = false,
}: SplitContentCardsRendererProps) {
  const cfg = rawConfig as SplitContentCardsSectionConfig;

  const blockLayout = resolveBlockLayout(cfg);
  const resolved = resolveLayout(blockLayout);

  const themeTokens = THEME_TOKENS[resolved.theme];
  const isDarkMode = resolved.theme === "dark" || resolved.theme === "club";

  const columnLayout = cfg.layout ?? "TEXT_LEFT_CARDS_RIGHT";
  const isCardsLeft = columnLayout === "CARDS_LEFT_TEXT_RIGHT";
  const alignment = resolved.hAlign ?? "left";

  const cards = cfg.cards ?? [];

  // Text column
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
      {cfg.headline && (
        <h2
          className={`mb-4 text-2xl font-bold leading-tight sm:text-3xl ${themeTokens.text}`}
        >
          {cfg.headline}
        </h2>
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
      {!cfg.eyebrow && !cfg.headline && !cfg.bodyRichText && (
        <div className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-400">
          Kein Textinhalt konfiguriert
        </div>
      )}
    </div>
  );

  // Cards column
  const cardsColumn = (
    <div className="flex flex-col gap-3">
      {cards.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-400">
          Noch keine Karten
        </div>
      ) : (
        cards.map((card) => (
          <ContentCard key={card.id} card={card} darkMode={isDarkMode} />
        ))
      )}
    </div>
  );

  // ---------------------------------------------------------------------------
  // Column ratio → CSS custom property for .scc-grid
  // ---------------------------------------------------------------------------

  /**
   * SectionColumns maps to fractional grid column widths.
   * The CSS variable --scc-cols is consumed by .scc-grid (globals.css).
   * On mobile, .scc-grid always uses a single column regardless of this value.
   *
   * "single" is treated as equal columns since splitContentCards is a
   * two-column block.
   */
  const colsMap: Partial<Record<string, string>> = {
    "33/66": "1fr 2fr",
    "66/33": "2fr 1fr",
    "25/75": "1fr 3fr",
    "75/25": "3fr 1fr",
    "50/50": "1fr 1fr",
    single: "1fr 1fr",
  };
  const gridColsValue = colsMap[resolved.columns] ?? "1fr 1fr";

  return (
    <SectionShell
      layout={blockLayout}
      previewMode={previewMode}
      blockType="splitContentCards"
    >
      <div
        className="scc-grid gap-10"
        style={{ "--scc-cols": gridColsValue } as React.CSSProperties}
      >
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
