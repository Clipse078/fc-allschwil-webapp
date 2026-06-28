/**
 * lib/cms/layout-types.ts
 *
 * Flexible Layout System — shared layout types for every CMS block.
 *
 * This is the single source of truth for layout configuration across all
 * block types. Every block stores its layout settings inside a `_layout`
 * field in its config JSON column, using the SectionLayout type defined here.
 *
 * The SectionShell renderer (components/website/SectionShell.tsx) consumes
 * SectionLayout to produce a consistent outer wrapper — no duplicated spacing,
 * background, or theme logic in individual blocks.
 *
 * The LayoutConfigPanel editor (components/admin/cms/LayoutConfigPanel.tsx)
 * provides a consistent editing UI for all layout properties.
 *
 * Backward compatibility:
 *   splitContentCards previously stored layout under `style` and `background`
 *   keys in its config. Both the renderer and config form fall back to those
 *   legacy fields when `_layout` is absent, ensuring existing data works.
 *
 * Architecture:
 *   One layout engine. Many content blocks. No duplicated layout logic.
 */

// ---------------------------------------------------------------------------
// Width
// ---------------------------------------------------------------------------

/**
 * Container max-width presets.
 *   narrow   → max-w-4xl  (~896px)
 *   normal   → max-w-6xl  (~1152px)
 *   wide     → max-w-7xl  (~1280px)
 *   full     → max-w-none (unbounded)
 */
export type SectionWidth = "narrow" | "normal" | "wide" | "full";

// ---------------------------------------------------------------------------
// Spacing
// ---------------------------------------------------------------------------

/**
 * Vertical spacing scale used for section padding (top/bottom).
 * Maps to Tailwind pt-N / pb-N utilities via SPACING_MAP in SectionShell.
 */
export type SectionSpacing = "none" | "sm" | "md" | "lg" | "xl";

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

/**
 * Colour scheme / theme inheritance.
 *   light  → white background, dark text
 *   soft   → light-gray background, dark text
 *   dark   → dark background, white text
 *   club   → tenant primary colour, white text
 */
export type SectionTheme = "light" | "soft" | "dark" | "club";

// ---------------------------------------------------------------------------
// Alignment
// ---------------------------------------------------------------------------

/** Horizontal content alignment within the section container. */
export type SectionHAlign = "left" | "center" | "right";

/** Vertical alignment for multi-column layouts. */
export type SectionVAlign = "top" | "center" | "bottom" | "stretch";

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

/**
 * Column grid presets for multi-column layouts.
 * Width ratios are expressed as left/right percentages.
 * Future: "3-equal" | "4-equal" when three/four-column renderers land.
 */
export type SectionColumns =
  | "single"
  | "50/50"
  | "33/66"
  | "66/33"
  | "25/75"
  | "75/25";

// ---------------------------------------------------------------------------
// Background
// ---------------------------------------------------------------------------

/**
 * Background layer configuration.
 *   none     → transparent / inherits parent background
 *   solid    → flat colour via inline style
 *   gradient → preset gradient name resolved by the renderer
 *   image    → DAM asset with optional colour overlay
 */
export type SectionBackground =
  | { type: "none" }
  | { type: "solid"; color: string }
  | { type: "gradient"; gradientPreset: string }
  | {
      type: "image";
      mediaAssetId: string;
      overlay: "none" | "light" | "dark";
      /** Overlay opacity 0–100. Default: 50 for dark, 40 for light. */
      overlayOpacity?: number;
    };

// ---------------------------------------------------------------------------
// Responsive behaviour
// ---------------------------------------------------------------------------

/**
 * Rules that control how the section adapts to smaller viewports.
 * Applied by SectionShell and block-specific renderers.
 */
export type SectionResponsive = {
  /** Stack columns vertically on mobile (default: true). */
  stackOnMobile?: boolean;
  /** Reverse column order when stacked on mobile. */
  reverseStackOnMobile?: boolean;
  /** Hide the image/media column on mobile. */
  hideImageOnMobile?: boolean;
  /** Force columns to equal height regardless of content. */
  equalHeights?: boolean;
};

// ---------------------------------------------------------------------------
// Canonical shared layout model
// ---------------------------------------------------------------------------

/**
 * SectionLayout — the single shared layout model for every CMS block.
 *
 * Stored as `_layout` inside each block's JSON config column.
 * Consumed by:
 *   - SectionShell (components/website/SectionShell.tsx)  — render path
 *   - LayoutConfigPanel (components/admin/cms/LayoutConfigPanel.tsx) — edit path
 *
 * All fields are optional with safe defaults applied by SectionShell.
 */
export type SectionLayout = {
  /** Container max-width. Default: "normal". */
  width?: SectionWidth;
  /** Vertical padding above the section. Default: "md". */
  spacingTop?: SectionSpacing;
  /** Vertical padding below the section. Default: "md". */
  spacingBottom?: SectionSpacing;
  /** Horizontal padding inside the container. Default: "md". */
  paddingX?: SectionSpacing;
  /** Colour scheme. Default: "light". */
  theme?: SectionTheme;
  /** Horizontal text/content alignment. Default: "left". */
  hAlign?: SectionHAlign;
  /** Vertical content alignment (multi-column). Default: "top". */
  vAlign?: SectionVAlign;
  /** Column grid preset (multi-column blocks). Default: "50/50". */
  columns?: SectionColumns;
  /** Background layer. Default: { type: "none" }. */
  background?: SectionBackground;
  /** Responsive behaviour overrides. */
  responsive?: SectionResponsive;
};

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/** Default SectionLayout applied when a block has no `_layout` key. */
export const DEFAULT_SECTION_LAYOUT: SectionLayout = {
  width: "normal",
  spacingTop: "md",
  spacingBottom: "md",
  paddingX: "md",
  theme: "light",
  hAlign: "left",
  vAlign: "top",
  columns: "50/50",
  background: { type: "none" },
  responsive: {
    stackOnMobile: true,
    reverseStackOnMobile: false,
    hideImageOnMobile: false,
    equalHeights: false,
  },
};

// ---------------------------------------------------------------------------
// Gradient presets (shared across renderer and editor)
// ---------------------------------------------------------------------------

/** Named gradient presets available in the background picker. */
export const GRADIENT_PRESETS: {
  value: string;
  label: string;
  style: string;
}[] = [
  {
    value: "club-warm",
    label: "Club Warm (Orange → Rot)",
    style: "linear-gradient(135deg, #f97316 0%, #dc2626 100%)",
  },
  {
    value: "club-cool",
    label: "Club Cool (Blau → Violett)",
    style: "linear-gradient(135deg, #3b82f6 0%, #7c3aed 100%)",
  },
  {
    value: "dark-slate",
    label: "Dark Slate (Dunkel)",
    style: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
  },
  {
    value: "soft-sand",
    label: "Soft Sand (Hell)",
    style: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
  },
  {
    value: "evening-sky",
    label: "Evening Sky (Blau → Dunkel)",
    style: "linear-gradient(135deg, #3b82f6 0%, #1e293b 100%)",
  },
];

// ---------------------------------------------------------------------------
// Theme tokens (renderer-facing)
// ---------------------------------------------------------------------------

export type ThemeTokens = {
  bg: string;
  text: string;
  subtext: string;
  eyebrow: string;
};

export const THEME_TOKENS: Record<SectionTheme, ThemeTokens> = {
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

// ---------------------------------------------------------------------------
// Spacing maps (renderer-facing)
// ---------------------------------------------------------------------------

export const SPACING_TOP_MAP: Record<SectionSpacing, string> = {
  none: "pt-0",
  sm: "pt-8",
  md: "pt-14",
  lg: "pt-20",
  xl: "pt-28",
};

export const SPACING_BOTTOM_MAP: Record<SectionSpacing, string> = {
  none: "pb-0",
  sm: "pb-8",
  md: "pb-14",
  lg: "pb-20",
  xl: "pb-28",
};

export const WIDTH_MAP: Record<SectionWidth, string> = {
  narrow: "max-w-4xl",
  normal: "max-w-6xl",
  wide: "max-w-7xl",
  full: "max-w-none",
};

export const PADDING_X_MAP: Record<SectionSpacing, string> = {
  none: "px-0",
  sm: "px-4",
  md: "px-4 sm:px-6 lg:px-8",
  lg: "px-6 sm:px-8 lg:px-12",
  xl: "px-8 sm:px-12 lg:px-16",
};

// ---------------------------------------------------------------------------
// Resolved layout (always fully-populated)
// ---------------------------------------------------------------------------

/** Merges a (possibly partial) SectionLayout with DEFAULT_SECTION_LAYOUT. */
export function resolveLayout(partial?: SectionLayout): Required<SectionLayout> {
  return {
    width: partial?.width ?? DEFAULT_SECTION_LAYOUT.width!,
    spacingTop: partial?.spacingTop ?? DEFAULT_SECTION_LAYOUT.spacingTop!,
    spacingBottom: partial?.spacingBottom ?? DEFAULT_SECTION_LAYOUT.spacingBottom!,
    paddingX: partial?.paddingX ?? DEFAULT_SECTION_LAYOUT.paddingX!,
    theme: partial?.theme ?? DEFAULT_SECTION_LAYOUT.theme!,
    hAlign: partial?.hAlign ?? DEFAULT_SECTION_LAYOUT.hAlign!,
    vAlign: partial?.vAlign ?? DEFAULT_SECTION_LAYOUT.vAlign!,
    columns: partial?.columns ?? DEFAULT_SECTION_LAYOUT.columns!,
    background: partial?.background ?? DEFAULT_SECTION_LAYOUT.background!,
    responsive: {
      ...DEFAULT_SECTION_LAYOUT.responsive,
      ...partial?.responsive,
    },
  };
}
