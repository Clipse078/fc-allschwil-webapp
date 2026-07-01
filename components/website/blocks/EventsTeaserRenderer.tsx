"use client";

/**
 * components/website/blocks/EventsTeaserRenderer.tsx
 *
 * Shared visual renderer for the `eventsTeaser` block type.
 *
 * Used by:
 *   1. Admin live preview inside PageBuilderClient
 *   2. Public website — import and render using the same config shape
 *      received from /api/public/[tenant]/website/homepage or /pages/[slug]/layout
 *
 * DATA BEHAVIOUR
 *   This is a data-driven block (datadriven: true in block-registry.ts).
 *   The public website MUST fetch its own live event data from:
 *     GET /api/public/{tenantSlug}/website/events?surface={config.surface}&limit={config.itemCount}
 *   and pass the events to this renderer via the `events` prop.
 *   The `config` prop drives layout, heading, item count and surface filter only.
 *
 * DESIGN SYSTEM
 *   All visual styling is resolved through the Design System:
 *   - Typography: ds.typography.h2, ds.typography.h3, ds.typography.small
 *   - Cards: ds.cards.default
 *   - Buttons: ds.buttons.outline, ds.buttons.rounded
 *   - Spacing: ds.spacing.*
 *   - Radius: ds.radius.*
 *   - Shadows: ds.shadows.*
 *   Layout (width, background, vertical spacing, theme) is delegated to SectionShell.
 *
 * Props:
 *   config      — EventsTeaserSectionConfig (the DB JSON column, parsed)
 *   events      — live event data from GET /api/public/.../website/events
 *   previewMode — when true adds an admin border/label overlay (via SectionShell)
 */

import type { EventsTeaserSectionConfig } from "@/lib/homepage/section-types";
import { THEME_TOKENS, resolveLayout } from "@/lib/cms/layout-types";
import SectionShell from "@/components/website/SectionShell";
import { resolveDesignSystem } from "@/lib/cms/token-resolver";

// ---------------------------------------------------------------------------
// Event item shape (public-safe subset from /website/events)
// Dates are ISO strings — JSON serialisation-safe for client components.
// ---------------------------------------------------------------------------

export type EventTeaserItem = {
  id: string;
  title: string;
  /** EventType: MATCH | TOURNAMENT | TRAINING | OTHER | VACATION_PERIOD */
  type: string;
  status: string;
  /** ISO 8601 UTC string */
  startAt: string;
  /** ISO 8601 UTC string, null when not set */
  endAt: string | null;
  location: string | null;
  opponentName: string | null;
  /** HOME | AWAY | NEUTRAL — null for non-match events */
  homeAway: string | null;
  resultLabel: string | null;
  team: {
    id: string;
    name: string;
    slug: string;
  } | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-CH", {
    weekday: "short",
    day: "numeric",
    month: "long",
  });
}

function formatEventTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function resolveEventTitle(event: EventTeaserItem): string {
  if (event.type === "MATCH" && event.opponentName) {
    const prefix = event.homeAway === "AWAY" ? "@ " : "vs. ";
    return `${prefix}${event.opponentName}`;
  }
  return event.title;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type EventsTeaserRendererProps = {
  config: Record<string, unknown>;
  events?: EventTeaserItem[];
  previewMode?: boolean;
};

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

export default function EventsTeaserRenderer({
  config: rawConfig,
  events = [],
  previewMode = false,
}: EventsTeaserRendererProps) {
  const cfg = rawConfig as EventsTeaserSectionConfig;
  const ds = resolveDesignSystem();

  const resolved = resolveLayout(cfg._layout);
  const themeTokens = THEME_TOKENS[resolved.theme];

  const heading = cfg.heading ?? "Veranstaltungen";
  const displayCount = Math.min(cfg.itemCount ?? 5, events.length);
  const displayEvents = events.slice(0, displayCount);

  return (
    <SectionShell
      layout={cfg._layout}
      previewMode={previewMode}
      blockType="eventsTeaser"
    >
      {/* Section heading */}
      <h2 className={`mb-8 ${ds.typography.h2} ${themeTokens.text}`}>
        {heading}
      </h2>

      {displayEvents.length === 0 ? (
        <div
          className={`${ds.radius.medium} border border-dashed border-gray-300 px-6 py-12 text-center ${ds.typography.small} text-gray-400`}
        >
          {previewMode
            ? "Events-Teaser — Veranstaltungen werden von der API geladen"
            : "Keine Veranstaltungen verfügbar"}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {displayEvents.map((event) => (
              <div key={event.id} className={ds.cards.default.container}>
                {/* Date and time */}
                <p className={`mb-2 ${ds.typography.small} text-gray-400`}>
                  {formatEventDate(event.startAt)}&nbsp;&middot;&nbsp;{formatEventTime(event.startAt)}
                </p>

                {/* Event title / match info */}
                <h3 className={ds.cards.default.title}>
                  {resolveEventTitle(event)}
                </h3>

                {/* Team name */}
                {event.team && (
                  <p className={`mt-1 ${ds.typography.small} text-gray-500`}>
                    {event.team.name}
                  </p>
                )}

                {/* Location */}
                {event.location && (
                  <p className={`mt-2 ${ds.typography.small} text-gray-400`}>
                    {event.location}
                  </p>
                )}

                {/* Result badge for completed events */}
                {event.resultLabel && (
                  <p className={`mt-2 inline-block ${ds.typography.small} font-semibold text-orange-600`}>
                    {event.resultLabel}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* CTA — link to full events calendar */}
          <div className="mt-8 flex justify-center">
            <a
              href="/veranstaltungen"
              className={`${ds.buttons.outline} ${ds.buttons.rounded} ${themeTokens.text}`}
            >
              Alle Veranstaltungen
            </a>
          </div>
        </>
      )}
    </SectionShell>
  );
}
