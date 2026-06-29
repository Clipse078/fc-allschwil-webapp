"use client";

/**
 * components/website/blocks/HeroRenderer.tsx
 *
 * Shared visual renderer for the `hero` block type.
 *
 * Used by:
 *   1. Admin live preview inside PageBuilderClient
 *   2. Public website — import and render using the same config shape
 *      received from /api/public/[tenant]/website/homepage or /pages/[slug]/layout
 *
 * DESIGN SYSTEM
 *   All visual styling is resolved through the Design System:
 *   - Typography: ds.typography.h1, ds.typography.body
 *   - Buttons: ds.buttons.primary, ds.buttons.outline, ds.buttons.rounded
 *   - Spacing: ds.spacing.*
 *   Layout (width, background, vertical spacing, theme) is delegated to SectionShell.
 *
 * Props:
 *   config      — HeroSectionConfig (the DB JSON column, parsed)
 *   previewMode — when true adds an admin border/label overlay (via SectionShell)
 */

import type { HeroSectionConfig } from "@/lib/homepage/section-types";
import { THEME_TOKENS, resolveLayout } from "@/lib/cms/layout-types";
import SectionShell from "@/components/website/SectionShell";
import { resolveDesignSystem } from "@/lib/cms/token-resolver";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type HeroRendererProps = {
  config: Record<string, unknown>;
  previewMode?: boolean;
};

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

export default function HeroRenderer({
  config: rawConfig,
  previewMode = false,
}: HeroRendererProps) {
  const cfg = rawConfig as HeroSectionConfig;
  const ds = resolveDesignSystem();

  const resolved = resolveLayout(cfg._layout);
  const themeTokens = THEME_TOKENS[resolved.theme];

  const hAlign = resolved.hAlign ?? "left";
  const alignClass =
    hAlign === "center"
      ? "items-center text-center"
      : hAlign === "right"
        ? "items-end text-right"
        : "items-start text-left";

  return (
    <SectionShell
      layout={cfg._layout}
      previewMode={previewMode}
      blockType="hero"
    >
      <div className={`flex flex-col ${alignClass} ${ds.spacing.m}`}>
        {/* Headline */}
        {cfg.title ? (
          <h1 className={`${ds.typography.h1} ${themeTokens.text}`}>
            {cfg.title}
          </h1>
        ) : (
          previewMode && (
            <div className={`${ds.radius.medium} border border-dashed border-gray-300 px-4 py-3 ${ds.typography.small} text-gray-400`}>
              Kein Hero-Titel konfiguriert
            </div>
          )
        )}

        {/* Subtitle */}
        {cfg.subtitle && (
          <p className={`${ds.typography.body} ${themeTokens.subtext} max-w-2xl`}>
            {cfg.subtitle}
          </p>
        )}

        {/* CTA button */}
        {cfg.ctaLabel && cfg.ctaUrl && (
          <a
            href={cfg.ctaUrl}
            className={`${ds.buttons.primary} ${ds.buttons.rounded}`}
          >
            {cfg.ctaLabel}
          </a>
        )}

        {/* Preview placeholder when no content */}
        {previewMode && !cfg.title && !cfg.subtitle && !cfg.ctaLabel && (
          <div className={`w-full ${ds.radius.medium} border border-dashed border-gray-300 px-6 py-12 text-center ${ds.typography.small} text-gray-400`}>
            Hero — Titel, Untertitel und CTA konfigurieren
          </div>
        )}
      </div>
    </SectionShell>
  );
}
