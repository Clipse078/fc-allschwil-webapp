"use client";

/**
 * components/admin/homepage-builder/canvas-renderers/CanvasHeroRenderer.tsx
 *
 * Admin-only canvas preview for the `hero` section type.
 *
 * Renders a representative hero banner that reflects:
 *   - title / subtitle
 *   - CTA button label
 *   - horizontal alignment (left / center / right)
 *   - background type (none / solid / gradient / image)
 *   - background image (from CanvasPreviewContext if a live URL is available,
 *     otherwise renders a tinted placeholder)
 *   - gradient preset
 *   - background color (solid)
 *   - overlay (none / light / dark)
 *   - theme tokens (light / soft / dark / club)
 *
 * ADMIN-ONLY. Does not affect public website output.
 */

import { useContext } from "react";
import { CanvasPreviewContext } from "./index";
import type { HeroSectionConfig } from "@/lib/homepage/section-types";
import {
  resolveLayout,
  THEME_TOKENS,
  GRADIENT_PRESETS,
  type SectionBackground,
} from "@/lib/cms/layout-types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = {
  config: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveBackgroundStyle(
  bg: SectionBackground,
  previewUrls: Record<string, string>,
): React.CSSProperties {
  switch (bg.type) {
    case "solid":
      return { backgroundColor: bg.color };
    case "gradient": {
      const preset = GRADIENT_PRESETS.find((p) => p.value === bg.gradientPreset);
      return preset ? { backgroundImage: preset.style } : {};
    }
    case "image": {
      const url = previewUrls[bg.mediaAssetId];
      if (url) {
        return {
          backgroundImage: `url(${url})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        };
      }
      // No URL yet — render a distinct placeholder
      return { backgroundColor: "#374151" };
    }
    default:
      return {};
  }
}

function overlayClass(
  bg: SectionBackground,
): string {
  if (bg.type !== "image") return "";
  switch (bg.overlay) {
    case "dark":  return "absolute inset-0 bg-black/50";
    case "light": return "absolute inset-0 bg-white/40";
    default:      return "";
  }
}

function alignClass(hAlign: string): string {
  switch (hAlign) {
    case "center": return "items-center text-center";
    case "right":  return "items-end text-right";
    default:       return "items-start text-left";
  }
}

// ---------------------------------------------------------------------------
// CanvasHeroRenderer
// ---------------------------------------------------------------------------

export function CanvasHeroRenderer({ config }: Props) {
  const { previewUrls } = useContext(CanvasPreviewContext);
  const hero = config as HeroSectionConfig;
  const layout = resolveLayout(hero._layout);

  const bg = layout.background;
  const tokens = THEME_TOKENS[layout.theme];
  const bgStyle = resolveBackgroundStyle(bg, previewUrls);
  const overlayClassName = overlayClass(bg);
  const hasBg = bg.type !== "none";

  // Text colours: when there's a dark/image/gradient background, force white
  const forceDarkText = bg.type === "none" || bg.type === "solid";
  const textColor = hasBg && !forceDarkText
    ? "text-white"
    : tokens.text;
  const subTextColor = hasBg && !forceDarkText
    ? "text-white/80"
    : tokens.subtext;

  const hasImagePlaceholder = bg.type === "image" && !previewUrls[bg.mediaAssetId];

  return (
    <div
      className={`relative min-h-[160px] flex flex-col justify-center px-6 py-8 ${hasBg ? "" : tokens.bg}`}
      style={bgStyle}
    >
      {/* Overlay */}
      {overlayClassName && <div className={overlayClassName} aria-hidden />}

      {/* Content */}
      <div className={`relative z-10 flex flex-col gap-3 ${alignClass(layout.hAlign)}`}>
        {/* Title */}
        <h2 className={`text-xl font-bold leading-tight truncate max-w-[90%] ${textColor}`}>
          {(hero.title as string | undefined) || (
            <span className="opacity-40">Hauptüberschrift…</span>
          )}
        </h2>

        {/* Subtitle */}
        {(hero.subtitle as string | undefined) && (
          <p className={`text-sm leading-relaxed max-w-[80%] line-clamp-2 ${subTextColor}`}>
            {hero.subtitle as string}
          </p>
        )}

        {/* CTA */}
        {(hero.ctaLabel as string | undefined) && (
          <div className="mt-1">
            <span className="inline-flex items-center rounded-lg bg-[var(--tenant-primary)] px-4 py-1.5 text-xs font-semibold text-white shadow-sm">
              {hero.ctaLabel as string}
            </span>
          </div>
        )}

        {/* Background image placeholder notice */}
        {hasImagePlaceholder && (
          <p className="text-[10px] text-white/70 mt-1 font-medium">
            📷 Hintergrundbild (assetId gesetzt, kein Live-Preview)
          </p>
        )}
      </div>

      {/* Background image missing indicator tint */}
      {hasImagePlaceholder && (
        <div className="absolute inset-0 bg-gray-700/60 flex items-end pb-3 px-3 pointer-events-none" aria-hidden>
          <span className="text-[9px] text-white/50 font-medium uppercase tracking-widest">
            Bild · {bg.mediaAssetId.slice(0, 8)}…
          </span>
        </div>
      )}
    </div>
  );
}
