/**
 * lib/homepage/section-types.ts
 *
 * Canonical registry of all supported homepage section types.
 *
 * This is the authoritative source of truth for:
 *   - Section type keys (used in HomepageSection.type DB column)
 *   - Human-readable labels (German, for the admin UI)
 *   - Descriptions (informational, admin UI only)
 *   - Default config shape per type
 *   - Default sort order when bootstrapping a tenant's section set
 *
 * Rules:
 *   - Never duplicate section type keys or labels elsewhere.
 *   - Type keys are stable DB values — rename only with a data migration.
 *   - Config shapes are informational contracts; validation is additive.
 *   - Add new types here first, then update the registry default set.
 *
 * Deferred (not implemented in this foundation slice):
 *   - Rich config editors per type
 *   - Sponsor model (sponsorsTeaser type is registered but has no DB backing)
 *   - Preview / staging workflow per section
 *   - Per-section scheduling or expiry
 */

// ---------------------------------------------------------------------------
// Type key enum
// ---------------------------------------------------------------------------

/**
 * All valid homepage section type keys.
 * Must match HomepageSection.type values stored in the database.
 */
export const HOMEPAGE_SECTION_TYPE_KEYS = [
  "hero",
  "newsTeaser",
  "eventsTeaser",
  "teamsTeaser",
  "sponsorsTeaser",
  "weekplanTeaser",
  "callToAction",
  "customContentPlaceholder",
] as const;

export type HomepageSectionTypeKey =
  (typeof HOMEPAGE_SECTION_TYPE_KEYS)[number];

// ---------------------------------------------------------------------------
// Config shapes (informational — validated at application layer)
// ---------------------------------------------------------------------------

/** hero: full-width banner with title, subtitle, optional CTA. */
export type HeroSectionConfig = {
  /** Main hero headline. Falls back to tenant name when empty. */
  title?: string;
  /** Supporting subtitle text. */
  subtitle?: string;
  /** CTA button label. */
  ctaLabel?: string;
  /** CTA button URL (absolute or site-relative). */
  ctaUrl?: string;
};

/** newsTeaser: latest published news articles. */
export type NewsTeaserSectionConfig = {
  /** Number of articles to display (1–10, default 3). */
  itemCount?: number;
  /** Section heading override. */
  heading?: string;
};

/** eventsTeaser: upcoming events and matches. */
export type EventsTeaserSectionConfig = {
  /** Max events to display (1–20, default 5). */
  itemCount?: number;
  /** Surface filter: "homepage" | "all" (default "homepage"). */
  surface?: "homepage" | "all";
  /** Section heading override. */
  heading?: string;
};

/** teamsTeaser: grid of active website-visible teams. */
export type TeamsTeaserSectionConfig = {
  /** Max teams to display (1–20, default 6). */
  itemCount?: number;
  /** Season key override; defaults to active season. */
  seasonKey?: string;
  /** Section heading override. */
  heading?: string;
};

/**
 * sponsorsTeaser: sponsor showcase.
 * NOTE: No Sponsor DB model exists yet. This type is registered as a
 * foundation placeholder. Config is intentionally minimal until the
 * Sponsor model is introduced in a future slice.
 */
export type SponsorsTeaserSectionConfig = {
  /** Section heading override. */
  heading?: string;
};

/** weekplanTeaser: current week plan summary. */
export type WeekplanTeaserSectionConfig = {
  /** Section heading override. */
  heading?: string;
};

/** callToAction: configurable CTA banner. */
export type CallToActionSectionConfig = {
  /** CTA headline. */
  title?: string;
  /** CTA body text. */
  body?: string;
  /** Primary button label. */
  primaryLabel?: string;
  /** Primary button URL. */
  primaryUrl?: string;
  /** Optional secondary button label. */
  secondaryLabel?: string;
  /** Optional secondary button URL. */
  secondaryUrl?: string;
};

/**
 * customContentPlaceholder: reserved for future block-based rich content.
 * Config is intentionally empty in this foundation slice.
 */
export type CustomContentPlaceholderSectionConfig = Record<string, never>;

/** Union of all known config shapes. */
export type HomepageSectionConfig =
  | HeroSectionConfig
  | NewsTeaserSectionConfig
  | EventsTeaserSectionConfig
  | TeamsTeaserSectionConfig
  | SponsorsTeaserSectionConfig
  | WeekplanTeaserSectionConfig
  | CallToActionSectionConfig
  | CustomContentPlaceholderSectionConfig;

// ---------------------------------------------------------------------------
// Registry entry
// ---------------------------------------------------------------------------

export type HomepageSectionTypeDefinition = {
  /** Stable key stored in HomepageSection.type. */
  key: HomepageSectionTypeKey;
  /** German label for admin UI display. */
  label: string;
  /** German description for admin UI tooltips/cards. */
  description: string;
  /** Default config for new sections of this type. */
  defaultConfig: HomepageSectionConfig;
  /**
   * Whether this type is fully implemented end-to-end.
   * "available" — backed by a data source today.
   * "placeholder" — registered but data source not yet built.
   */
  implementation: "available" | "placeholder";
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/**
 * Canonical registry of all homepage section types.
 * Used by the admin UI, default section bootstrap, and public API mapper.
 */
export const HOMEPAGE_SECTION_TYPES: HomepageSectionTypeDefinition[] = [
  {
    key: "hero",
    label: "Hero-Bereich",
    description:
      "Vollbreites Banner mit Titel, Untertitel und optionalem Call-to-Action.",
    defaultConfig: {} satisfies HeroSectionConfig,
    implementation: "available",
  },
  {
    key: "newsTeaser",
    label: "News-Teaser",
    description: "Zeigt die neuesten veröffentlichten News-Artikel.",
    defaultConfig: { itemCount: 3 } satisfies NewsTeaserSectionConfig,
    implementation: "available",
  },
  {
    key: "eventsTeaser",
    label: "Veranstaltungs-Teaser",
    description: "Kommende Spiele und Veranstaltungen mit Homepage-Sichtbarkeit.",
    defaultConfig: {
      itemCount: 5,
      surface: "homepage",
    } satisfies EventsTeaserSectionConfig,
    implementation: "available",
  },
  {
    key: "teamsTeaser",
    label: "Teams-Übersicht",
    description: "Raster der aktiven, websichtbaren Mannschaften.",
    defaultConfig: { itemCount: 6 } satisfies TeamsTeaserSectionConfig,
    implementation: "available",
  },
  {
    key: "sponsorsTeaser",
    label: "Sponsoren",
    description:
      "Sponsor-Showcase. Hinweis: Sponsor-Datenmodell noch nicht implementiert (Platzhalter).",
    defaultConfig: {} satisfies SponsorsTeaserSectionConfig,
    implementation: "placeholder",
  },
  {
    key: "weekplanTeaser",
    label: "Wochenplan-Teaser",
    description: "Zusammenfassung des aktuellen Wochenplans.",
    defaultConfig: {} satisfies WeekplanTeaserSectionConfig,
    implementation: "available",
  },
  {
    key: "callToAction",
    label: "Call-to-Action",
    description: "Konfigurierbares CTA-Banner mit Überschrift, Text und Buttons.",
    defaultConfig: {} satisfies CallToActionSectionConfig,
    implementation: "available",
  },
  {
    key: "customContentPlaceholder",
    label: "Benutzerdefinierter Inhalt",
    description:
      "Platzhalter für zukünftige Block-basierte Inhalte (visueller Editor).",
    defaultConfig: {} satisfies CustomContentPlaceholderSectionConfig,
    implementation: "placeholder",
  },
];

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/** Returns the definition for a given type key, or undefined. */
export function getHomepageSectionType(
  key: string,
): HomepageSectionTypeDefinition | undefined {
  return HOMEPAGE_SECTION_TYPES.find((t) => t.key === key);
}

/** Returns true if the given string is a known section type key. */
export function isValidSectionTypeKey(key: string): key is HomepageSectionTypeKey {
  return HOMEPAGE_SECTION_TYPE_KEYS.includes(key as HomepageSectionTypeKey);
}

// ---------------------------------------------------------------------------
// Default section set for tenant bootstrap
//
// Called when a tenant has no sections yet and an admin triggers
// "Create Default Sections". Ordered by intended homepage display order.
// ---------------------------------------------------------------------------

export type DefaultSectionSeed = {
  type: HomepageSectionTypeKey;
  label: string;
  sortOrder: number;
  isEnabled: boolean;
  config: HomepageSectionConfig;
};

/**
 * Default set of sections created when bootstrapping a new tenant homepage.
 * Only "available" types are included by default; placeholder types start
 * disabled so they don't appear in the public API.
 */
export const DEFAULT_HOMEPAGE_SECTIONS: DefaultSectionSeed[] = [
  {
    type: "hero",
    label: "Hero-Bereich",
    sortOrder: 0,
    isEnabled: true,
    config: {} satisfies HeroSectionConfig,
  },
  {
    type: "newsTeaser",
    label: "News-Teaser",
    sortOrder: 10,
    isEnabled: true,
    config: { itemCount: 3 } satisfies NewsTeaserSectionConfig,
  },
  {
    type: "eventsTeaser",
    label: "Veranstaltungs-Teaser",
    sortOrder: 20,
    isEnabled: true,
    config: { itemCount: 5, surface: "homepage" } satisfies EventsTeaserSectionConfig,
  },
  {
    type: "teamsTeaser",
    label: "Teams-Übersicht",
    sortOrder: 30,
    isEnabled: true,
    config: { itemCount: 6 } satisfies TeamsTeaserSectionConfig,
  },
  {
    type: "weekplanTeaser",
    label: "Wochenplan-Teaser",
    sortOrder: 40,
    isEnabled: true,
    config: {} satisfies WeekplanTeaserSectionConfig,
  },
  {
    type: "callToAction",
    label: "Call-to-Action",
    sortOrder: 50,
    isEnabled: false,
    config: {} satisfies CallToActionSectionConfig,
  },
  {
    type: "sponsorsTeaser",
    label: "Sponsoren",
    sortOrder: 60,
    isEnabled: false,
    config: {} satisfies SponsorsTeaserSectionConfig,
  },
  {
    type: "customContentPlaceholder",
    label: "Benutzerdefinierter Inhalt",
    sortOrder: 70,
    isEnabled: false,
    config: {} satisfies CustomContentPlaceholderSectionConfig,
  },
];
