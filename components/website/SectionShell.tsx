"use client";

/**
 * components/website/SectionShell.tsx
 *
 * Flexible Layout System — shared section wrapper for every CMS block renderer.
 *
 * SectionShell consumes a SectionLayout and renders the outer <section>
 * element with all layout-related styles applied:
 *   - Background (solid / gradient / DAM image with overlay)
 *   - Theme (bg colour, text colour tokens applied via CSS class)
 *   - Vertical spacing (padding top/bottom)
 *   - Container width (max-width)
 *   - Horizontal padding
 *
 * Block-specific renderers receive children that fill the inner content area.
 * They are responsible only for their own column/grid/content layout — not
 * for spacing, background, or theme.
 *
 * One rendering path for: Homepage, Pages, Preview, Website.
 *
 * Usage:
 *   import SectionShell from "@/components/website/SectionShell";
 *
 *   <SectionShell layout={cfg._layout} previewMode blockType="splitContentCards">
 *     {innerContent}
 *   </SectionShell>
 */

import type { ReactNode } from "react";
import type { SectionLayout, SectionBackground } from "@/lib/cms/layout-types";
import {
  resolveLayout,
  GRADIENT_PRESETS,
  SPACING_TOP_MAP,
  SPACING_BOTTOM_MAP,
  WIDTH_MAP,
  THEME_TOKENS,
} from "@/lib/cms/layout-types";

// ---------------------------------------------------------------------------
// Background style resolver
// ---------------------------------------------------------------------------

function resolveBackgroundStyle(bg: SectionBackground): {
  className: string;
  style: React.CSSProperties;
  hasImageOverlay: boolean;
  imageOverlayClass: string;
} {
  if (!bg || bg.type === "none") {
    return { className: "", style: {}, hasImageOverlay: false, imageOverlayClass: "" };
  }

  if (bg.type === "solid") {
    return {
      className: "",
      style: { backgroundColor: bg.color ?? "#f3f4f6" },
      hasImageOverlay: false,
      imageOverlayClass: "",
    };
  }

  if (bg.type === "gradient") {
    const preset = GRADIENT_PRESETS.find((p) => p.value === bg.gradientPreset);
    return {
      className: "",
      style: { backgroundImage: preset?.style ?? "" },
      hasImageOverlay: false,
      imageOverlayClass: "",
    };
  }

  if (bg.type === "image") {
    const opacity = bg.overlayOpacity;
    let overlayClass = "";
    if (bg.overlay === "dark") {
      overlayClass = opacity !== undefined ? "" : "bg-black/50";
    } else if (bg.overlay === "light") {
      overlayClass = opacity !== undefined ? "" : "bg-white/40";
    }
    return {
      className: "relative",
      style: {},
      hasImageOverlay: true,
      imageOverlayClass: overlayClass,
    };
  }

  return { className: "", style: {}, hasImageOverlay: false, imageOverlayClass: "" };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type SectionShellProps = {
  /** Section layout config (from `_layout` in block config). */
  layout?: SectionLayout;
  /** When true, renders an admin preview border + block-type label. */
  previewMode?: boolean;
  /** Block type key for the preview label. */
  blockType?: string;
  /** Section content rendered inside the container. */
  children: ReactNode;
  /** Additional className applied to the outer <section>. */
  className?: string;
};

// ---------------------------------------------------------------------------
// SectionShell
// ---------------------------------------------------------------------------

export default function SectionShell({
  layout,
  previewMode = false,
  blockType,
  children,
  className = "",
}: SectionShellProps) {
  const resolved = resolveLayout(layout);

  const themeTokens = THEME_TOKENS[resolved.theme];
  const spacingTop = SPACING_TOP_MAP[resolved.spacingTop];
  const spacingBottom = SPACING_BOTTOM_MAP[resolved.spacingBottom];
  const widthClass = WIDTH_MAP[resolved.width];

  const { className: bgClass, style: bgStyle, hasImageOverlay, imageOverlayClass } =
    resolveBackgroundStyle(resolved.background);

  // Determine horizontal padding — use the spacingTop map for the X axis too,
  // but the dedicated PADDING_X_MAP lives in layout-types. For simplicity we
  // keep the classic responsive padding inline when not overridden.
  const paddingXClass = "px-4 sm:px-6 lg:px-8";

  const sectionClasses = [
    themeTokens.bg,
    spacingTop,
    spacingBottom,
    bgClass,
    "relative overflow-hidden",
    previewMode ? "ring-2 ring-blue-400 ring-inset" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={sectionClasses} style={bgStyle}>
      {/* Background image overlay */}
      {hasImageOverlay && resolved.background.type === "image" && resolved.background.mediaAssetId && (
        <div
          className={`absolute inset-0 ${imageOverlayClass}`}
          aria-hidden="true"
        />
      )}

      {/* Admin preview label */}
      {previewMode && blockType && (
        <div className="absolute left-2 top-2 z-10 rounded bg-blue-500 px-2 py-0.5 text-[10px] font-bold text-white">
          {blockType}
        </div>
      )}

      {/* Container */}
      <div className={`relative mx-auto ${paddingXClass} ${widthClass}`}>
        {children}
      </div>
    </section>
  );
}
