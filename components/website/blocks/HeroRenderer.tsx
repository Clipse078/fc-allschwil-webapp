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
 *   onFieldChange — Admin canvas only. When provided, text fields become
 *                   inline-editable. Never set by the public website.
 */

import type { HeroSectionConfig } from "@/lib/homepage/section-types";
import { THEME_TOKENS, resolveLayout } from "@/lib/cms/layout-types";
import SectionShell from "@/components/website/SectionShell";
import { resolveDesignSystem } from "@/lib/cms/token-resolver";

// CanvasInlineTextField is a dev-dependency-style import: only ever executed
// in the admin canvas context (inside dynamic(..., {ssr:false}) loaders).
// The public website never sets onFieldChange so this branch is unreachable
// in public rendering. Dynamic import is not needed here because
// CanvasBlockPreview already loads this whole renderer via dynamic().
import { CanvasInlineTextField } from "@/components/admin/homepage-builder/CanvasInlineTextField";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type HeroRendererProps = {
  config: Record<string, unknown>;
  previewMode?: boolean;
  /** Resolved background image URL for canvas preview (admin only). */
  backgroundImageUrl?: string;
  /**
   * Admin canvas only. When provided, headline/subtitle/CTA label become
   * inline-editable text fields. The public website never passes this prop.
   */
  onFieldChange?: (field: string, value: string) => void;
  /** Admin canvas only: overrides the CSS background-position for focal-point preview. */
  backgroundPositionOverride?: string;
};

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

export default function HeroRenderer({
  config: rawConfig,
  previewMode = false,
  backgroundImageUrl,
  onFieldChange,
  backgroundPositionOverride,
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

  const isInlineEdit = !!onFieldChange;

  return (
    <SectionShell
      layout={cfg._layout}
      previewMode={previewMode}
      blockType="hero"
      backgroundImageUrl={backgroundImageUrl}
      backgroundPositionOverride={backgroundPositionOverride}
    >
      <div className={`flex flex-col ${alignClass} ${ds.spacing.m}`}>
        {/* Headline */}
        {isInlineEdit ? (
          <CanvasInlineTextField
            value={(cfg.title as string) ?? ""}
            onChange={(v) => onFieldChange("title", v)}
            className={`${ds.typography.h1} ${themeTokens.text}`}
            placeholder="Hero-Titel eingeben…"
          />
        ) : cfg.title ? (
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
        {isInlineEdit ? (
          <CanvasInlineTextField
            value={(cfg.subtitle as string) ?? ""}
            onChange={(v) => onFieldChange("subtitle", v)}
            className={`${ds.typography.body} ${themeTokens.subtext} max-w-2xl`}
            placeholder="Untertitel eingeben…"
            multiline
          />
        ) : (
          cfg.subtitle && (
            <p className={`${ds.typography.body} ${themeTokens.subtext} max-w-2xl`}>
              {cfg.subtitle}
            </p>
          )
        )}

        {/* CTA button — non-navigating span in edit mode to prevent accidental nav */}
        {isInlineEdit ? (
          <CanvasInlineTextField
            value={(cfg.ctaLabel as string) ?? ""}
            onChange={(v) => onFieldChange("ctaLabel", v)}
            className={`${ds.buttons.primary} ${ds.buttons.rounded} w-auto`}
            placeholder="Button-Text…"
          />
        ) : (
          cfg.ctaLabel && cfg.ctaUrl && (
            <a
              href={cfg.ctaUrl}
              className={`${ds.buttons.primary} ${ds.buttons.rounded}`}
            >
              {cfg.ctaLabel}
            </a>
          )
        )}

        {/* Preview placeholder when no content (non-edit mode only) */}
        {!isInlineEdit && previewMode && !cfg.title && !cfg.subtitle && !cfg.ctaLabel && (
          <div className={`w-full ${ds.radius.medium} border border-dashed border-gray-300 px-6 py-12 text-center ${ds.typography.small} text-gray-400`}>
            Hero — Titel, Untertitel und CTA konfigurieren
          </div>
        )}
      </div>
    </SectionShell>
  );
}
