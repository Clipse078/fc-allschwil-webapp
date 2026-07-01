"use client";

/**
 * components/admin/homepage-builder/canvas-renderers/CanvasDataDrivenRenderer.tsx
 *
 * Admin-only canvas preview for data-driven block types:
 *   newsTeaser, eventsTeaser, teamsTeaser, sponsorsTeaser,
 *   weekplanTeaser, customContentPlaceholder
 *
 * Shows a premium placeholder with:
 *   - block display name and description
 *   - "Datengesteuert" badge
 *   - explanation that live data is loaded from APIs
 *   - heading override if set in config
 *
 * Does NOT render fake/placeholder data.
 * ADMIN-ONLY. Does not affect public website output.
 */

import { Newspaper, Calendar, Users, CalendarDays, Award, Blocks, Database } from "lucide-react";
import { getBlockDefinition } from "@/lib/homepage/block-registry";
import { resolveLayout, THEME_TOKENS } from "@/lib/cms/layout-types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = {
  type: string;
  config: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Icon map for data-driven blocks
// ---------------------------------------------------------------------------

const TYPE_ICONS: Record<string, React.ElementType> = {
  newsTeaser:             Newspaper,
  eventsTeaser:           Calendar,
  teamsTeaser:            Users,
  weekplanTeaser:         CalendarDays,
  sponsorsTeaser:         Award,
  customContentPlaceholder: Blocks,
};

// ---------------------------------------------------------------------------
// CanvasDataDrivenRenderer
// ---------------------------------------------------------------------------

export function CanvasDataDrivenRenderer({ type, config }: Props) {
  const def = getBlockDefinition(type);
  const Icon = TYPE_ICONS[type] ?? Database;

  const layout = resolveLayout(
    (config as { _layout?: Record<string, unknown> })._layout as Parameters<typeof resolveLayout>[0],
  );
  const tokens = THEME_TOKENS[layout.theme];

  const headingOverride = (config.heading as string | undefined);

  return (
    <div className={`min-h-[120px] flex flex-col gap-3 px-5 py-5 ${tokens.bg}`}>
      {/* Header row */}
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 shrink-0 flex items-center justify-center rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
          <Icon className="h-4.5 w-4.5 text-[var(--muted)]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`text-sm font-semibold leading-snug truncate ${tokens.text}`}>
              {headingOverride || def?.displayName || type}
            </p>
            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-emerald-700">
              <Database className="h-2.5 w-2.5" />
              Datengesteuert
            </span>
          </div>
          {def?.description && (
            <p className={`text-[11px] leading-relaxed mt-0.5 line-clamp-2 ${tokens.subtext}`}>
              {def.description}
            </p>
          )}
        </div>
      </div>

      {/* Explanation */}
      <div className="flex items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/60 px-3 py-2">
        <Database className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[var(--muted)]" />
        <p className="text-[11px] text-[var(--text-2)] leading-relaxed">
          Live-Daten werden zur Laufzeit aus der API geladen. Diese Vorschau zeigt keine Beispieldaten.
        </p>
      </div>

      {/* Skeleton rows to suggest live content */}
      <div className="space-y-1.5 opacity-30 pointer-events-none" aria-hidden>
        {[60, 80, 50].map((w, i) => (
          <div
            key={i}
            className="h-2.5 rounded-full bg-current opacity-20"
            style={{ width: `${w}%` }}
          />
        ))}
      </div>
    </div>
  );
}
