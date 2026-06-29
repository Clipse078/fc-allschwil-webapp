"use client";

/**
 * components/website/blocks/TeamsTeaserRenderer.tsx
 *
 * Shared visual renderer for the `teamsTeaser` block type.
 *
 * Used by:
 *   1. Admin live preview inside PageBuilderClient
 *   2. Public website — import and render using the same config shape
 *      received from /api/public/[tenant]/website/homepage or /pages/[slug]/layout
 *
 * DATA BEHAVIOUR
 *   This is a data-driven block (datadriven: true in block-registry.ts).
 *   The public website MUST fetch its own live team data from:
 *     GET /api/public/{tenantSlug}/website/teams
 *   and pass the teams to this renderer via the `teams` prop.
 *   The `config` prop drives layout and heading only.
 *
 * DESIGN SYSTEM
 *   All visual styling is resolved through the Design System:
 *   - Typography: ds.typography.h2, ds.typography.h3, ds.typography.small
 *   - Cards: ds.cards.default
 *   - Spacing: ds.spacing.*
 *   - Radius: ds.radius.*
 *   - Shadows: ds.shadows.*
 *   Layout (width, background, vertical spacing, theme) is delegated to SectionShell.
 *
 * Props:
 *   config      — TeamsTeaserSectionConfig (the DB JSON column, parsed)
 *   teams       — live team data from GET /api/public/.../website/teams
 *   previewMode — when true adds an admin border/label overlay (via SectionShell)
 */

import type { TeamsTeaserSectionConfig } from "@/lib/homepage/section-types";
import { THEME_TOKENS, resolveLayout } from "@/lib/cms/layout-types";
import SectionShell from "@/components/website/SectionShell";
import { resolveDesignSystem } from "@/lib/cms/token-resolver";

// ---------------------------------------------------------------------------
// Team shape (public-safe subset from /website/teams)
// ---------------------------------------------------------------------------

export type TeamItem = {
  id: string;
  name: string;
  slug: string;
  ageGroup?: string | null;
  logoUrl?: string | null;
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type TeamsTeaserRendererProps = {
  config: Record<string, unknown>;
  teams?: TeamItem[];
  previewMode?: boolean;
};

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

export default function TeamsTeaserRenderer({
  config: rawConfig,
  teams = [],
  previewMode = false,
}: TeamsTeaserRendererProps) {
  const cfg = rawConfig as TeamsTeaserSectionConfig;
  const ds = resolveDesignSystem();

  const resolved = resolveLayout(cfg._layout);
  const themeTokens = THEME_TOKENS[resolved.theme];

  const heading = cfg.heading ?? "Unsere Teams";
  const displayCount = Math.min(cfg.itemCount ?? 6, teams.length);
  const displayTeams = teams.slice(0, displayCount);

  return (
    <SectionShell
      layout={cfg._layout}
      previewMode={previewMode}
      blockType="teamsTeaser"
    >
      {/* Section heading */}
      <h2 className={`mb-8 ${ds.typography.h2} ${themeTokens.text}`}>
        {heading}
      </h2>

      {displayTeams.length === 0 ? (
        <div className={`${ds.radius.medium} border border-dashed border-gray-300 px-6 py-12 text-center ${ds.typography.small} text-gray-400`}>
          {previewMode
            ? "Teams-Teaser — Mannschaften werden von der API geladen"
            : "Keine Teams verfügbar"}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {displayTeams.map((team) => (
            <a
              key={team.id}
              href={`/teams/${team.slug}`}
              className={`group flex flex-col items-center ${ds.cards.soft.container} hover:${ds.shadows.small} transition-shadow text-center`}
            >
              {team.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={team.logoUrl}
                  alt={team.name}
                  className="mb-3 h-16 w-16 rounded-full object-cover"
                />
              ) : (
                <div className={`mb-3 flex h-16 w-16 items-center justify-center ${ds.radius.extraLarge} bg-gray-200 text-gray-400`}>
                  <span className="text-xs font-bold uppercase">
                    {team.name.slice(0, 2)}
                  </span>
                </div>
              )}
              <h3 className={`${ds.cards.soft.title} group-hover:text-orange-600 transition-colors`}>
                {team.name}
              </h3>
              {team.ageGroup && (
                <p className={`mt-0.5 ${ds.typography.small} text-gray-500`}>
                  {team.ageGroup}
                </p>
              )}
            </a>
          ))}
        </div>
      )}
    </SectionShell>
  );
}
