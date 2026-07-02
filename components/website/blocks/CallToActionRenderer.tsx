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
 *   onFieldChange — Admin canvas only. When provided, text fields become
 *                   inline-editable. Never set by the public website.
 */

import type { CallToActionSectionConfig } from "@/lib/homepage/section-types";
import { THEME_TOKENS, resolveLayout } from "@/lib/cms/layout-types";
import SectionShell from "@/components/website/SectionShell";
import { resolveDesignSystem } from "@/lib/cms/token-resolver";
import { CanvasInlineTextField } from "@/components/admin/homepage-builder/CanvasInlineTextField";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type CallToActionRendererProps = {
  config: Record<string, unknown>;
  previewMode?: boolean;
  /** Resolved background image URL for canvas preview (admin only). */
  backgroundImageUrl?: string;
  /**
   * Admin canvas only. When provided, title/body/button labels become
   * inline-editable text fields. The public website never passes this prop.
   */
  onFieldChange?: (field: string, value: string) => void;
  /** Admin canvas only: overrides the CSS background-position for focal-point preview. */
  backgroundPositionOverride?: string;
};

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

export default function CallToActionRenderer({
  config: rawConfig,
  previewMode = false,
  backgroundImageUrl,
  onFieldChange,
  backgroundPositionOverride,
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
  const isInlineEdit = !!onFieldChange;

  return (
    <SectionShell
      layout={cfg._layout}
      previewMode={previewMode}
      blockType="callToAction"
      backgroundImageUrl={backgroundImageUrl}
      backgroundPositionOverride={backgroundPositionOverride}
    >
      {!hasContent && previewMode && !isInlineEdit ? (
        <div className={`${ds.radius.medium} border border-dashed border-gray-300 px-6 py-12 text-center ${ds.typography.small} text-gray-400`}>
          Call-to-Action — Titel, Text und Buttons konfigurieren
        </div>
      ) : (
        <div className={`flex flex-col ${alignClass} ${ds.spacing.m}`}>
          {/* Headline */}
          {isInlineEdit ? (
            <CanvasInlineTextField
              value={(cfg.title as string) ?? ""}
              onChange={(v) => onFieldChange("title", v)}
              className={`${ds.typography.h2} ${themeTokens.text}`}
              placeholder="CTA-Titel eingeben…"
            />
          ) : (
            cfg.title && (
              <h2 className={`${ds.typography.h2} ${themeTokens.text}`}>
                {cfg.title}
              </h2>
            )
          )}

          {/* Body text */}
          {isInlineEdit ? (
            <CanvasInlineTextField
              value={(cfg.body as string) ?? ""}
              onChange={(v) => onFieldChange("body", v)}
              className={`${ds.typography.body} ${themeTokens.subtext} max-w-2xl`}
              placeholder="Beschreibungstext eingeben…"
              multiline
            />
          ) : (
            cfg.body && (
              <p className={`${ds.typography.body} ${themeTokens.subtext} max-w-2xl`}>
                {cfg.body}
              </p>
            )
          )}

          {/* Button group */}
          <div className={`flex flex-wrap gap-3 ${hAlign === "center" ? "justify-center" : ""}`}>
            {/* Primary button */}
            {isInlineEdit ? (
              <CanvasInlineTextField
                value={(cfg.primaryLabel as string) ?? ""}
                onChange={(v) => onFieldChange("primaryLabel", v)}
                className={`${ds.buttons.primary} ${ds.buttons.rounded} w-auto`}
                placeholder="Primär-Button…"
              />
            ) : (
              <>
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
              </>
            )}

            {/* Secondary button */}
            {isInlineEdit ? (
              <CanvasInlineTextField
                value={(cfg.secondaryLabel as string) ?? ""}
                onChange={(v) => onFieldChange("secondaryLabel", v)}
                className={`${ds.buttons.outline} ${ds.buttons.rounded} w-auto`}
                placeholder="Sekundär-Button…"
              />
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      )}
    </SectionShell>
  );
}
