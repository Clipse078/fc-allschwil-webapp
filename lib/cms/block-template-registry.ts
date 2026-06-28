/**
 * lib/cms/block-template-registry.ts
 *
 * Visual Composer block template registry — single source of truth for
 * editor-facing templates shown in the Block Gallery.
 *
 * Each template maps a friendly name + starter config to an underlying block
 * type from lib/homepage/block-registry.ts. Editors choose templates; they
 * never need to know internal type names like "splitContentCards".
 *
 * Rules:
 *   - Do NOT duplicate block type constants from block-registry.ts.
 *   - Do NOT duplicate config schemas from config-schemas.ts.
 *   - The `defaultConfig` here provides sensible starter content for editors.
 *   - Templates with `comingSoon: true` are shown but not insertable.
 *   - One template registry is shared by both Homepage Builder and Page Builder.
 *   - New templates must be added here only — never separately per builder.
 *
 * Gallery categories:
 *   Hero | Content | CTA | Media | Club | Dynamic
 */

// ---------------------------------------------------------------------------
// Template gallery category
// ---------------------------------------------------------------------------

export const GALLERY_CATEGORIES = [
  "Hero",
  "Content",
  "CTA",
  "Media",
  "Club",
  "Dynamic",
] as const;

export type GalleryCategory = (typeof GALLERY_CATEGORIES)[number];

// ---------------------------------------------------------------------------
// Template definition
// ---------------------------------------------------------------------------

export type BlockTemplate = {
  /** Unique template identifier (stable across deploys). */
  id: string;

  /** Human-readable label shown in the gallery (German). */
  label: string;

  /** Gallery category for grouping. */
  category: GalleryCategory;

  /** Short description for the gallery card (German). */
  description: string;

  /** Underlying block type key from BLOCK_REGISTRY. */
  blockType: string;

  /** Lucide icon name for the gallery card. */
  icon: string;

  /**
   * Starter config for the new section.
   * Merged on top of blockDef.defaultConfig when inserting.
   * Must be a valid subset of the block's config schema.
   */
  defaultConfig: Record<string, unknown>;

  /**
   * Where this template can be inserted.
   * "homepage" → HomepageSectionList
   * "page"     → PageBuilderClient
   */
  supportedTargets: Array<"homepage" | "page">;

  /**
   * If true, the template card is shown grayed-out with a "Demnächst" badge
   * but cannot be selected.
   */
  comingSoon?: boolean;

  /**
   * Optional description of why a template is coming soon.
   * Shown as a tooltip.
   */
  comingSoonNote?: string;
};

// ---------------------------------------------------------------------------
// Template registry
// ---------------------------------------------------------------------------

/**
 * All block templates available in the Block Gallery.
 * Ordered: highest-priority first ("Text + Cards").
 */
export const BLOCK_TEMPLATES: BlockTemplate[] = [
  // ── Content ──────────────────────────────────────────────────────────────

  {
    id: "split-content-cards-club",
    label: "Text + Karten",
    category: "Content",
    description:
      "Zweispaltiger Inhalt: Eyebrow, Überschrift und Fliesstext links — gestapelte Karten rechts. Ideal für Vereinsvorstellungen.",
    blockType: "splitContentCards",
    icon: "LayoutPanelLeft",
    defaultConfig: {
      eyebrow: "Unser Verein",
      headline: "FC Allschwil verbindet das Dorf",
      bodyRichText: null,
      layout: "TEXT_LEFT_CARDS_RIGHT",
      mediaPlacement: "NONE",
      images: [],
      cards: [
        {
          id: "card-1",
          title: "Für Kinder & Eltern",
          body: "Sport, Gemeinschaft und Freude für die ganze Familie.",
          variant: "orange",
        },
        {
          id: "card-2",
          title: "Für die Gemeinde",
          body: "Ein offener Verein, der das Dorfleben bereichert.",
          variant: "blue",
        },
        {
          id: "card-3",
          title: "Für die Zukunft",
          body: "Nachwuchsförderung und langfristiges Engagement.",
          variant: "neutral",
        },
      ],
      style: {
        theme: "soft",
        spacingTop: "md",
        spacingBottom: "md",
        width: "normal",
        alignment: "left",
      },
      background: { type: "none" },
    },
    supportedTargets: ["homepage", "page"],
  },

  {
    id: "split-content-cards-blank",
    label: "Text + Karten (leer)",
    category: "Content",
    description:
      "Leere Vorlage: Zweispaltiger Inhalt mit Platz für eigenen Text und Karten.",
    blockType: "splitContentCards",
    icon: "Columns2",
    defaultConfig: {
      eyebrow: "",
      headline: "",
      bodyRichText: null,
      layout: "TEXT_LEFT_CARDS_RIGHT",
      mediaPlacement: "NONE",
      images: [],
      cards: [],
      style: {
        theme: "light",
        spacingTop: "md",
        spacingBottom: "md",
        width: "normal",
        alignment: "left",
      },
      background: { type: "none" },
    },
    supportedTargets: ["homepage", "page"],
  },

  // ── Hero ─────────────────────────────────────────────────────────────────

  {
    id: "hero-default",
    label: "Hero-Bereich",
    category: "Hero",
    description:
      "Vollbreites Banner mit Titel, Untertitel und optionalem Call-to-Action.",
    blockType: "hero",
    icon: "LayoutTemplate",
    defaultConfig: {
      title: "",
      subtitle: "",
      ctaLabel: "",
      ctaUrl: "",
    },
    supportedTargets: ["homepage", "page"],
  },

  // ── CTA ──────────────────────────────────────────────────────────────────

  {
    id: "cta-default",
    label: "Call-to-Action",
    category: "CTA",
    description:
      "Konfigurierbares CTA-Banner mit Überschrift, Text und Buttons.",
    blockType: "callToAction",
    icon: "MousePointerClick",
    defaultConfig: {
      title: "",
      body: "",
      primaryLabel: "",
      primaryUrl: "",
      secondaryLabel: "",
      secondaryUrl: "",
    },
    supportedTargets: ["homepage", "page"],
  },

  // ── Club ─────────────────────────────────────────────────────────────────

  {
    id: "teams-teaser-default",
    label: "Teams-Übersicht",
    category: "Club",
    description: "Raster der aktiven, websichtbaren Mannschaften.",
    blockType: "teamsTeaser",
    icon: "Users",
    defaultConfig: { itemCount: 6 },
    supportedTargets: ["homepage", "page"],
  },

  {
    id: "sponsors-teaser-default",
    label: "Sponsoren-Banner",
    category: "Club",
    description:
      "Sponsor-Showcase. Sponsor-Datenmodell noch nicht vollständig implementiert.",
    blockType: "sponsorsTeaser",
    icon: "Award",
    defaultConfig: {},
    supportedTargets: ["homepage", "page"],
    comingSoon: false,
  },

  // ── Dynamic ──────────────────────────────────────────────────────────────

  {
    id: "news-teaser-default",
    label: "News-Teaser",
    category: "Dynamic",
    description: "Zeigt die neuesten veröffentlichten News-Artikel automatisch.",
    blockType: "newsTeaser",
    icon: "Newspaper",
    defaultConfig: { itemCount: 3 },
    supportedTargets: ["homepage", "page"],
  },

  {
    id: "events-teaser-default",
    label: "Veranstaltungs-Teaser",
    category: "Dynamic",
    description: "Kommende Spiele und Veranstaltungen mit Homepage-Sichtbarkeit.",
    blockType: "eventsTeaser",
    icon: "Calendar",
    defaultConfig: { itemCount: 5, surface: "homepage" },
    supportedTargets: ["homepage", "page"],
  },

  {
    id: "weekplan-teaser-default",
    label: "Wochenplan",
    category: "Dynamic",
    description: "Zusammenfassung des aktuellen Wochenplans.",
    blockType: "weekplanTeaser",
    icon: "CalendarDays",
    defaultConfig: {},
    supportedTargets: ["homepage", "page"],
  },

  // ── Media (coming soon) ───────────────────────────────────────────────────

  {
    id: "image-gallery-future",
    label: "Bildergalerie",
    category: "Media",
    description: "Responsive Bildergalerie mit Lightbox.",
    blockType: "customContentPlaceholder",
    icon: "Images",
    defaultConfig: {},
    supportedTargets: ["homepage", "page"],
    comingSoon: true,
    comingSoonNote: "Bildergalerie-Block wird in einem zukünftigen Release eingeführt.",
  },

  {
    id: "video-block-future",
    label: "Video",
    category: "Media",
    description: "Eingebettetes Video (YouTube, Vimeo oder Upload).",
    blockType: "customContentPlaceholder",
    icon: "Video",
    defaultConfig: {},
    supportedTargets: ["homepage", "page"],
    comingSoon: true,
    comingSoonNote: "Video-Block wird in einem zukünftigen Release eingeführt.",
  },
];

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/** Returns all templates for a given gallery category. */
export function getTemplatesByCategory(
  category: GalleryCategory,
): BlockTemplate[] {
  return BLOCK_TEMPLATES.filter((t) => t.category === category);
}

/** Returns all templates that support a given target ("homepage" | "page"). */
export function getTemplatesForTarget(
  target: "homepage" | "page",
): BlockTemplate[] {
  return BLOCK_TEMPLATES.filter((t) => t.supportedTargets.includes(target));
}

/** Returns the template with the given id, or undefined. */
export function getTemplateById(id: string): BlockTemplate | undefined {
  return BLOCK_TEMPLATES.find((t) => t.id === id);
}

/**
 * Returns all templates grouped by gallery category,
 * filtered to the given target, preserving GALLERY_CATEGORIES order.
 * Empty categories are included as empty arrays.
 */
export function getTemplatesByTargetAndCategory(
  target: "homepage" | "page",
): Map<GalleryCategory, BlockTemplate[]> {
  const map = new Map<GalleryCategory, BlockTemplate[]>();
  for (const cat of GALLERY_CATEGORIES) {
    map.set(cat, []);
  }
  for (const tpl of BLOCK_TEMPLATES) {
    if (!tpl.supportedTargets.includes(target)) continue;
    const list = map.get(tpl.category);
    if (list) list.push(tpl);
  }
  return map;
}
