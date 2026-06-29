"use client";

/**
 * components/website/blocks/CallToActionRenderer.tsx
 *
 * Shared visual renderer for the `callToAction` block type.
 *
 * Used by:
 *   1. Admin live preview inside PageBuilderClient
 *   2. Public website — import and render using the same config shape
 *      received from /api/public/[tenant]/website/homepage or /pages/[slug]/layout
 *
 * DESIGN SYSTEM
 *   All visual styling is resolved through the Design System:
 *   - Typography: ds.typography.h2, ds.typography.body
 *   - Buttons: ds.buttons.primary, ds.buttons.outline, ds.buttons.rounded
 *   - Spacing: ds.spacing.*
 *   Layout (width, background, vertical spacing, theme — defaults to "club")
 *   is delegated to SectionShell.
 *
 * Props:
 *   config      — CallToActionSectionConfig (the DB JSON column, parsed)
 *   previewMode — when true adds an admin border/label overlay (via SectionShell)
 */

import type { CallToActionSectionConfig } from "@/lib/homepage/section-types";
import { THEME_TOKENS, resolveLayout } from "@/lib/cms/layout-types";
import SectionShell from "@/components/website/SectionShell";
import { resolveDesignSystem } from "@/lib/cms/token-resolver";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type CallToActionRendererProps = {
  config: Record<string, unknown>;
  previewMode?: boolean;
};

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

export default function CallToActionRenderer({
  config: rawConfig,
  previewMode = false,
}: CallToActionRendererProps) {
  const cfg = rawConfig as CallToActionSectionConfig;
  const ds = resolveDesignSystem();

  const resolved = resolveLayout(cfg._layout);
  const themeTokens = THEME_TOKENS[resolved.theme];

  const hAlign = resolved.hAlign ?? "center";
  const alignClass =
    hAlign === "center"
      ? "items-center text-center"
      : hAlign === "right"
        ? "items-end text-right"
        : "items-start text-left";

  const hasContent = cfg.title || cfg.body || cfg.primaryLabel || cfg.secondaryLabel;

  return (
    <SectionShell
      layout={cfg._layout}
      previewMode={previewMode}
      blockType="callToAction"
    >
      {!hasContent && previewMode ? (
        <div className={`${ds.radius.medium} border border-dashed border-gray-300 px-6 py-12 text-center ${ds.typography.small} text-gray-400`}>
          Call-to-Action — Titel, Text und Buttons konfigurieren
        </div>
      ) : (
        <div className={`flex flex-col ${alignClass} ${ds.spacing.m}`}>
          {/* Headline */}
          {cfg.title && (
            <h2 className={`${ds.typography.h2} ${themeTokens.text}`}>
              {cfg.title}
            </h2>
          )}

          {/* Body text */}
          {cfg.body && (
            <p className={`${ds.typography.body} ${themeTokens.subtext} max-w-2xl`}>
              {cfg.body}
            </p>
          )}

          {/* Button group */}
          {(cfg.primaryLabel || cfg.secondaryLabel) && (
            <div className={`flex flex-wrap gap-3 ${hAlign === "center" ? "justify-center" : ""}`}>
              {cfg.primaryLabel && cfg.primaryUrl && (
                <a
                  href={cfg.primaryUrl}
                  className={`${ds.buttons.primary} ${ds.buttons.rounded}`}
                >
                  {cfg.primaryLabel}
                </a>
              )}
              {cfg.primaryLabel && !cfg.primaryUrl && (
                <span className={`${ds.buttons.primary} ${ds.buttons.rounded} opacity-50 cursor-not-allowed`}>
                  {cfg.primaryLabel}
                </span>
              )}
              {cfg.secondaryLabel && cfg.secondaryUrl && (
                <a
                  href={cfg.secondaryUrl}
                  className={`${ds.buttons.outline} ${ds.buttons.rounded}`}
                >
                  {cfg.secondaryLabel}
                </a>
              )}
              {cfg.secondaryLabel && !cfg.secondaryUrl && (
                <span className={`${ds.buttons.outline} ${ds.buttons.rounded} opacity-50 cursor-not-allowed`}>
                  {cfg.secondaryLabel}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </SectionShell>
  );
}
