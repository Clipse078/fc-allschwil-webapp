/**
 * lib/reusable-components/component-types.ts
 *
 * Registry of all supported reusable component types (CMS V2 Slice 12).
 *
 * This is the single source of truth for:
 *   - Type keys
 *   - Display labels (German)
 *   - Category grouping
 *   - Default config per type
 *
 * Adding a new component type:
 *   1. Add to REUSABLE_COMPONENT_TYPES
 *   2. Add a default config to COMPONENT_DEFAULT_CONFIGS
 *   3. Add a Zod schema to lib/reusable-components/config-schemas.ts
 *   4. Implement the form fields in components/admin/reusable-components/
 *
 * This file has NO server-side imports — safe in both Server and Client Components.
 */

// ---------------------------------------------------------------------------
// Type keys
// ---------------------------------------------------------------------------

export const REUSABLE_COMPONENT_TYPE = {
  CTA:              "CTA",
  SPONSOR_BANNER:   "SPONSOR_BANNER",
  CONTACT_CARD:     "CONTACT_CARD",
  FAQ:              "FAQ",
  QUOTE:            "QUOTE",
  STATISTICS:       "STATISTICS",
  ANNOUNCEMENT:     "ANNOUNCEMENT",
  RICH_TEXT:        "RICH_TEXT",
  // V4.2 Component Library additions
  HERO:             "HERO",
  TIMELINE:         "TIMELINE",
  TEAM_GRID:        "TEAM_GRID",
  REGISTRATION_CTA: "REGISTRATION_CTA",
  FOOTER_BLOCK:     "FOOTER_BLOCK",
} as const;

export type ReusableComponentType =
  (typeof REUSABLE_COMPONENT_TYPE)[keyof typeof REUSABLE_COMPONENT_TYPE];

// ---------------------------------------------------------------------------
// Registry entry shape
// ---------------------------------------------------------------------------

export type ComponentTypeCategory =
  | "conversion"
  | "content"
  | "social"
  | "data"
  | "information"
  | "layout"
  | "structure";

export type ComponentTypeEntry = {
  key: ReusableComponentType;
  label: string;
  description: string;
  category: ComponentTypeCategory;
  icon: string; // Lucide icon name
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const REUSABLE_COMPONENT_TYPES: ComponentTypeEntry[] = [
  {
    key: "CTA",
    label: "Call-to-Action",
    description: "Schaltfläche mit Titel, Text und Ziel-URL.",
    category: "conversion",
    icon: "MousePointerClick",
  },
  {
    key: "SPONSOR_BANNER",
    label: "Sponsoren-Banner",
    description: "Sponsor-Logo, Headline und optionaler CTA.",
    category: "social",
    icon: "Award",
  },
  {
    key: "CONTACT_CARD",
    label: "Kontaktkarte",
    description: "Person, Rolle, Kontaktdaten und soziale Links.",
    category: "information",
    icon: "ContactRound",
  },
  {
    key: "FAQ",
    label: "FAQ-Sammlung",
    description: "Häufig gestellte Fragen mit Antworten.",
    category: "content",
    icon: "CircleHelp",
  },
  {
    key: "QUOTE",
    label: "Zitat-Block",
    description: "Zitat mit Autor, Organisation und optionalem Bild.",
    category: "content",
    icon: "Quote",
  },
  {
    key: "STATISTICS",
    label: "Statistik-Panel",
    description: "Kennzahlen-Kacheln mit Label, Wert und Farbe.",
    category: "data",
    icon: "BarChart3",
  },
  {
    key: "ANNOUNCEMENT",
    label: "Ankündigungs-Banner",
    description: "Wichtige Hinweise mit Priorität und Darstellungszeitraum.",
    category: "information",
    icon: "Megaphone",
  },
  {
    key: "RICH_TEXT",
    label: "Rich-Text-Snippet",
    description: "Wiederverwendbarer formatierter Text (Datenschutz, Mitgliedschaft, etc.).",
    category: "content",
    icon: "FileText",
  },
  // ── V4.2 Component Library additions ──────────────────────────────────────
  {
    key: "HERO",
    label: "Hero-Sektion",
    description: "Großflächiger Einstiegsbereich mit Bild, Überschrift, Unterzeile und CTA.",
    category: "layout",
    icon: "LayoutTemplate",
  },
  {
    key: "TIMELINE",
    label: "Timeline",
    description: "Chronologische Darstellung von Ereignissen oder Meilensteinen.",
    category: "content",
    icon: "GitBranch",
  },
  {
    key: "TEAM_GRID",
    label: "Team-Raster",
    description: "Raster-Ansicht von Teammitgliedern mit Bild, Name, Rolle und Kontakt.",
    category: "data",
    icon: "Users",
  },
  {
    key: "REGISTRATION_CTA",
    label: "Anmelde-CTA",
    description: "Registrierungsaufforderung mit direktem Link zum Anmeldeformular.",
    category: "conversion",
    icon: "UserPlus",
  },
  {
    key: "FOOTER_BLOCK",
    label: "Footer-Block",
    description: "Wiederverwendbarer Footer-Bereich mit Links, Text und sozialen Netzwerken.",
    category: "structure",
    icon: "PanelBottom",
  },
];

/** Lookup a type entry by key. */
export function getComponentTypeEntry(
  key: string,
): ComponentTypeEntry | undefined {
  return REUSABLE_COMPONENT_TYPES.find((t) => t.key === key);
}

/** Label map for dropdowns etc. */
export const COMPONENT_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  REUSABLE_COMPONENT_TYPES.map((t) => [t.key, t.label]),
);

// ---------------------------------------------------------------------------
// Default configs per type
// ---------------------------------------------------------------------------

export const COMPONENT_DEFAULT_CONFIGS: Record<ReusableComponentType, Record<string, unknown>> = {
  CTA: {
    headline: "",
    description: "",
    primaryLabel: "",
    primaryUrl: "",
    secondaryLabel: "",
    secondaryUrl: "",
    icon: "",
    stylePreset: "default",
  },
  SPONSOR_BANNER: {
    sponsorName: "",
    // DAM reference — set via SharedMediaPicker
    logoMediaAssetId: null,
    // Resolved URL from the DAM asset (populated when asset is selected)
    logoUrl: "",
    headline: "",
    text: "",
    ctaLabel: "",
    ctaUrl: "",
    campaignStart: null,
    campaignEnd: null,
    clickTrackingEnabled: false,
  },
  CONTACT_CARD: {
    personName: "",
    role: "",
    // DAM reference — set via SharedMediaPicker
    imageMediaAssetId: null,
    // Resolved URL from the DAM asset (populated when asset is selected)
    imageUrl: "",
    phone: "",
    email: "",
    socialLinks: [],
    ctaLabel: "",
    ctaUrl: "",
  },
  FAQ: {
    items: [],
  },
  QUOTE: {
    quote: "",
    author: "",
    organisation: "",
    // DAM reference — set via SharedMediaPicker
    imageMediaAssetId: null,
    // Resolved URL from the DAM asset (populated when asset is selected)
    imageUrl: "",
    stylePreset: "default",
  },
  STATISTICS: {
    items: [],
  },
  ANNOUNCEMENT: {
    title: "",
    text: "",
    priority: "normal",
    icon: "",
    backgroundStyle: "default",
    publishFrom: null,
    publishUntil: null,
  },
  RICH_TEXT: {
    content: "",
  },
  // V4.2 additions
  HERO: {
    headline: "",
    subline: "",
    imageMediaAssetId: null,
    imageUrl: "",
    overlayOpacity: 0.4,
    ctaPrimaryLabel: "",
    ctaPrimaryUrl: "",
    ctaSecondaryLabel: "",
    ctaSecondaryUrl: "",
    textAlign: "left",
    heightPreset: "medium",
    showScrollIndicator: false,
  },
  TIMELINE: {
    title: "",
    description: "",
    items: [],
    orientation: "vertical",
    stylePreset: "default",
  },
  TEAM_GRID: {
    title: "",
    description: "",
    members: [],
    columns: 3,
    showContactInfo: true,
    showSocialLinks: false,
  },
  REGISTRATION_CTA: {
    headline: "",
    description: "",
    registrationType: "",
    buttonLabel: "Jetzt anmelden",
    buttonUrl: "",
    targetAudience: "",
    deadline: null,
    spotsLeft: null,
    backgroundColor: "default",
  },
  FOOTER_BLOCK: {
    title: "",
    tagline: "",
    columns: [],
    showSocialLinks: true,
    socialLinks: [],
    showAddress: false,
    address: "",
    copyrightText: "",
  },
};

/** Returns a fresh default config for the given type. */
export function getDefaultConfig(type: ReusableComponentType): Record<string, unknown> {
  return structuredClone(COMPONENT_DEFAULT_CONFIGS[type] ?? {});
}
