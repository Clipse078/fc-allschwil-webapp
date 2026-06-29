"use client";

/**
 * components/website/blocks/GenericBlockRenderer.tsx
 *
 * Visual placeholder renderers for block types that do not yet have a
 * fully-implemented content renderer. Each renders a styled preview that
 * shows available config fields (title, heading, etc.) using the shared
 * SectionShell for accurate layout/background/theme rendering.
 *
 * Used by:
 *   - Admin Live Preview Canvas (shows all blocks, not just splitContentCards)
 *   - Falls back gracefully until a full renderer is built per block type
 *
 * Architecture: each exported component matches the standard renderer contract:
 *   ({ config, previewMode }) => JSX
 * Same signature as SplitContentCardsRenderer — all renderers are interchangeable.
 */

import SectionShell from "@/components/website/SectionShell";
import type { SectionLayout } from "@/lib/cms/layout-types";
import { THEME_TOKENS, resolveLayout } from "@/lib/cms/layout-types";
import {
  LayoutTemplate,
  Newspaper,
  Calendar,
  Users,
  CalendarDays,
  MousePointerClick,
  Award,
  Blocks,
  ArrowRight,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

type BaseRendererProps = {
  config: Record<string, unknown>;
  previewMode?: boolean;
};

function getLayout(config: Record<string, unknown>): SectionLayout {
  return (config._layout as SectionLayout | undefined) ?? {};
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return isNaN(n) ? fallback : n;
}

// ---------------------------------------------------------------------------
// Hero renderer
// ---------------------------------------------------------------------------

export function HeroRenderer({ config, previewMode }: BaseRendererProps) {
  const layout = getLayout(config);
  const resolved = resolveLayout(layout);
  const tokens = THEME_TOKENS[resolved.theme];
  const title = str(config.title) || "Hero-Titel";
  const subtitle = str(config.subtitle);
  const ctaLabel = str(config.ctaLabel);

  return (
    <SectionShell layout={layout} previewMode={previewMode} blockType="hero">
      <div className="flex flex-col items-center text-center py-8 gap-4">
        <div className="flex items-center justify-center h-12 w-12 rounded-full bg-white/20 mb-2">
          <LayoutTemplate className="h-6 w-6 opacity-60" style={{ color: "currentColor" }} />
        </div>
        <h1 className={`text-3xl sm:text-4xl font-bold leading-tight ${tokens.text}`}>{title}</h1>
        {subtitle && <p className={`text-lg max-w-2xl ${tokens.subtext}`}>{subtitle}</p>}
        {ctaLabel && (
          <button
            type="button"
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-orange-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 transition"
          >
            {ctaLabel}
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
        {!title && !subtitle && !ctaLabel && (
          <p className="text-sm opacity-50 italic">Kein Inhalt konfiguriert</p>
        )}
      </div>
    </SectionShell>
  );
}

// ---------------------------------------------------------------------------
// News Teaser renderer
// ---------------------------------------------------------------------------

export function NewsTeaserRenderer({ config, previewMode }: BaseRendererProps) {
  const layout = getLayout(config);
  const resolved = resolveLayout(layout);
  const tokens = THEME_TOKENS[resolved.theme];
  const heading = str(config.heading) || "Aktuelle News";
  const itemCount = num(config.itemCount, 3);

  return (
    <SectionShell layout={layout} previewMode={previewMode} blockType="newsTeaser">
      <div className="py-4">
        <div className="flex items-center gap-2 mb-4">
          <Newspaper className="h-5 w-5 opacity-60" />
          <h2 className={`text-xl font-bold ${tokens.text}`}>{heading}</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Array.from({ length: Math.min(itemCount, 6) }).map((_, i) => (
            <div key={i} className="rounded-lg border border-[var(--border)] bg-white/50 p-3 space-y-1.5">
              <div className="h-2 w-3/4 rounded bg-gray-200 animate-pulse" />
              <div className="h-2 w-full rounded bg-gray-200 animate-pulse" />
              <div className="h-2 w-1/2 rounded bg-gray-200 animate-pulse" />
            </div>
          ))}
        </div>
        <p className={`mt-3 text-xs ${tokens.subtext} opacity-60`}>
          Datenbankinhalt wird zur Laufzeit geladen ({itemCount} Artikel)
        </p>
      </div>
    </SectionShell>
  );
}

// ---------------------------------------------------------------------------
// Events Teaser renderer
// ---------------------------------------------------------------------------

export function EventsTeaserRenderer({ config, previewMode }: BaseRendererProps) {
  const layout = getLayout(config);
  const resolved = resolveLayout(layout);
  const tokens = THEME_TOKENS[resolved.theme];
  const heading = str(config.heading) || "Nächste Veranstaltungen";
  const itemCount = num(config.itemCount, 5);

  return (
    <SectionShell layout={layout} previewMode={previewMode} blockType="eventsTeaser">
      <div className="py-4">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-5 w-5 opacity-60" />
          <h2 className={`text-xl font-bold ${tokens.text}`}>{heading}</h2>
        </div>
        <div className="space-y-2">
          {Array.from({ length: Math.min(itemCount, 5) }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-white/50 px-3 py-2.5">
              <div className="h-8 w-8 rounded bg-orange-100 flex items-center justify-center shrink-0">
                <Calendar className="h-4 w-4 text-orange-500" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="h-2 w-2/3 rounded bg-gray-200 animate-pulse" />
                <div className="h-2 w-1/3 rounded bg-gray-200 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
        <p className={`mt-3 text-xs ${tokens.subtext} opacity-60`}>
          Datenbankinhalt wird zur Laufzeit geladen ({itemCount} Einträge)
        </p>
      </div>
    </SectionShell>
  );
}

// ---------------------------------------------------------------------------
// Teams Teaser renderer
// ---------------------------------------------------------------------------

export function TeamsTeaserRenderer({ config, previewMode }: BaseRendererProps) {
  const layout = getLayout(config);
  const resolved = resolveLayout(layout);
  const tokens = THEME_TOKENS[resolved.theme];
  const heading = str(config.heading) || "Unsere Mannschaften";
  const itemCount = num(config.itemCount, 6);

  return (
    <SectionShell layout={layout} previewMode={previewMode} blockType="teamsTeaser">
      <div className="py-4">
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5 opacity-60" />
          <h2 className={`text-xl font-bold ${tokens.text}`}>{heading}</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: Math.min(itemCount, 6) }).map((_, i) => (
            <div key={i} className="rounded-lg border border-[var(--border)] bg-white/50 p-3 flex flex-col items-center gap-2">
              <div className="h-12 w-12 rounded-full bg-gray-200 animate-pulse" />
              <div className="h-2 w-2/3 rounded bg-gray-200 animate-pulse" />
            </div>
          ))}
        </div>
        <p className={`mt-3 text-xs ${tokens.subtext} opacity-60`}>
          Datenbankinhalt wird zur Laufzeit geladen ({itemCount} Mannschaften)
        </p>
      </div>
    </SectionShell>
  );
}

// ---------------------------------------------------------------------------
// Weekplan Teaser renderer
// ---------------------------------------------------------------------------

export function WeekplanTeaserRenderer({ config, previewMode }: BaseRendererProps) {
  const layout = getLayout(config);
  const resolved = resolveLayout(layout);
  const tokens = THEME_TOKENS[resolved.theme];
  const heading = str(config.heading) || "Wochenplan";

  return (
    <SectionShell layout={layout} previewMode={previewMode} blockType="weekplanTeaser">
      <div className="py-4">
        <div className="flex items-center gap-2 mb-4">
          <CalendarDays className="h-5 w-5 opacity-60" />
          <h2 className={`text-xl font-bold ${tokens.text}`}>{heading}</h2>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((day) => (
            <div key={day} className="flex flex-col gap-1">
              <div className={`text-center text-[11px] font-semibold ${tokens.subtext}`}>{day}</div>
              <div className="h-16 rounded bg-gray-100 border border-gray-200 animate-pulse" />
            </div>
          ))}
        </div>
        <p className={`mt-3 text-xs ${tokens.subtext} opacity-60`}>
          Datenbankinhalt wird zur Laufzeit geladen
        </p>
      </div>
    </SectionShell>
  );
}

// ---------------------------------------------------------------------------
// Call to Action renderer
// ---------------------------------------------------------------------------

export function CallToActionRenderer({ config, previewMode }: BaseRendererProps) {
  const layout = getLayout(config);
  const resolved = resolveLayout(layout);
  const tokens = THEME_TOKENS[resolved.theme];
  const title = str(config.title) || "Call-to-Action";
  const body = str(config.body);
  const primaryLabel = str(config.primaryLabel);
  const secondaryLabel = str(config.secondaryLabel);

  return (
    <SectionShell layout={layout} previewMode={previewMode} blockType="callToAction">
      <div className="flex flex-col items-center text-center py-6 gap-4">
        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-white/20">
          <MousePointerClick className="h-5 w-5" />
        </div>
        <h2 className={`text-2xl font-bold ${tokens.text}`}>{title}</h2>
        {body && <p className={`max-w-xl ${tokens.subtext}`}>{body}</p>}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
          {primaryLabel && (
            <button type="button" className="rounded-lg bg-white px-5 py-2 text-sm font-semibold text-orange-600 hover:bg-orange-50 transition shadow-sm">
              {primaryLabel}
            </button>
          )}
          {secondaryLabel && (
            <button type="button" className="rounded-lg border border-white/50 px-5 py-2 text-sm font-semibold text-white hover:bg-white/10 transition">
              {secondaryLabel}
            </button>
          )}
        </div>
        {!primaryLabel && !secondaryLabel && (
          <p className="text-sm opacity-50 italic">Buttons konfigurieren</p>
        )}
      </div>
    </SectionShell>
  );
}

// ---------------------------------------------------------------------------
// Sponsors Teaser renderer
// ---------------------------------------------------------------------------

export function SponsorsTeaserRenderer({ config, previewMode }: BaseRendererProps) {
  const layout = getLayout(config);
  const resolved = resolveLayout(layout);
  const tokens = THEME_TOKENS[resolved.theme];
  const heading = str(config.heading) || "Unsere Sponsoren";

  return (
    <SectionShell layout={layout} previewMode={previewMode} blockType="sponsorsTeaser">
      <div className="py-4">
        <div className="flex items-center gap-2 mb-4">
          <Award className="h-5 w-5 opacity-60" />
          <h2 className={`text-xl font-bold ${tokens.text}`}>{heading}</h2>
        </div>
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center">
              <span className="text-xs text-gray-400">Logo</span>
            </div>
          ))}
        </div>
        <p className={`mt-3 text-xs ${tokens.subtext} opacity-60`}>
          Sponsor-Datenmodell noch nicht implementiert (foundation-ready)
        </p>
      </div>
    </SectionShell>
  );
}

// ---------------------------------------------------------------------------
// Custom Content Placeholder renderer
// ---------------------------------------------------------------------------

export function CustomContentPlaceholderRenderer({ config, previewMode }: BaseRendererProps) {
  const layout = getLayout(config);
  const resolved = resolveLayout(layout);
  const tokens = THEME_TOKENS[resolved.theme];

  return (
    <SectionShell layout={layout} previewMode={previewMode} blockType="customContentPlaceholder">
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <div className="flex items-center justify-center h-12 w-12 rounded-full border-2 border-dashed border-gray-300">
          <Blocks className="h-6 w-6 text-gray-400" />
        </div>
        <p className={`text-sm font-medium ${tokens.text}`}>Benutzerdefinierter Inhalt</p>
        <p className={`text-xs ${tokens.subtext} opacity-60`}>
          Visueller Editor — kommt demnächst
        </p>
      </div>
    </SectionShell>
  );
}
