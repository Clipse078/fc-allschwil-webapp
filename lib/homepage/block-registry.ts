/**
 * lib/homepage/block-registry.ts
 *
 * Canonical block library registry for the CMS V2 block system.
 * Originally introduced in CMS V2 Slice 3 (Homepage Block Library Foundation);
 * extended to serve as the SHARED CMS block registry in CMS V2 Slice 8
 * (Page Builder Foundation) — now used by both HomepageSection and WebsitePageSection.
 *
 * This is the SINGLE SOURCE OF TRUTH for:
 *   - Block type keys (must match HomepageSection.type and WebsitePageSection.type DB columns)
 *   - Human-readable display names and descriptions (German)
 *   - Block categories (Header / Content / Data-driven / Club / Sponsors / Conversion / Utility)
 *   - Block availability status for the admin Block Library overview
 *   - Whether each block fetches data automatically (data-driven) or is manually configured
 *   - Default configuration per block type
 *   - Supported config keys (documentation aid for the admin UI)
 *   - Admin icon name for UI rendering (Lucide icon name string)
 *   - Default sort order and enabled state for tenant bootstrap
 *   - Public-safe config projection (ensures no admin-only fields leak to the public API)
 *
 * Rules:
 *   - NEVER duplicate block displayName, description, or defaultConfig elsewhere.
 *   - Block type keys are stable DB values — rename only with a data migration.
 *   - lib/homepage/section-types.ts derives HOMEPAGE_SECTION_TYPES from this registry.
 *   - DEFAULT_HOMEPAGE_SECTIONS in section-types.ts is derived from this registry.
 *   - lib/page-sections/admin-queries.ts uses this registry for WebsitePageSection.
 *   - Add new block types here first; all consumers pick them up automatically.
 *
 * Deferred future work (intentionally out of scope for this foundation slice):
 *   - Full config schema validation with Zod
 *   - Block config editor UI per type
 *   - Block preview rendering
 *   - Sponsor model (sponsorsTeaser is foundation-ready placeholder)
 *   - Rich content editor (customContentPlaceholder is coming-next)
 *   - Per-block scheduling / expiry metadata
 *   - Block version history
 */

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

/**
 * Available block categories for grouping in the admin block library overview.
 * Each category groups related block types by their content role.
 */
export const BLOCK_CATEGORIES = [
  "Header",
  "Content",
  "Data-driven",
  "Club",
  "Sponsors",
  "Conversion",
  "Utility",
] as const;

export type BlockCategory = (typeof BLOCK_CATEGORIES)[number];

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

/**
 * Block availability status for the admin block library overview.
 *
 *   available        — fully functional with a live data source
 *   foundation-ready — data model and API scaffolding exist; backing data
 *                      source (e.g. Sponsor model) not yet built
 *   coming-next      — planned for the next roadmap slice; not yet implemented
 */
export const BLOCK_STATUSES = [
  "available",
  "foundation-ready",
  "coming-next",
] as const;

export type BlockStatus = (typeof BLOCK_STATUSES)[number];

// ---------------------------------------------------------------------------
// Public-safe block metadata
// ---------------------------------------------------------------------------

/**
 * Public-safe block metadata included in each section item of the public
 * homepage API response.
 *
 * Never contains admin labels, internal status fields, tenantId, or any
 * admin-only metadata — only fields safe for unauthenticated public consumers.
 */
export type PublicBlockMeta = {
  /** Block category for client-side rendering and layout logic. */
  category: BlockCategory;
  /**
   * Whether this block auto-fetches content from a server-side data source.
   * false → manually configured (hero, callToAction)
   * true  → data-driven (newsTeaser, eventsTeaser, teamsTeaser, weekplanTeaser, sponsorsTeaser)
   */
  datadriven: boolean;
};

// ---------------------------------------------------------------------------
// Block definition
// ---------------------------------------------------------------------------

export type BlockDefinition = {
  /**
   * Stable type key stored in HomepageSection.type.
   * Must match an entry in HOMEPAGE_SECTION_TYPE_KEYS in section-types.ts.
   */
  type: string;

  /** Human-readable display name (German). Used in admin UI; never duplicated elsewhere. */
  displayName: string;

  /** Short description for admin UI tooltips and block library cards (German). */
  description: string;

  /** Block category for grouping in the admin block library overview. */
  category: BlockCategory;

  /** Availability status for the block library overview. */
  status: BlockStatus;

  /**
   * Whether this block fetches content automatically from a data source.
   * false → manually configured content (hero, callToAction, customContentPlaceholder)
   * true  → data-driven (newsTeaser, eventsTeaser, teamsTeaser, weekplanTeaser, sponsorsTeaser)
   */
  datadriven: boolean;

  /** Default config when a new section of this type is created. Public-safe only. */
  defaultConfig: Record<string, unknown>;

  /** Supported config keys. Used for documentation and admin UI hints. */
  configKeys: string[];

  /**
   * Lucide icon name for UI rendering.
   * Import the named icon from 'lucide-react' to render it.
   */
  icon: string;

  /** Default sort order when bootstrapping a tenant's homepage sections (0-based, steps of 10). */
  defaultSortOrder: number;

  /** Default enabled state when bootstrapping. Placeholder types default to false. */
  defaultEnabled: boolean;

  /**
   * Whether this block supports the shared Flexible Layout System.
   * When true, the admin editor shows the shared LayoutConfigPanel for this block.
   * The _layout key is included in defaultConfig and validated by sectionLayoutSchema.
   * All blocks support layout; this flag can be set false only for utility/placeholder blocks.
   */
  supportsLayout: boolean;

  /**
   * Projects a section's config to the public-safe subset for the public homepage API.
   *
   * All current block types use an identity projection (all config is public-safe).
   * Future types may filter out admin-only config keys here.
   * Called by lib/homepage/public-homepage-feed.ts when building the public response.
   */
  projectPublicConfig: (config: Record<string, unknown>) => Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/** Default _layout config injected into every new block section. */
const DEFAULT_LAYOUT_CONFIG = {
  width: "normal",
  spacingTop: "md",
  spacingBottom: "md",
  theme: "light",
  hAlign: "left",
  background: { type: "none" },
  responsive: { stackOnMobile: true, reverseStackOnMobile: false },
};

/**
 * Canonical block library registry.
 * Ordered by defaultSortOrder ascending for predictable iteration and deriving
 * DEFAULT_HOMEPAGE_SECTIONS.
 */
export const BLOCK_REGISTRY: BlockDefinition[] = [
  // ── Header ─────────────────────────────────────────────────────────────────
  {
    type: "hero",
    displayName: "Hero-Bereich",
    description:
      "Vollbreites Banner mit Titel, Untertitel und optionalem Call-to-Action.",
    category: "Header",
    status: "available",
    datadriven: false,
    defaultConfig: { _layout: { ...DEFAULT_LAYOUT_CONFIG, width: "full" } },
    configKeys: ["title", "subtitle", "ctaLabel", "ctaUrl", "_layout"],
    icon: "LayoutTemplate",
    defaultSortOrder: 0,
    defaultEnabled: true,
    supportsLayout: true,
    projectPublicConfig: (config) => config,
  },

  // ── Content ────────────────────────────────────────────────────────────────
  {
    type: "newsTeaser",
    displayName: "News-Teaser",
    description: "Zeigt die neuesten veröffentlichten News-Artikel.",
    category: "Content",
    status: "available",
    datadriven: true,
    defaultConfig: { itemCount: 3, _layout: DEFAULT_LAYOUT_CONFIG },
    configKeys: ["itemCount", "heading", "_layout"],
    icon: "Newspaper",
    defaultSortOrder: 10,
    defaultEnabled: true,
    supportsLayout: true,
    projectPublicConfig: (config) => config,
  },

  // ── Data-driven ────────────────────────────────────────────────────────────
  {
    type: "eventsTeaser",
    displayName: "Veranstaltungs-Teaser",
    description:
      "Kommende Spiele und Veranstaltungen mit Homepage-Sichtbarkeit.",
    category: "Data-driven",
    status: "available",
    datadriven: true,
    defaultConfig: { itemCount: 5, surface: "homepage", _layout: DEFAULT_LAYOUT_CONFIG },
    configKeys: ["itemCount", "surface", "heading", "_layout"],
    icon: "Calendar",
    defaultSortOrder: 20,
    defaultEnabled: true,
    supportsLayout: true,
    projectPublicConfig: (config) => config,
  },

  // ── Club ───────────────────────────────────────────────────────────────────
  {
    type: "teamsTeaser",
    displayName: "Teams-Übersicht",
    description: "Raster der aktiven, websichtbaren Mannschaften.",
    category: "Club",
    status: "available",
    datadriven: true,
    defaultConfig: { itemCount: 6, _layout: DEFAULT_LAYOUT_CONFIG },
    configKeys: ["itemCount", "seasonKey", "heading", "_layout"],
    icon: "Users",
    defaultSortOrder: 30,
    defaultEnabled: true,
    supportsLayout: true,
    projectPublicConfig: (config) => config,
  },

  // ── Data-driven (continued) ────────────────────────────────────────────────
  {
    type: "weekplanTeaser",
    displayName: "Wochenplan-Teaser",
    description: "Zusammenfassung des aktuellen Wochenplans.",
    category: "Data-driven",
    status: "available",
    datadriven: true,
    defaultConfig: { _layout: DEFAULT_LAYOUT_CONFIG },
    configKeys: ["heading", "_layout"],
    icon: "CalendarDays",
    defaultSortOrder: 40,
    defaultEnabled: true,
    supportsLayout: true,
    projectPublicConfig: (config) => config,
  },

  // ── Conversion ─────────────────────────────────────────────────────────────
  {
    type: "callToAction",
    displayName: "Call-to-Action",
    description:
      "Konfigurierbares CTA-Banner mit Überschrift, Text und Buttons.",
    category: "Conversion",
    status: "available",
    datadriven: false,
    defaultConfig: {
      _layout: { ...DEFAULT_LAYOUT_CONFIG, theme: "club" },
    },
    configKeys: [
      "title",
      "body",
      "primaryLabel",
      "primaryUrl",
      "secondaryLabel",
      "secondaryUrl",
      "_layout",
    ],
    icon: "MousePointerClick",
    defaultSortOrder: 50,
    defaultEnabled: false,
    supportsLayout: true,
    projectPublicConfig: (config) => config,
  },

  // ── Sponsors ───────────────────────────────────────────────────────────────
  {
    type: "sponsorsTeaser",
    displayName: "Sponsoren",
    description:
      "Sponsor-Showcase. Sponsor-Datenmodell noch nicht implementiert (foundation-ready).",
    category: "Sponsors",
    status: "foundation-ready",
    datadriven: true,
    defaultConfig: { _layout: DEFAULT_LAYOUT_CONFIG },
    configKeys: ["heading", "_layout"],
    icon: "Award",
    defaultSortOrder: 60,
    defaultEnabled: false,
    supportsLayout: true,
    projectPublicConfig: (config) => config,
  },

  // ── Content (Premium) ──────────────────────────────────────────────────────
  {
    type: "splitContentCards",
    displayName: "Split Content Cards",
    description:
      "Zweispaltiger Inhalt: Links Eyebrow/Headline/Fliesstext, rechts gestapelte Karten. Layout, Bilder und Stile vollständig konfigurierbar.",
    category: "Content",
    status: "available",
    datadriven: false,
    defaultConfig: {
      eyebrow: "",
      headline: "",
      bodyRichText: null,
      layout: "TEXT_LEFT_CARDS_RIGHT",
      mediaPlacement: "NONE",
      images: [],
      cards: [],
      _layout: {
        ...DEFAULT_LAYOUT_CONFIG,
        columns: "50/50",
        responsive: { stackOnMobile: true, reverseStackOnMobile: false },
      },
    },
    configKeys: [
      "eyebrow",
      "headline",
      "bodyRichText",
      "layout",
      "mediaPlacement",
      "images",
      "cards",
      "_layout",
    ],
    icon: "LayoutPanelLeft",
    defaultSortOrder: 65,
    defaultEnabled: false,
    supportsLayout: true,
    projectPublicConfig: (config) => config,
  },

  // ── Utility ────────────────────────────────────────────────────────────────
  {
    type: "customContentPlaceholder",
    displayName: "Benutzerdefinierter Inhalt",
    description:
      "Platzhalter für zukünftige Block-basierte Inhalte (visueller Editor).",
    category: "Utility",
    status: "coming-next",
    datadriven: false,
    defaultConfig: { _layout: DEFAULT_LAYOUT_CONFIG },
    configKeys: ["_layout"],
    icon: "Blocks",
    defaultSortOrder: 70,
    defaultEnabled: false,
    supportsLayout: false,
    projectPublicConfig: (config) => config,
  },
];

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/** Returns the block definition for the given type key, or undefined. */
export function getBlockDefinition(type: string): BlockDefinition | undefined {
  return BLOCK_REGISTRY.find((b) => b.type === type);
}

/**
 * Returns public-safe block metadata for the given type key.
 * Used by the public homepage API to enrich section items.
 * Returns null if the type is not registered (unknown custom type).
 */
export function getPublicBlockMeta(type: string): PublicBlockMeta | null {
  const def = getBlockDefinition(type);
  if (!def) return null;
  return { category: def.category, datadriven: def.datadriven };
}

/**
 * Projects a section's config to the public-safe subset for the given type.
 * Falls back to returning the config as-is if the type is not registered.
 */
export function projectBlockPublicConfig(
  type: string,
  config: Record<string, unknown>,
): Record<string, unknown> {
  const def = getBlockDefinition(type);
  if (!def) return config;
  return def.projectPublicConfig(config);
}

/**
 * Returns all block definitions grouped by category, preserving BLOCK_CATEGORIES order.
 * Empty categories are included as empty arrays for predictable iteration.
 */
export function getBlocksByCategory(): Map<BlockCategory, BlockDefinition[]> {
  const map = new Map<BlockCategory, BlockDefinition[]>();
  for (const category of BLOCK_CATEGORIES) {
    map.set(category, []);
  }
  for (const block of BLOCK_REGISTRY) {
    const list = map.get(block.category);
    if (list) list.push(block);
  }
  return map;
}
