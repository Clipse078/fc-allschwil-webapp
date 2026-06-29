/**
 * lib/cms/design-system.ts
 *
 * Design System — shared visual token library for all CMS renderers.
 *
 * This file is the single source of truth for every visual decision across
 * the SportClubEvo public website renderers. Renderers must never hardcode
 * typography, spacing, colour, shadow, radius, button or card styling.
 * They must resolve all styling through this Design System.
 *
 * TOKEN CATEGORIES
 *   typography  — heading and body text class strings (h1–h3, body, small, quote)
 *   buttons     — button variant class strings (primary, secondary, outline, ghost)
 *   cards       — card style class strings (default, soft, elevated, bordered, sponsor, highlight)
 *   colors      — semantic colour tokens (primary, secondary, accent, success, warning, danger, neutral)
 *   spacing     — spacing scale class strings (xs, s, m, l, xl, xxl)
 *   shadows     — shadow class strings (none, small, medium, large)
 *   radius      — border-radius class strings (small, medium, large, extraLarge)
 *   sectionWidths — max-width class strings (narrow, normal, wide, full)
 *
 * TOKEN RESOLUTION ORDER
 *   1. Local _layout override (section-level)
 *   2. Tenant Design System (future: tenant-scoped overrides)
 *   3. DEFAULT_DESIGN_SYSTEM (this file)
 *   4. Framework fallback (Tailwind utility defaults)
 *
 * USAGE
 *   import { resolveDesignSystem } from "@/lib/cms/token-resolver";
 *   const ds = resolveDesignSystem();
 *   // renderer uses ds.typography.h2, ds.cards.default, ds.buttons.primary, etc.
 *
 * NO DUPLICATION RULES
 *   - Width map values mirror WIDTH_MAP in layout-types.ts (single source).
 *   - Spacing map values mirror SPACING_*_MAP in layout-types.ts (single source).
 *   - Card accent colours (orange, blue, red, neutral) remain in the split-content
 *     renderer — they are card accent variants, not design system card styles.
 *
 * BACKWARD COMPATIBILITY
 *   Existing SectionLayout / THEME_TOKENS / resolveLayout() remain unchanged.
 *   This file extends the visual token surface; it does not replace layout-types.ts.
 */

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

export type TypographyTokenKey = "h1" | "h2" | "h3" | "body" | "small" | "quote";

export type TypographyTokens = Record<TypographyTokenKey, string>;

/**
 * Typography token set.
 * Each value is a Tailwind class string applied directly to the element.
 * Renderers apply these on top of THEME_TOKENS.text for colour inheritance.
 */
export const TYPOGRAPHY_TOKENS: TypographyTokens = {
  h1: "text-4xl font-bold leading-tight tracking-tight sm:text-5xl",
  h2: "text-2xl font-bold leading-tight sm:text-3xl",
  h3: "text-xl font-semibold leading-snug",
  body: "text-base leading-relaxed",
  small: "text-sm leading-relaxed",
  quote: "text-lg italic leading-relaxed border-l-4 pl-4 border-current opacity-80",
};

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

export type ButtonVariantKey = "primary" | "secondary" | "outline" | "ghost";
export type ButtonShapeKey = "rounded" | "square";

export type ButtonTokens = Record<ButtonVariantKey, string> & Record<ButtonShapeKey, string>;

/**
 * Button token set.
 * Variant tokens include all interactive, colour and padding classes.
 * Shape tokens are additive radius modifiers appended to the variant.
 * Usage: `${ds.buttons.primary} ${ds.buttons.rounded}`
 */
export const BUTTON_TOKENS: ButtonTokens = {
  primary:
    "inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold bg-orange-500 text-white hover:bg-orange-600 active:bg-orange-700 transition-colors",
  secondary:
    "inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold bg-gray-200 text-gray-900 hover:bg-gray-300 active:bg-gray-400 transition-colors",
  outline:
    "inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold border border-current bg-transparent hover:bg-current/10 active:bg-current/20 transition-colors",
  ghost:
    "inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold bg-transparent hover:bg-current/10 active:bg-current/20 transition-colors",
  rounded: "rounded-full",
  square: "rounded-none",
};

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

export type CardStyleKey =
  | "default"
  | "soft"
  | "elevated"
  | "bordered"
  | "sponsor"
  | "highlight";

export type CardTokens = Record<
  CardStyleKey,
  {
    /** Outer wrapper class string (background, border, shadow, padding, radius). */
    container: string;
    /** Title class string applied to heading elements inside the card. */
    title: string;
    /** Body class string applied to paragraph/description text inside the card. */
    body: string;
  }
>;

/**
 * Card token set.
 * Each card style defines container, title, and body class strings.
 * Renderers use container on the wrapper div and title/body on inner elements.
 */
export const CARD_TOKENS: CardTokens = {
  default: {
    container: "rounded-lg bg-white border border-gray-200 p-5 shadow-sm",
    title: "text-base font-semibold text-gray-900",
    body: "text-sm leading-relaxed text-gray-600",
  },
  soft: {
    container: "rounded-lg bg-gray-50 border border-gray-100 p-5",
    title: "text-base font-semibold text-gray-800",
    body: "text-sm leading-relaxed text-gray-600",
  },
  elevated: {
    container: "rounded-xl bg-white border border-gray-100 p-6 shadow-md",
    title: "text-base font-semibold text-gray-900",
    body: "text-sm leading-relaxed text-gray-600",
  },
  bordered: {
    container: "rounded-lg bg-transparent border-2 border-gray-200 p-5",
    title: "text-base font-semibold text-gray-900",
    body: "text-sm leading-relaxed text-gray-600",
  },
  sponsor: {
    container: "rounded-xl bg-white border border-gray-100 p-6 shadow-sm flex items-center justify-center",
    title: "text-sm font-medium text-gray-700 text-center",
    body: "text-xs text-gray-500 text-center",
  },
  highlight: {
    container: "rounded-xl bg-orange-50 border border-orange-200 p-6 shadow-sm",
    title: "text-base font-semibold text-orange-900",
    body: "text-sm leading-relaxed text-orange-800",
  },
};

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

export type ColorTokenKey =
  | "primary"
  | "secondary"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "neutral";

/**
 * Semantic colour token set.
 * Values are Tailwind background-colour class strings.
 * For text use: replace "bg-" with "text-" in the consumer.
 * Tenant branding colours (--tenant-primary, --tenant-secondary) override
 * primary and secondary at CSS-variable level — see lib/tenant-runtime/theme.ts.
 */
export type ColorTokens = Record<ColorTokenKey, string>;

export const COLOR_TOKENS: ColorTokens = {
  primary: "bg-orange-500",
  secondary: "bg-blue-600",
  accent: "bg-orange-100",
  success: "bg-green-500",
  warning: "bg-yellow-400",
  danger: "bg-red-600",
  neutral: "bg-gray-200",
};

// ---------------------------------------------------------------------------
// Spacing
// ---------------------------------------------------------------------------

export type SpacingTokenKey = "xs" | "s" | "m" | "l" | "xl" | "xxl";

/**
 * Spacing token set.
 * Values are Tailwind gap / padding / margin class strings.
 * Used by renderers for internal content gaps and padding.
 * Section vertical spacing is still managed by SPACING_TOP_MAP / SPACING_BOTTOM_MAP
 * in layout-types.ts (controlled via SectionLayout.spacingTop / spacingBottom).
 */
export type SpacingTokens = Record<SpacingTokenKey, string>;

export const SPACING_TOKENS: SpacingTokens = {
  xs: "gap-1",
  s: "gap-3",
  m: "gap-6",
  l: "gap-10",
  xl: "gap-16",
  xxl: "gap-24",
};

// ---------------------------------------------------------------------------
// Shadows
// ---------------------------------------------------------------------------

export type ShadowTokenKey = "none" | "small" | "medium" | "large";

export type ShadowTokens = Record<ShadowTokenKey, string>;

/**
 * Shadow token set.
 * Values are Tailwind shadow class strings.
 * Replace hardcoded shadow-* classes with these tokens.
 */
export const SHADOW_TOKENS: ShadowTokens = {
  none: "shadow-none",
  small: "shadow-sm",
  medium: "shadow-md",
  large: "shadow-lg",
};

// ---------------------------------------------------------------------------
// Radius
// ---------------------------------------------------------------------------

export type RadiusTokenKey = "small" | "medium" | "large" | "extraLarge";

export type RadiusTokens = Record<RadiusTokenKey, string>;

/**
 * Border-radius token set.
 * Values are Tailwind rounded-* class strings.
 * Replace hardcoded rounded-* classes with these tokens.
 */
export const RADIUS_TOKENS: RadiusTokens = {
  small: "rounded-md",
  medium: "rounded-lg",
  large: "rounded-xl",
  extraLarge: "rounded-2xl",
};

// ---------------------------------------------------------------------------
// Section widths
// ---------------------------------------------------------------------------

export type SectionWidthTokenKey = "narrow" | "normal" | "wide" | "full";

export type SectionWidthTokens = Record<SectionWidthTokenKey, string>;

/**
 * Section width token set.
 * Values mirror WIDTH_MAP in layout-types.ts — these are the canonical values.
 * SectionShell resolves widths through this mapping (via WIDTH_MAP).
 * Renderers that need the width class string directly use this token map.
 */
export const SECTION_WIDTH_TOKENS: SectionWidthTokens = {
  narrow: "max-w-4xl",
  normal: "max-w-6xl",
  wide: "max-w-7xl",
  full: "max-w-none",
};

// ---------------------------------------------------------------------------
// Composite Design System type
// ---------------------------------------------------------------------------

/**
 * DesignSystemTokens — the complete resolved token set for a renderer.
 *
 * Produced by resolveDesignSystem() in lib/cms/token-resolver.ts.
 * Every renderer receives this object and reads styling from it.
 */
export type DesignSystemTokens = {
  typography: TypographyTokens;
  buttons: ButtonTokens;
  cards: CardTokens;
  colors: ColorTokens;
  spacing: SpacingTokens;
  shadows: ShadowTokens;
  radius: RadiusTokens;
  sectionWidths: SectionWidthTokens;
};

// ---------------------------------------------------------------------------
// Default Design System
// ---------------------------------------------------------------------------

/**
 * DEFAULT_DESIGN_SYSTEM — the SportClubEvo platform design system baseline.
 *
 * Used when a tenant has no custom design system overrides.
 * All renderers resolve through resolveDesignSystem() which returns this
 * merged with any tenant-level customisations.
 *
 * TOKEN RESOLUTION ORDER:
 *   1. Local _layout override (section-level, see SectionLayout)
 *   2. Tenant Design System (future: per-tenant DB overrides)
 *   3. DEFAULT_DESIGN_SYSTEM (this constant)
 *   4. Framework fallback (Tailwind defaults)
 */
export const DEFAULT_DESIGN_SYSTEM: DesignSystemTokens = {
  typography: TYPOGRAPHY_TOKENS,
  buttons: BUTTON_TOKENS,
  cards: CARD_TOKENS,
  colors: COLOR_TOKENS,
  spacing: SPACING_TOKENS,
  shadows: SHADOW_TOKENS,
  radius: RADIUS_TOKENS,
  sectionWidths: SECTION_WIDTH_TOKENS,
};
