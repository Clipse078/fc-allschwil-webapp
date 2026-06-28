/**
 * lib/homepage/section-types.ts
 *
 * Type definitions and derived registries for HomepageSection.
 *
 * IMPORTANT: This file is intentionally a thin adapter layer.
 * The canonical source of truth for block labels, descriptions, default configs,
 * categories, statuses, configKeys, and all block metadata lives in:
 *   → lib/homepage/block-registry.ts
 *
 * This file owns:
 *   - HOMEPAGE_SECTION_TYPE_KEYS  — stable DB column values
 *   - HomepageSectionTypeKey      — TypeScript type for the DB key union
 *   - Per-type config TypeScript shapes (HeroSectionConfig, etc.)
 *   - HomepageSectionConfig       — union type
 *   - HomepageSectionTypeDefinition — admin query/UI type (derived from registry)
 *   - HOMEPAGE_SECTION_TYPES      — array derived from BLOCK_REGISTRY (no duplication)
 *   - getHomepageSectionType()    — lookup helper
 *   - isValidSectionTypeKey()     — key validator
 *   - DefaultSectionSeed          — bootstrap seed type
 *   - DEFAULT_HOMEPAGE_SECTIONS   — array derived from BLOCK_REGISTRY (no duplication)
 *
 * Rules:
 *   - Never add labels, descriptions, configKeys, or default configs here —
 *     add them to block-registry.ts.
 *   - Type keys are stable DB values — rename only with a data migration.
 *   - Config shapes are TypeScript contracts; runtime validation is additive.
 *
 * Deferred:
 *   - Sponsor model (sponsorsTeaser type is registered but has no DB backing)
 *   - Preview / staging workflow per section
 *   - Per-section scheduling or expiry
 */

import { BLOCK_REGISTRY } from "@/lib/homepage/block-registry";
import type { RichTextValue } from "@/lib/cms/rich-text";
import type { SectionLayout } from "@/lib/cms/layout-types";

// ---------------------------------------------------------------------------
// Type key enum (DB contract — must match HomepageSection.type values)
// ---------------------------------------------------------------------------

/**
 * All valid homepage section type keys.
 * Must match HomepageSection.type values stored in the database.
 * Each key must have a corresponding entry in BLOCK_REGISTRY.
 */
export const HOMEPAGE_SECTION_TYPE_KEYS = [
  "hero",
  "newsTeaser",
  "eventsTeaser",
  "teamsTeaser",
  "sponsorsTeaser",
  "weekplanTeaser",
  "callToAction",
  "splitContentCards",
  "customContentPlaceholder",
] as const;

export type HomepageSectionTypeKey =
  (typeof HOMEPAGE_SECTION_TYPE_KEYS)[number];

// ---------------------------------------------------------------------------
// Config shapes (TypeScript contracts — validated at application layer)
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
  /** Shared layout configuration. See lib/cms/layout-types.ts. */
  _layout?: SectionLayout;
};

/** newsTeaser: latest published news articles. */
export type NewsTeaserSectionConfig = {
  /** Number of articles to display (1–10, default 3). */
  itemCount?: number;
  /** Section heading override. */
  heading?: string;
  /** Shared layout configuration. See lib/cms/layout-types.ts. */
  _layout?: SectionLayout;
};

/** eventsTeaser: upcoming events and matches. */
export type EventsTeaserSectionConfig = {
  /** Max events to display (1–20, default 5). */
  itemCount?: number;
  /** Surface filter: "homepage" | "all" (default "homepage"). */
  surface?: "homepage" | "all";
  /** Section heading override. */
  heading?: string;
  /** Shared layout configuration. See lib/cms/layout-types.ts. */
  _layout?: SectionLayout;
};

/** teamsTeaser: grid of active website-visible teams. */
export type TeamsTeaserSectionConfig = {
  /** Max teams to display (1–20, default 6). */
  itemCount?: number;
  /** Season key override; defaults to active season. */
  seasonKey?: string;
  /** Section heading override. */
  heading?: string;
  /** Shared layout configuration. See lib/cms/layout-types.ts. */
  _layout?: SectionLayout;
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
  /** Shared layout configuration. See lib/cms/layout-types.ts. */
  _layout?: SectionLayout;
};

/** weekplanTeaser: current week plan summary. */
export type WeekplanTeaserSectionConfig = {
  /** Section heading override. */
  heading?: string;
  /** Shared layout configuration. See lib/cms/layout-types.ts. */
  _layout?: SectionLayout;
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
  /** Shared layout configuration. See lib/cms/layout-types.ts. */
  _layout?: SectionLayout;
};

/**
 * customContentPlaceholder: reserved for future block-based rich content.
 * Config is intentionally empty in this foundation slice.
 */
export type CustomContentPlaceholderSectionConfig = {
  /** Shared layout configuration. See lib/cms/layout-types.ts. */
  _layout?: SectionLayout;
};

// ---------------------------------------------------------------------------
// SplitContentCards config types
// ---------------------------------------------------------------------------

export type SplitContentCardsLayout =
  | "TEXT_LEFT_CARDS_RIGHT"
  | "CARDS_LEFT_TEXT_RIGHT";

export type SplitContentCardsMediaPlacement =
  | "NONE"
  | "WITH_TEXT"
  | "WITH_CARDS"
  | "OPPOSITE_TEXT";

export type SplitContentCardVariant = "orange" | "blue" | "red" | "neutral";

export type SplitContentCard = {
  id: string;
  title: string;
  body: string;
  variant: SplitContentCardVariant;
  icon?: string;
};

export type SplitContentImageRef = {
  mediaAssetId: string;
  alt?: string;
  caption?: string;
};

export type SplitContentStyle = {
  theme: "light" | "soft" | "dark" | "club";
  spacingTop: "none" | "sm" | "md" | "lg" | "xl";
  spacingBottom: "none" | "sm" | "md" | "lg" | "xl";
  width: "narrow" | "normal" | "wide" | "full";
  alignment: "left" | "center";
};

export type SplitContentBackground =
  | { type: "none" }
  | { type: "solid"; color: string }
  | { type: "gradient"; gradientPreset: string }
  | { type: "image"; mediaAssetId: string; overlay: "none" | "light" | "dark" };

/**
 * splitContentCards: two-column premium content block.
 * Left/right columns hold text (eyebrow + headline + rich text) and stacked
 * text cards respectively. Fully configurable layout, images, and styles.
 *
 * Migration note:
 *   `style` and `background` are legacy fields kept for backward compatibility.
 *   New config written by the editor uses `_layout` (SectionLayout) instead.
 *   The renderer falls back to `style`/`background` when `_layout` is absent.
 */
export type SplitContentCardsSectionConfig = {
  eyebrow?: string;
  headline?: string;
  bodyRichText?: RichTextValue | null;
  layout?: SplitContentCardsLayout;
  mediaPlacement?: SplitContentCardsMediaPlacement;
  images?: SplitContentImageRef[];
  cards?: SplitContentCard[];
  /** @deprecated Use _layout instead. Kept for backward compatibility. */
  style?: SplitContentStyle;
  /** @deprecated Use _layout.background instead. Kept for backward compatibility. */
  background?: SplitContentBackground;
  /** Shared layout configuration (replaces style + background). */
  _layout?: SectionLayout;
};

/** Union of all known config shapes. */
export type HomepageSectionConfig =
  | HeroSectionConfig
  | NewsTeaserSectionConfig
  | EventsTeaserSectionConfig
  | TeamsTeaserSectionConfig
  | SponsorsTeaserSectionConfig
  | WeekplanTeaserSectionConfig
  | CallToActionSectionConfig
  | SplitContentCardsSectionConfig
  | CustomContentPlaceholderSectionConfig;

// ---------------------------------------------------------------------------
// Registry entry type (admin UI / query layer shape)
// ---------------------------------------------------------------------------

export type HomepageSectionTypeDefinition = {
  /** Stable key stored in HomepageSection.type. */
  key: HomepageSectionTypeKey;
  /** Human-readable label (German) — sourced from BLOCK_REGISTRY.displayName. */
  label: string;
  /** Description (German) — sourced from BLOCK_REGISTRY.description. */
  description: string;
  /** Default config — sourced from BLOCK_REGISTRY.defaultConfig. */
  defaultConfig: HomepageSectionConfig;
  /**
   * Implementation status for the admin UI.
   * Derived from BLOCK_REGISTRY.status:
   *   "available"        → "available"
   *   "foundation-ready" → "placeholder"
   *   "coming-next"      → "placeholder"
   */
  implementation: "available" | "placeholder";
};

// ---------------------------------------------------------------------------
// HOMEPAGE_SECTION_TYPES — derived from BLOCK_REGISTRY (no duplication)
// ---------------------------------------------------------------------------

/**
 * Array of all homepage section type definitions for the admin UI.
 *
 * Labels, descriptions, and default configs are sourced exclusively from
 * BLOCK_REGISTRY — never duplicated here.
 *
 * For configKeys, use getBlockDefinition(key)?.configKeys from block-registry.ts
 * directly — they are not re-exposed here to avoid duplication.
 */
export const HOMEPAGE_SECTION_TYPES: HomepageSectionTypeDefinition[] =
  BLOCK_REGISTRY.filter(
    (block): block is (typeof BLOCK_REGISTRY)[number] =>
      HOMEPAGE_SECTION_TYPE_KEYS.includes(
        block.type as HomepageSectionTypeKey,
      ),
  ).map((block) => ({
    key: block.type as HomepageSectionTypeKey,
    label: block.displayName,
    description: block.description,
    defaultConfig: block.defaultConfig as HomepageSectionConfig,
    implementation: block.status === "available" ? "available" : "placeholder",
  }));

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
export function isValidSectionTypeKey(
  key: string,
): key is HomepageSectionTypeKey {
  return HOMEPAGE_SECTION_TYPE_KEYS.includes(key as HomepageSectionTypeKey);
}

// ---------------------------------------------------------------------------
// Default section set for tenant bootstrap
// ---------------------------------------------------------------------------

export type DefaultSectionSeed = {
  type: HomepageSectionTypeKey;
  /** Display label — sourced from BLOCK_REGISTRY.displayName. */
  label: string;
  sortOrder: number;
  isEnabled: boolean;
  config: HomepageSectionConfig;
};

/**
 * Default set of sections created when bootstrapping a new tenant homepage.
 *
 * Derived from BLOCK_REGISTRY — labels and configs are not duplicated here.
 * Sorted by defaultSortOrder ascending to match the intended homepage display order.
 */
export const DEFAULT_HOMEPAGE_SECTIONS: DefaultSectionSeed[] = [...BLOCK_REGISTRY]
  .filter((block) =>
    HOMEPAGE_SECTION_TYPE_KEYS.includes(block.type as HomepageSectionTypeKey),
  )
  .sort((a, b) => a.defaultSortOrder - b.defaultSortOrder)
  .map((block) => ({
    type: block.type as HomepageSectionTypeKey,
    label: block.displayName,
    sortOrder: block.defaultSortOrder,
    isEnabled: block.defaultEnabled,
    config: block.defaultConfig as HomepageSectionConfig,
  }));
