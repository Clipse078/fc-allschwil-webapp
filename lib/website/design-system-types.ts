/**
 * lib/website/design-system-types.ts
 *
 * Design System Manager — CMS V4
 *
 * Single source of truth for tenant-scoped design system token types and defaults.
 *
 * Architecture:
 *   Club Design System  →  Template  →  Section  →  Public Website
 *
 * These tokens are stored as JSON on Tenant.websiteDesignSystem (nullable).
 * Null → resolved via DEFAULT_DESIGN_SYSTEM (FC Allschwil premium defaults).
 * All reads MUST go through resolveDesignSystem() to guarantee completeness.
 *
 * Principles:
 *   - No duplicate branding model. Colours here extend the existing
 *     primaryColor/secondaryColor branding fields.
 *   - Public-safe. resolveDesignSystem() output is safe to serve publicly.
 *   - JSON-driven and versionable.
 *   - Client-safe. No prisma, no next/server imports in this file.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Typography
// ─────────────────────────────────────────────────────────────────────────────

export type TypographyPreset = "premium" | "classic" | "modern" | "minimal";

export type TypographyToken = {
  /** Preset shorthand — overridden by explicit fields below. */
  preset?: TypographyPreset;
  fontFamily?: string;
  fontSize?: string;
  lineHeight?: string;
  fontWeight?: string;
  letterSpacing?: string;
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
};

export type TypographyScale = {
  h1: TypographyToken;
  h2: TypographyToken;
  h3: TypographyToken;
  body: TypographyToken;
  small: TypographyToken;
  quote: TypographyToken;
};

// ─────────────────────────────────────────────────────────────────────────────
// Colours
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tenant-level colour tokens.
 *
 * primary / secondary are intentionally kept in sync with Tenant.primaryColor
 * and Tenant.secondaryColor via resolveDesignSystem(). Do not create a
 * parallel branding system — these extend the existing architecture.
 */
export type ColourTokens = {
  primary: string;
  secondary: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
  neutral: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Buttons
// ─────────────────────────────────────────────────────────────────────────────

export type ButtonTokenStyle = {
  background: string;
  color: string;
  border: string;
  borderRadius: string;
  paddingX: string;
  paddingY: string;
  hoverBackground?: string;
  hoverColor?: string;
  hoverBorder?: string;
  disabledOpacity?: number;
  fontWeight?: string;
};

export type ButtonTokens = {
  primary: ButtonTokenStyle;
  secondary: ButtonTokenStyle;
  outline: ButtonTokenStyle;
  ghost: ButtonTokenStyle;
  rounded: ButtonTokenStyle;
  square: ButtonTokenStyle;
};

// ─────────────────────────────────────────────────────────────────────────────
// Cards
// ─────────────────────────────────────────────────────────────────────────────

export type CardTokenStyle = {
  background: string;
  border: string;
  borderRadius: string;
  shadow: string;
  padding: string;
  hoverShadow?: string;
  hoverBorder?: string;
};

export type CardTokens = {
  default: CardTokenStyle;
  soft: CardTokenStyle;
  elevated: CardTokenStyle;
  bordered: CardTokenStyle;
  sponsor: CardTokenStyle;
  highlight: CardTokenStyle;
};

// ─────────────────────────────────────────────────────────────────────────────
// Spacing Scale
// ─────────────────────────────────────────────────────────────────────────────

export type SpacingScale = {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  xxl: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Shadows
// ─────────────────────────────────────────────────────────────────────────────

export type ShadowTokens = {
  none: string;
  sm: string;
  md: string;
  lg: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Border Radius
// ─────────────────────────────────────────────────────────────────────────────

export type RadiusTokens = {
  sm: string;
  md: string;
  lg: string;
  xl: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Section Widths
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Default section widths for the Flexible Layout System.
 * These map to the SectionWidth values used in SectionShell.
 */
export type SectionWidthTokens = {
  narrow: string;
  normal: string;
  wide: string;
  full: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Animations (future-ready — preference stored, runtime TBD)
// ─────────────────────────────────────────────────────────────────────────────

export type AnimationPreference = "none" | "fade" | "slide" | "zoom";

export type AnimationTokens = {
  /**
   * Default entrance animation preference.
   * Stored for future animation runtime — not yet applied to renderers.
   * @future
   */
  default: AnimationPreference;
};

// ─────────────────────────────────────────────────────────────────────────────
// Root design system shape
// ─────────────────────────────────────────────────────────────────────────────

/**
 * TenantDesignSystem — the full tenant-scoped design system configuration.
 *
 * Stored as Tenant.websiteDesignSystem (JSON column).
 * All fields are optional at the storage level — resolveDesignSystem()
 * deep-merges stored values with DEFAULT_DESIGN_SYSTEM.
 */
export type TenantDesignSystem = {
  typography: Partial<TypographyScale>;
  colors: Partial<ColourTokens>;
  buttons: Partial<ButtonTokens>;
  cards: Partial<CardTokens>;
  spacing: Partial<SpacingScale>;
  shadows: Partial<ShadowTokens>;
  radius: Partial<RadiusTokens>;
  sectionWidths: Partial<SectionWidthTokens>;
  animations: Partial<AnimationTokens>;
};

/**
 * ResolvedDesignSystem — fully-populated, guaranteed non-null.
 * Produced exclusively by resolveDesignSystem().
 */
export type ResolvedDesignSystem = {
  typography: TypographyScale;
  colors: ColourTokens;
  buttons: ButtonTokens;
  cards: CardTokens;
  spacing: SpacingScale;
  shadows: ShadowTokens;
  radius: RadiusTokens;
  sectionWidths: SectionWidthTokens;
  animations: AnimationTokens;
};

// ─────────────────────────────────────────────────────────────────────────────
// Platform defaults — FC Allschwil premium design baseline
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DEFAULT_DESIGN_SYSTEM
 *
 * Premium defaults matching the FC Allschwil brand direction.
 * Applied when a tenant has no websiteDesignSystem configured.
 * Primary/secondary colours are intentionally the SportClubEvo brand defaults
 * and will be overridden at runtime from Tenant.primaryColor/secondaryColor
 * by resolveDesignSystem().
 */
export const DEFAULT_DESIGN_SYSTEM: ResolvedDesignSystem = {
  typography: {
    h1: {
      preset: "premium",
      fontFamily: "inherit",
      fontSize: "3rem",
      lineHeight: "1.15",
      fontWeight: "800",
      letterSpacing: "-0.025em",
      textTransform: "none",
    },
    h2: {
      preset: "premium",
      fontFamily: "inherit",
      fontSize: "2rem",
      lineHeight: "1.2",
      fontWeight: "700",
      letterSpacing: "-0.015em",
      textTransform: "none",
    },
    h3: {
      preset: "premium",
      fontFamily: "inherit",
      fontSize: "1.5rem",
      lineHeight: "1.3",
      fontWeight: "600",
      letterSpacing: "-0.01em",
      textTransform: "none",
    },
    body: {
      preset: "premium",
      fontFamily: "inherit",
      fontSize: "1rem",
      lineHeight: "1.625",
      fontWeight: "400",
      letterSpacing: "0em",
      textTransform: "none",
    },
    small: {
      preset: "premium",
      fontFamily: "inherit",
      fontSize: "0.875rem",
      lineHeight: "1.5",
      fontWeight: "400",
      letterSpacing: "0em",
      textTransform: "none",
    },
    quote: {
      preset: "premium",
      fontFamily: "inherit",
      fontSize: "1.25rem",
      lineHeight: "1.6",
      fontWeight: "500",
      letterSpacing: "0em",
      textTransform: "none",
    },
  },
  colors: {
    primary: "#0b4aa2",
    secondary: "#c7332c",
    accent: "#e8eef8",
    success: "#16a34a",
    warning: "#d97706",
    danger: "#dc2626",
    neutral: "#6b7280",
  },
  buttons: {
    primary: {
      background: "#0b4aa2",
      color: "#ffffff",
      border: "2px solid transparent",
      borderRadius: "0.5rem",
      paddingX: "1.25rem",
      paddingY: "0.625rem",
      hoverBackground: "#093d8a",
      fontWeight: "600",
      disabledOpacity: 0.5,
    },
    secondary: {
      background: "#c7332c",
      color: "#ffffff",
      border: "2px solid transparent",
      borderRadius: "0.5rem",
      paddingX: "1.25rem",
      paddingY: "0.625rem",
      hoverBackground: "#b02e27",
      fontWeight: "600",
      disabledOpacity: 0.5,
    },
    outline: {
      background: "transparent",
      color: "#0b4aa2",
      border: "2px solid #0b4aa2",
      borderRadius: "0.5rem",
      paddingX: "1.25rem",
      paddingY: "0.625rem",
      hoverBackground: "#e8eef8",
      fontWeight: "600",
      disabledOpacity: 0.5,
    },
    ghost: {
      background: "transparent",
      color: "#0b4aa2",
      border: "2px solid transparent",
      borderRadius: "0.5rem",
      paddingX: "1.25rem",
      paddingY: "0.625rem",
      hoverBackground: "#e8eef8",
      fontWeight: "500",
      disabledOpacity: 0.5,
    },
    rounded: {
      background: "#0b4aa2",
      color: "#ffffff",
      border: "2px solid transparent",
      borderRadius: "9999px",
      paddingX: "1.5rem",
      paddingY: "0.625rem",
      hoverBackground: "#093d8a",
      fontWeight: "600",
      disabledOpacity: 0.5,
    },
    square: {
      background: "#0b4aa2",
      color: "#ffffff",
      border: "2px solid transparent",
      borderRadius: "0",
      paddingX: "1.25rem",
      paddingY: "0.625rem",
      hoverBackground: "#093d8a",
      fontWeight: "600",
      disabledOpacity: 0.5,
    },
  },
  cards: {
    default: {
      background: "#ffffff",
      border: "1px solid #e5e7eb",
      borderRadius: "0.75rem",
      shadow: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
      padding: "1.5rem",
      hoverShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    },
    soft: {
      background: "#f9fafb",
      border: "1px solid #f3f4f6",
      borderRadius: "0.75rem",
      shadow: "none",
      padding: "1.5rem",
      hoverShadow: "0 1px 3px 0 rgb(0 0 0 / 0.08)",
    },
    elevated: {
      background: "#ffffff",
      border: "1px solid transparent",
      borderRadius: "1rem",
      shadow: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
      padding: "1.5rem",
      hoverShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
    },
    bordered: {
      background: "#ffffff",
      border: "2px solid #0b4aa2",
      borderRadius: "0.75rem",
      shadow: "none",
      padding: "1.5rem",
      hoverBorder: "2px solid #093d8a",
    },
    sponsor: {
      background: "#ffffff",
      border: "1px solid #e5e7eb",
      borderRadius: "0.5rem",
      shadow: "0 1px 3px 0 rgb(0 0 0 / 0.06)",
      padding: "1.25rem",
      hoverShadow: "0 4px 6px -1px rgb(0 0 0 / 0.08)",
    },
    highlight: {
      background: "#0b4aa2",
      border: "1px solid transparent",
      borderRadius: "1rem",
      shadow: "0 10px 15px -3px rgb(11 74 162 / 0.3)",
      padding: "1.5rem",
    },
  },
  spacing: {
    xs: "0.25rem",
    sm: "0.5rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2.5rem",
    xxl: "4rem",
  },
  shadows: {
    none: "none",
    sm: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
    md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
  },
  radius: {
    sm: "0.25rem",
    md: "0.5rem",
    lg: "0.75rem",
    xl: "1rem",
  },
  sectionWidths: {
    narrow: "56rem",
    normal: "72rem",
    wide: "80rem",
    full: "none",
  },
  animations: {
    default: "none",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Resolver
// ─────────────────────────────────────────────────────────────────────────────

/**
 * resolveDesignSystem
 *
 * Deep-merges stored tenant configuration with DEFAULT_DESIGN_SYSTEM.
 * Always returns a fully-populated ResolvedDesignSystem.
 *
 * When brandingColors is provided, primary and secondary colour tokens
 * are overridden from the existing branding fields (Tenant.primaryColor,
 * secondaryColor) — keeping the branding system as the single source of truth
 * for those two colours.
 *
 * @param stored        - Raw JSON from Tenant.websiteDesignSystem (nullable).
 * @param brandingColors - Optional { primary, secondary } from resolveTenantBranding().
 */
export function resolveDesignSystem(
  stored: unknown,
  brandingColors?: { primaryColor: string; secondaryColor: string },
): ResolvedDesignSystem {
  const raw = stored as Partial<TenantDesignSystem> | null | undefined;

  const resolved: ResolvedDesignSystem = {
    typography: mergeTypography(raw?.typography),
    colors: mergeColors(raw?.colors, brandingColors),
    buttons: mergeButtons(raw?.buttons, brandingColors?.primaryColor, brandingColors?.secondaryColor),
    cards: mergeCards(raw?.cards, brandingColors?.primaryColor),
    spacing: { ...DEFAULT_DESIGN_SYSTEM.spacing, ...raw?.spacing },
    shadows: { ...DEFAULT_DESIGN_SYSTEM.shadows, ...raw?.shadows },
    radius: { ...DEFAULT_DESIGN_SYSTEM.radius, ...raw?.radius },
    sectionWidths: { ...DEFAULT_DESIGN_SYSTEM.sectionWidths, ...raw?.sectionWidths },
    animations: { ...DEFAULT_DESIGN_SYSTEM.animations, ...raw?.animations },
  };

  return resolved;
}

function mergeTypography(stored: Partial<TypographyScale> | undefined): TypographyScale {
  const def = DEFAULT_DESIGN_SYSTEM.typography;
  return {
    h1: { ...def.h1, ...stored?.h1 },
    h2: { ...def.h2, ...stored?.h2 },
    h3: { ...def.h3, ...stored?.h3 },
    body: { ...def.body, ...stored?.body },
    small: { ...def.small, ...stored?.small },
    quote: { ...def.quote, ...stored?.quote },
  };
}

function mergeColors(
  stored: Partial<ColourTokens> | undefined,
  branding?: { primaryColor: string; secondaryColor: string },
): ColourTokens {
  return {
    ...DEFAULT_DESIGN_SYSTEM.colors,
    ...stored,
    // Branding colours always win for primary/secondary — single source of truth.
    primary: branding?.primaryColor ?? stored?.primary ?? DEFAULT_DESIGN_SYSTEM.colors.primary,
    secondary: branding?.secondaryColor ?? stored?.secondary ?? DEFAULT_DESIGN_SYSTEM.colors.secondary,
  };
}

function mergeButtons(
  stored: Partial<ButtonTokens> | undefined,
  primary?: string,
  secondary?: string,
): ButtonTokens {
  const def = DEFAULT_DESIGN_SYSTEM.buttons;
  const p = primary ?? DEFAULT_DESIGN_SYSTEM.colors.primary;
  const s = secondary ?? DEFAULT_DESIGN_SYSTEM.colors.secondary;

  return {
    primary: {
      ...def.primary,
      background: p,
      hoverBackground: darken(p),
      ...stored?.primary,
    },
    secondary: {
      ...def.secondary,
      background: s,
      hoverBackground: darken(s),
      ...stored?.secondary,
    },
    outline: {
      ...def.outline,
      color: p,
      border: `2px solid ${p}`,
      ...stored?.outline,
    },
    ghost: {
      ...def.ghost,
      color: p,
      ...stored?.ghost,
    },
    rounded: {
      ...def.rounded,
      background: p,
      hoverBackground: darken(p),
      ...stored?.rounded,
    },
    square: {
      ...def.square,
      background: p,
      hoverBackground: darken(p),
      ...stored?.square,
    },
  };
}

function mergeCards(
  stored: Partial<CardTokens> | undefined,
  primary?: string,
): CardTokens {
  const def = DEFAULT_DESIGN_SYSTEM.cards;
  const p = primary ?? DEFAULT_DESIGN_SYSTEM.colors.primary;

  return {
    default: { ...def.default, ...stored?.default },
    soft: { ...def.soft, ...stored?.soft },
    elevated: { ...def.elevated, ...stored?.elevated },
    bordered: {
      ...def.bordered,
      border: `2px solid ${p}`,
      ...stored?.bordered,
    },
    sponsor: { ...def.sponsor, ...stored?.sponsor },
    highlight: {
      ...def.highlight,
      background: p,
      ...stored?.highlight,
    },
  };
}

/**
 * Approximate CSS hex colour darkening for hover states.
 * Reduces each RGB channel by ~15% to produce a darker shade.
 * Simple implementation — sufficient for design token generation.
 */
export function darken(hex: string, amount = 0.15): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return hex;
  const r = Math.round(parseInt(clean.slice(0, 2), 16) * (1 - amount));
  const g = Math.round(parseInt(clean.slice(2, 4), 16) * (1 - amount));
  const b = Math.round(parseInt(clean.slice(4, 6), 16) * (1 - amount));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
