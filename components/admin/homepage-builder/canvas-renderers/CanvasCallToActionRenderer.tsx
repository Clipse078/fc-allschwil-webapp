"use client";

/**
 * components/admin/homepage-builder/canvas-renderers/CanvasCallToActionRenderer.tsx
 *
 * Admin-only canvas preview for the `callToAction` section type.
 *
 * Renders a representative CTA banner that reflects:
 *   - headline / body text
 *   - primary and secondary button labels
 *   - horizontal alignment (left / center)
 *   - background type (none / solid / gradient / image)
 *   - background image (from CanvasPreviewContext if available)
 *   - overlay, gradient preset, background color
 *   - theme tokens
 *
 * ADMIN-ONLY. Does not affect public website output.
 */

import { useContext } from "react";
import { CanvasPreviewContext } from "./index";
import type { CallToActionSectionConfig } from "@/lib/homepage/section-types";
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
// Helpers (mirrors CanvasHeroRenderer helpers)
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
      return { backgroundColor: "#374151" };
    }
    default:
      return {};
  }
}

function overlayClass(bg: SectionBackground): string {
  if (bg.type !== "image") return "";
  switch (bg.overlay) {
    case "dark":  return "absolute inset-0 bg-black/50";
    case "light": return "absolute inset-0 bg-white/40";
    default:      return "";
  }
}

function alignClass(hAlign: string): string {
  return hAlign === "center" ? "items-center text-center" : "items-start text-left";
}

// ---------------------------------------------------------------------------
// CanvasCallToActionRenderer
// ---------------------------------------------------------------------------

export function CanvasCallToActionRenderer({ config }: Props) {
  const { previewUrls } = useContext(CanvasPreviewContext);
  const cta = config as CallToActionSectionConfig;
  const layout = resolveLayout(cta._layout);

  const bg = layout.background;
  const tokens = THEME_TOKENS[layout.theme];
  const bgStyle = resolveBackgroundStyle(bg, previewUrls);
  const overlayClassName = overlayClass(bg);
  const hasBg = bg.type !== "none";

  const forceDarkText = bg.type === "none" || bg.type === "solid";
  const textColor = hasBg && !forceDarkText ? "text-white" : tokens.text;
  const subTextColor = hasBg && !forceDarkText ? "text-white/80" : tokens.subtext;

  const hasImagePlaceholder = bg.type === "image" && !previewUrls[bg.mediaAssetId];

  return (
    <div
      className={`relative min-h-[140px] flex flex-col justify-center px-6 py-7 ${hasBg ? "" : tokens.bg}`}
      style={bgStyle}
    >
      {overlayClassName && <div className={overlayClassName} aria-hidden />}

      <div className={`relative z-10 flex flex-col gap-2.5 ${alignClass(layout.hAlign)}`}>
        {/* Headline */}
        <h3 className={`text-lg font-bold leading-tight truncate max-w-[90%] ${textColor}`}>
          {(cta.title as string | undefined) || (
            <span className="opacity-40">Überschrift…</span>
          )}
        </h3>

        {/* Body */}
        {(cta.body as string | undefined) && (
          <p className={`text-xs leading-relaxed max-w-[80%] line-clamp-2 ${subTextColor}`}>
            {cta.body as string}
          </p>
        )}

        {/* Buttons */}
        {((cta.primaryLabel as string | undefined) || (cta.secondaryLabel as string | undefined)) && (
          <div className="mt-1 flex flex-wrap gap-2">
            {(cta.primaryLabel as string | undefined) && (
              <span className="inline-flex items-center rounded-lg bg-[var(--tenant-primary)] px-4 py-1.5 text-xs font-semibold text-white shadow-sm">
                {cta.primaryLabel as string}
              </span>
            )}
            {(cta.secondaryLabel as string | undefined) && (
              <span className="inline-flex items-center rounded-lg border border-current px-4 py-1.5 text-xs font-semibold opacity-80" style={{ color: hasBg && !forceDarkText ? "white" : "inherit" }}>
                {cta.secondaryLabel as string}
              </span>
            )}
          </div>
        )}
      </div>

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
