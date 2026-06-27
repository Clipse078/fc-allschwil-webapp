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
 * Props:
 *   config — SplitContentCardsSectionConfig (the DB JSON column, parsed)
 *   previewMode — when true adds an admin border/label overlay
 */

import type {
  SplitContentCardsSectionConfig,
  SplitContentCard,
  SplitContentBackground,
} from "@/lib/homepage/section-types";
import type { RichTextValue } from "@/lib/cms/rich-text";
import { richTextToHtml, isRichTextValue } from "@/lib/cms/rich-text";

// ---------------------------------------------------------------------------
// Spacing maps
// ---------------------------------------------------------------------------

const SPACING_TOP: Record<string, string> = {
  none: "pt-0",
  sm: "pt-8",
  md: "pt-14",
  lg: "pt-20",
  xl: "pt-28",
};

const SPACING_BOTTOM: Record<string, string> = {
  none: "pb-0",
  sm: "pb-8",
  md: "pb-14",
  lg: "pb-20",
  xl: "pb-28",
};

const WIDTH_CLASS: Record<string, string> = {
  narrow: "max-w-4xl",
  normal: "max-w-6xl",
  wide: "max-w-7xl",
  full: "max-w-none",
};

const THEME_CLASS: Record<string, { bg: string; text: string; subtext: string; eyebrow: string }> = {
  light: {
    bg: "bg-white",
    text: "text-gray-900",
    subtext: "text-gray-600",
    eyebrow: "text-orange-600",
  },
  soft: {
    bg: "bg-gray-50",
    text: "text-gray-900",
    subtext: "text-gray-600",
    eyebrow: "text-orange-600",
  },
  dark: {
    bg: "bg-gray-900",
    text: "text-white",
    subtext: "text-gray-300",
    eyebrow: "text-orange-400",
  },
  club: {
    bg: "bg-orange-500",
    text: "text-white",
    subtext: "text-orange-100",
    eyebrow: "text-orange-100",
  },
};

const CARD_VARIANT_CLASS: Record<string, { border: string; bg: string; titleColor: string }> = {
  orange: { border: "border-l-orange-500", bg: "bg-orange-50", titleColor: "text-orange-700" },
  blue: { border: "border-l-blue-600", bg: "bg-blue-50", titleColor: "text-blue-700" },
  red: { border: "border-l-red-600", bg: "bg-red-50", titleColor: "text-red-700" },
  neutral: { border: "border-l-gray-400", bg: "bg-gray-50", titleColor: "text-gray-700" },
};

// ---------------------------------------------------------------------------
// Background resolver
// ---------------------------------------------------------------------------

function buildBackgroundStyle(bg: SplitContentBackground | undefined): {
  className: string;
  style: React.CSSProperties;
} {
  if (!bg || bg.type === "none") return { className: "", style: {} };

  if (bg.type === "solid") {
    return { className: "", style: { backgroundColor: bg.color ?? "#f3f4f6" } };
  }

  if (bg.type === "gradient") {
    const GRADIENT_MAP: Record<string, string> = {
      "club-warm": "linear-gradient(135deg, #f97316 0%, #dc2626 100%)",
      "club-cool": "linear-gradient(135deg, #3b82f6 0%, #7c3aed 100%)",
      "dark-slate": "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
      "soft-sand": "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
      "evening-sky": "linear-gradient(135deg, #3b82f6 0%, #1e293b 100%)",
    };
    return {
      className: "",
      style: { backgroundImage: GRADIENT_MAP[bg.gradientPreset ?? ""] ?? "" },
    };
  }

  if (bg.type === "image") {
    return {
      className: "relative",
      style: {},
    };
  }

  return { className: "", style: {} };
}

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

  const layout = cfg.layout ?? "TEXT_LEFT_CARDS_RIGHT";
  const style = (cfg.style ?? {}) as import("@/lib/homepage/section-types").SplitContentStyle;
  const background = cfg.background as SplitContentBackground | undefined;

  const theme = style.theme ?? "light";
  const spacingTop = SPACING_TOP[style.spacingTop ?? "md"];
  const spacingBottom = SPACING_BOTTOM[style.spacingBottom ?? "md"];
  const widthClass = WIDTH_CLASS[style.width ?? "normal"];
  const alignment = style.alignment ?? "left";
  const themeStyles = THEME_CLASS[theme] ?? THEME_CLASS.light;

  const cards = cfg.cards ?? [];
  const isCardsLeft = layout === "CARDS_LEFT_TEXT_RIGHT";
  const isDarkMode = theme === "dark" || theme === "club";

  const { className: bgClass, style: bgStyle } = buildBackgroundStyle(background);

  // Compose the section container classes
  const sectionClasses = [
    themeStyles.bg,
    spacingTop,
    spacingBottom,
    bgClass,
    "relative overflow-hidden",
    previewMode ? "ring-2 ring-blue-400 ring-inset" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Text column
  const textColumn = (
    <div className={`flex flex-col justify-center ${alignment === "center" ? "items-center text-center" : ""}`}>
      {cfg.eyebrow && (
        <p className={`mb-2 text-xs font-semibold uppercase tracking-widest ${themeStyles.eyebrow}`}>
          {cfg.eyebrow}
        </p>
      )}
      {cfg.headline && (
        <h2 className={`mb-4 text-2xl font-bold leading-tight sm:text-3xl ${themeStyles.text}`}>
          {cfg.headline}
        </h2>
      )}
      {isRichTextValue(cfg.bodyRichText) && (
        <RichTextDisplay
          value={cfg.bodyRichText as RichTextValue}
          className={isDarkMode ? "[&_*]:text-gray-200 [&_a]:text-orange-300" : "[&_p]:text-gray-600"}
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

  return (
    <section className={sectionClasses} style={bgStyle}>
      {/* Background image overlay */}
      {background?.type === "image" && background.mediaAssetId && (
        <div
          className={`absolute inset-0 ${
            background.overlay === "dark"
              ? "bg-black/50"
              : background.overlay === "light"
              ? "bg-white/40"
              : ""
          }`}
          aria-hidden="true"
        />
      )}

      {/* Preview label */}
      {previewMode && (
        <div className="absolute left-2 top-2 z-10 rounded bg-blue-500 px-2 py-0.5 text-[10px] font-bold text-white">
          splitContentCards
        </div>
      )}

      {/* Content */}
      <div className={`relative mx-auto px-4 sm:px-6 lg:px-8 ${widthClass}`}>
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
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
      </div>
    </section>
  );
}
