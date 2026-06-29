"use client";

/**
 * components/website/blocks/NewsTeaserRenderer.tsx
 *
 * Shared visual renderer for the `newsTeaser` block type.
 *
 * Used by:
 *   1. Admin live preview inside PageBuilderClient
 *   2. Public website — import and render using the same config shape
 *      received from /api/public/[tenant]/website/homepage or /pages/[slug]/layout
 *
 * DATA BEHAVIOUR
 *   This is a data-driven block (datadriven: true in block-registry.ts).
 *   The public website MUST fetch its own live news data from:
 *     GET /api/public/{tenantSlug}/website/news
 *   and pass the articles to this renderer via the `articles` prop.
 *   The `config` prop drives layout and heading only.
 *
 * DESIGN SYSTEM
 *   All visual styling is resolved through the Design System:
 *   - Typography: ds.typography.h2, ds.typography.h3, ds.typography.small, ds.typography.body
 *   - Cards: ds.cards.default
 *   - Spacing: ds.spacing.*
 *   - Radius: ds.radius.*
 *   - Shadows: ds.shadows.*
 *   Layout (width, background, vertical spacing, theme) is delegated to SectionShell.
 *
 * Props:
 *   config      — NewsTeaserSectionConfig (the DB JSON column, parsed)
 *   articles    — live news data from GET /api/public/.../website/news
 *   previewMode — when true adds an admin border/label overlay (via SectionShell)
 */

import type { NewsTeaserSectionConfig } from "@/lib/homepage/section-types";
import { THEME_TOKENS, resolveLayout } from "@/lib/cms/layout-types";
import SectionShell from "@/components/website/SectionShell";
import { resolveDesignSystem } from "@/lib/cms/token-resolver";

// ---------------------------------------------------------------------------
// Article shape (public-safe subset from /website/news)
// ---------------------------------------------------------------------------

export type NewsArticle = {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  publishedAt: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type NewsTeaserRendererProps = {
  config: Record<string, unknown>;
  articles?: NewsArticle[];
  previewMode?: boolean;
};

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

export default function NewsTeaserRenderer({
  config: rawConfig,
  articles = [],
  previewMode = false,
}: NewsTeaserRendererProps) {
  const cfg = rawConfig as NewsTeaserSectionConfig;
  const ds = resolveDesignSystem();

  const resolved = resolveLayout(cfg._layout);
  const themeTokens = THEME_TOKENS[resolved.theme];

  const heading = cfg.heading ?? "Aktuelles";
  const displayCount = Math.min(cfg.itemCount ?? 3, articles.length);
  const displayArticles = articles.slice(0, displayCount);

  return (
    <SectionShell
      layout={cfg._layout}
      previewMode={previewMode}
      blockType="newsTeaser"
    >
      {/* Section heading */}
      <h2 className={`mb-8 ${ds.typography.h2} ${themeTokens.text}`}>
        {heading}
      </h2>

      {displayArticles.length === 0 ? (
        <div className={`${ds.radius.medium} border border-dashed border-gray-300 px-6 py-12 text-center ${ds.typography.small} text-gray-400`}>
          {previewMode
            ? "News-Teaser — Artikel werden von der API geladen"
            : "Keine News verfügbar"}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {displayArticles.map((article) => (
            <a
              key={article.id}
              href={`/news/${article.slug}`}
              className={`group block ${ds.cards.default.container} hover:${ds.shadows.medium} transition-shadow`}
            >
              {article.imageUrl && (
                <div className={`-mx-5 -mt-5 mb-4 overflow-hidden ${ds.radius.medium} rounded-b-none`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={article.imageUrl}
                    alt={article.imageAlt ?? article.title}
                    className="h-40 w-full object-cover transition-transform group-hover:scale-105"
                  />
                </div>
              )}
              {article.publishedAt && (
                <p className={`mb-1 ${ds.typography.small} text-gray-400`}>
                  {new Date(article.publishedAt).toLocaleDateString("de-CH", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              )}
              <h3 className={`${ds.cards.default.title} group-hover:text-orange-600 transition-colors`}>
                {article.title}
              </h3>
              {article.excerpt && (
                <p className={`mt-1 ${ds.cards.default.body} line-clamp-3`}>
                  {article.excerpt}
                </p>
              )}
            </a>
          ))}
        </div>
      )}
    </SectionShell>
  );
}
