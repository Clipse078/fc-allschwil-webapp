export type SiteTheme = {
  name: string;
  primaryColor: string;
  logoUrl: string | null;
  footerText: string | null;
  tagline: string | null;
};

export type ThemeTokens = {
  primaryColor: string;
  primaryStyle: string;
  primaryBgStyle: string;
  surfaceCls: string;
  borderCls: string;
  textCls: string;
  mutedTextCls: string;
};

const DEFAULT_PRIMARY = "#0b4aa2";

export function buildTheme(site: {
  name: string;
  primaryColor?: string | null;
  logoUrl?: string | null;
  footerText?: string | null;
  tagline?: string | null;
}): SiteTheme {
  return {
    name: site.name,
    primaryColor: site.primaryColor?.trim() || DEFAULT_PRIMARY,
    logoUrl: site.logoUrl?.trim() || null,
    footerText: site.footerText?.trim() || null,
    tagline: site.tagline?.trim() || null,
  };
}

export function themeTokens(theme: SiteTheme): ThemeTokens {
  return {
    primaryColor: theme.primaryColor,
    primaryStyle: `color: ${theme.primaryColor}`,
    primaryBgStyle: `background-color: ${theme.primaryColor}`,
    surfaceCls: "bg-white/95 backdrop-blur-xl",
    borderCls: "border-neutral-200",
    textCls: "text-neutral-900",
    mutedTextCls: "text-neutral-500",
  };
}

export function accentSurface(theme: SiteTheme): { backgroundColor: string; color: string } {
  return {
    backgroundColor: `${theme.primaryColor}12`,
    color: theme.primaryColor,
  };
}
