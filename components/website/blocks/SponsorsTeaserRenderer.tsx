"use client";

/**
 * components/website/blocks/SponsorsTeaserRenderer.tsx
 *
 * Shared visual renderer for the `sponsorsTeaser` block type.
 *
 * Used by:
 *   1. Admin live preview inside PageBuilderClient
 *   2. Public website — import and render using the same config shape
 *      received from /api/public/[tenant]/website/homepage or /pages/[slug]/layout
 *
 * DATA BEHAVIOUR
 *   This is a foundation-ready block (status: "foundation-ready" in block-registry.ts).
 *   No Sponsor DB model exists yet.
 *   The public website MAY fetch sponsors from:
 *     GET /api/public/{tenantSlug}/website/sponsors (currently returns [])
 *   or from individual SPONSOR_BANNER ReusableComponents via:
 *     GET /api/public/{tenantSlug}/website/components/{id}
 *   Pass sponsors to this renderer via the `sponsors` prop when available.
 *
 * DESIGN SYSTEM
 *   All visual styling is resolved through the Design System:
 *   - Typography: ds.typography.h2, ds.typography.small
 *   - Cards: ds.cards.sponsor
 *   - Spacing: ds.spacing.*
 *   - Radius: ds.radius.*
 *   - Shadows: ds.shadows.*
 *   Layout (width, background, vertical spacing, theme) is delegated to SectionShell.
 *
 * Props:
 *   config      — SponsorsTeaserSectionConfig (the DB JSON column, parsed)
 *   sponsors    — sponsor data (currently empty; populated when Sponsor model lands)
 *   previewMode — when true adds an admin border/label overlay (via SectionShell)
 */

import type { SponsorsTeaserSectionConfig } from "@/lib/homepage/section-types";
import { THEME_TOKENS, resolveLayout } from "@/lib/cms/layout-types";
import SectionShell from "@/components/website/SectionShell";
import { resolveDesignSystem } from "@/lib/cms/token-resolver";

// ---------------------------------------------------------------------------
// Sponsor shape (matches WebsitePublicSponsor from integration-contract.ts)
// ---------------------------------------------------------------------------

export type SponsorItem = {
  id: string;
  name: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  tier: string | null;
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type SponsorsTeaserRendererProps = {
  config: Record<string, unknown>;
  sponsors?: SponsorItem[];
  previewMode?: boolean;
};

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

export default function SponsorsTeaserRenderer({
  config: rawConfig,
  sponsors = [],
  previewMode = false,
}: SponsorsTeaserRendererProps) {
  const cfg = rawConfig as SponsorsTeaserSectionConfig;
  const ds = resolveDesignSystem();

  const resolved = resolveLayout(cfg._layout);
  const themeTokens = THEME_TOKENS[resolved.theme];

  const heading = cfg.heading ?? "Unsere Sponsoren";

  return (
    <SectionShell
      layout={cfg._layout}
      previewMode={previewMode}
      blockType="sponsorsTeaser"
    >
      {/* Section heading */}
      <h2 className={`mb-8 ${ds.typography.h2} ${themeTokens.text}`}>
        {heading}
      </h2>

      {sponsors.length === 0 ? (
        <div className={`${ds.radius.medium} border border-dashed border-gray-300 px-6 py-12 text-center ${ds.typography.small} text-gray-400`}>
          {previewMode
            ? "Sponsoren-Teaser — Sponsor-Modell noch nicht implementiert (foundation-ready)"
            : "Keine Sponsoren verfügbar"}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {sponsors.map((sponsor) => {
            const card = (
              <div className={ds.cards.sponsor.container}>
                {sponsor.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={sponsor.logoUrl}
                    alt={sponsor.name}
                    className="max-h-16 max-w-full object-contain"
                  />
                ) : (
                  <span className={ds.cards.sponsor.title}>{sponsor.name}</span>
                )}
              </div>
            );

            return sponsor.websiteUrl ? (
              <a
                key={sponsor.id}
                href={sponsor.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`block ${ds.shadows.small} hover:${ds.shadows.medium} transition-shadow`}
              >
                {card}
              </a>
            ) : (
              <div key={sponsor.id} className={ds.shadows.small}>
                {card}
              </div>
            );
          })}
        </div>
      )}
    </SectionShell>
  );
}
