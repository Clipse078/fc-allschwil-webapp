"use client";

/**
 * components/website/blocks/WeekplanTeaserRenderer.tsx
 *
 * Shared visual renderer for the `weekplanTeaser` block type.
 *
 * Used by:
 *   1. Admin live preview inside PageBuilderClient
 *   2. Public website — import and render using the same config shape
 *      received from /api/public/[tenant]/website/homepage or /pages/[slug]/layout
 *
 * DATA BEHAVIOUR
 *   This is a data-driven block (datadriven: true in block-registry.ts).
 *   The public website MUST fetch its own live weekplan data from:
 *     GET /api/public/{tenantSlug}/website/weekplan?weekId={currentWeekId}
 *   and pass the weekplan to this renderer via the `weekplan` prop.
 *   The `config` prop drives layout and heading only.
 *
 * DESIGN SYSTEM
 *   All visual styling is resolved through the Design System:
 *   - Typography: ds.typography.h2, ds.typography.h3, ds.typography.small
 *   - Cards: ds.cards.soft
 *   - Buttons: ds.buttons.outline, ds.buttons.rounded
 *   - Spacing: ds.spacing.*
 *   - Radius: ds.radius.*
 *   Layout (width, background, vertical spacing, theme) is delegated to SectionShell.
 *
 * Props:
 *   config      — WeekplanTeaserSectionConfig (the DB JSON column, parsed)
 *   weekplan    — live weekplan data from GET /api/public/.../website/weekplan
 *   previewMode — when true adds an admin border/label overlay (via SectionShell)
 */

import type { WeekplanTeaserSectionConfig } from "@/lib/homepage/section-types";
import { THEME_TOKENS, resolveLayout } from "@/lib/cms/layout-types";
import SectionShell from "@/components/website/SectionShell";
import { resolveDesignSystem } from "@/lib/cms/token-resolver";

// ---------------------------------------------------------------------------
// Weekplan data shapes (public-safe, JSON serialisation-safe for client components)
// Dates are ISO strings — avoids Date vs string ambiguity across JSON boundary.
// ---------------------------------------------------------------------------

export type WeekplanTeaserEvent = {
  id: string;
  title: string;
  /** ISO 8601 UTC string */
  startAt: string;
  location: string | null;
  team: {
    id: string;
    name: string;
    slug: string;
  } | null;
};

export type WeekplanTeaserDay = {
  /** ISO date string, e.g. "2026-06-23" */
  date: string;
  /** German weekday label, e.g. "Montag" */
  weekdayLabel: string;
  events: WeekplanTeaserEvent[];
};

export type WeekplanTeaserData = {
  days: WeekplanTeaserDay[];
};

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type WeekplanTeaserRendererProps = {
  config: Record<string, unknown>;
  weekplan?: WeekplanTeaserData;
  previewMode?: boolean;
};

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

export default function WeekplanTeaserRenderer({
  config: rawConfig,
  weekplan,
  previewMode = false,
}: WeekplanTeaserRendererProps) {
  const cfg = rawConfig as WeekplanTeaserSectionConfig;
  const ds = resolveDesignSystem();

  const resolved = resolveLayout(cfg._layout);
  const themeTokens = THEME_TOKENS[resolved.theme];

  const heading = cfg.heading ?? "Wochenplan";

  const days: WeekplanTeaserDay[] = weekplan?.days ?? [];
  const activeDays = days.filter((d) => d.events.length > 0);

  return (
    <SectionShell
      layout={cfg._layout}
      previewMode={previewMode}
      blockType="weekplanTeaser"
    >
      {/* Section heading */}
      <h2 className={`mb-8 ${ds.typography.h2} ${themeTokens.text}`}>
        {heading}
      </h2>

      {activeDays.length === 0 ? (
        <div
          className={`${ds.radius.medium} border border-dashed border-gray-300 px-6 py-12 text-center ${ds.typography.small} text-gray-400`}
        >
          {previewMode
            ? "Wochenplan-Teaser — Daten werden von der API geladen"
            : "Kein Wochenplan für diese Woche verfügbar"}
        </div>
      ) : (
        <>
          <div className="space-y-6">
            {activeDays.map((day) => (
              <div key={day.date}>
                {/* Day header */}
                <h3
                  className={`mb-3 border-b pb-1.5 ${ds.typography.h3} ${themeTokens.text} border-current/10`}
                >
                  {day.weekdayLabel}
                </h3>

                {/* Events for this day */}
                <div className="space-y-2">
                  {day.events.map((event) => (
                    <div
                      key={event.id}
                      className={`flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4 ${ds.cards.soft.container}`}
                    >
                      {/* Time */}
                      <p
                        className={`w-12 shrink-0 ${ds.typography.small} font-medium tabular-nums text-gray-500`}
                      >
                        {formatTime(event.startAt)}
                      </p>

                      {/* Title */}
                      <p
                        className={`flex-1 ${ds.typography.small} font-semibold ${themeTokens.text}`}
                      >
                        {event.title}
                      </p>

                      {/* Team */}
                      {event.team && (
                        <p className={`${ds.typography.small} text-gray-500`}>
                          {event.team.name}
                        </p>
                      )}

                      {/* Location */}
                      {event.location && (
                        <p className={`${ds.typography.small} text-gray-400`}>
                          {event.location}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* CTA — link to full weekplan */}
          <div className="mt-8 flex justify-center">
            <a
              href="/wochenplan"
              className={`${ds.buttons.outline} ${ds.buttons.rounded} ${themeTokens.text}`}
            >
              Zum Wochenplan
            </a>
          </div>
        </>
      )}
    </SectionShell>
  );
}
