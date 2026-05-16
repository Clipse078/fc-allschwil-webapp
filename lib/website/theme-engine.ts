import type { WebsitePreset } from "@/lib/website/website-preset-catalog";

export type WebsiteTheme = {
  primary: string;
  primaryLight: string;
  accent: string;
  bg: string;
  text: string;
  textMuted: string;
  border: string;
  cardBg: string;
  heroFullWidth: boolean;
  spacing: "compact" | "balanced" | "spacious";
  brandName: string;
  logoUrl: string | null;
  domain: string | null;
  presetKey: string | null;
};

const DEFAULT_THEME: Omit<WebsiteTheme, "brandName" | "logoUrl" | "domain"> = {
  primary: "#0b4aa2",
  primaryLight: "#e8f0fb",
  accent: "#f1f5f9",
  bg: "#ffffff",
  text: "#0f172a",
  textMuted: "#64748b",
  border: "#e2e8f0",
  cardBg: "#f8fafc",
  heroFullWidth: false,
  spacing: "balanced",
  presetKey: null,
};

export function resolveTheme(options: {
  preset?: WebsitePreset | null;
  primaryColor?: string | null;
  logoUrl?: string | null;
  siteName?: string | null;
  domain?: string | null;
}): WebsiteTheme {
  const { preset, primaryColor, logoUrl, siteName, domain } = options;

  const primary = primaryColor ?? preset?.previewTokens?.primary ?? DEFAULT_THEME.primary;
  const accent = preset?.previewTokens?.accent ?? DEFAULT_THEME.accent;
  const heroFullWidth = Boolean(
    preset?.homepageRhythm?.includes("full-width") ||
    preset?.homepageRhythm?.includes("fullscreen"),
  );

  // Derive a readable light tint from primary for backgrounds
  const primaryLight = accent.startsWith("#") ? accent : DEFAULT_THEME.primaryLight;

  return {
    ...DEFAULT_THEME,
    primary,
    primaryLight,
    accent,
    heroFullWidth,
    brandName: siteName ?? "Club",
    logoUrl: logoUrl ?? null,
    domain: domain ?? null,
    presetKey: preset?.key ?? null,
  };
}

/** Inline CSS vars for dynamic brand colours — inject into a root element. */
export function themeVars(theme: WebsiteTheme): Record<string, string> {
  return {
    "--brand-primary": theme.primary,
    "--brand-accent": theme.accent,
    "--brand-bg": theme.bg,
    "--brand-text": theme.text,
    "--brand-muted": theme.textMuted,
    "--brand-border": theme.border,
    "--brand-card": theme.cardBg,
  };
}
