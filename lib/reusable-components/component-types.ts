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
  CTA:            "CTA",
  SPONSOR_BANNER: "SPONSOR_BANNER",
  CONTACT_CARD:   "CONTACT_CARD",
  FAQ:            "FAQ",
  QUOTE:          "QUOTE",
  STATISTICS:     "STATISTICS",
  ANNOUNCEMENT:   "ANNOUNCEMENT",
  RICH_TEXT:      "RICH_TEXT",
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
  | "information";

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
// Block section type labels
// ---------------------------------------------------------------------------
// These mirror the block registry display names — kept here so both the
// SharedComponentPicker and ReusableComponentsLibrary can import a single
// shared label map without pulling in the full block registry (which imports
// server-side code in some code paths).

/** Display labels for block-registry section types saved as reusable items. */
export const BLOCK_SECTION_TYPE_LABELS: Record<string, string> = {
  hero:                   "Hero-Sektion",
  newsTeaser:             "News-Teaser",
  eventsTeaser:           "Events-Teaser",
  teamsTeaser:            "Teams-Teaser",
  weekplanTeaser:         "Wochenplan-Teaser",
  callToAction:           "Call-to-Action-Sektion",
  sponsorsTeaser:         "Sponsoren-Teaser",
  splitContentCards:      "Inhaltskarten",
  customContentPlaceholder: "Benutzerdefinierter Inhalt",
};

/**
 * Returns the human-readable label for any reusable component type,
 * covering both inline component types (CTA, FAQ, …) and block-registry
 * section types (hero, callToAction, …).
 */
export function getTypeLabel(type: string): string {
  return COMPONENT_TYPE_LABELS[type] ?? BLOCK_SECTION_TYPE_LABELS[type] ?? type;
}

/** Lucide icon names for block section types (mirrors block-registry icon field). */
export const BLOCK_SECTION_TYPE_ICONS: Record<string, string> = {
  hero:                   "LayoutTemplate",
  newsTeaser:             "Newspaper",
  eventsTeaser:           "Calendar",
  teamsTeaser:            "Users",
  weekplanTeaser:         "CalendarDays",
  callToAction:           "MousePointerClick",
  sponsorsTeaser:         "Award",
  splitContentCards:      "LayoutPanelLeft",
  customContentPlaceholder: "Blocks",
};

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
};

/** Returns a fresh default config for the given type. */
export function getDefaultConfig(type: ReusableComponentType): Record<string, unknown> {
  return structuredClone(COMPONENT_DEFAULT_CONFIGS[type] ?? {});
}
