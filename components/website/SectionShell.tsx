"use client";

/**
 * components/website/SectionShell.tsx
 *
 * Flexible Layout System — shared section wrapper for every CMS block renderer.
 *
 * PURPOSE
 *   SectionShell is the single rendering path for all CMS section layout.
 *   It consumes a `SectionLayout` (from `config._layout`) and renders the
 *   outer `<section>` element with all layout-related styles applied:
 *     - Background (solid / gradient / DAM image with overlay)
 *     - Theme (bg colour, text colour tokens via THEME_TOKENS)
 *     - Vertical spacing (padding top/bottom from SPACING_TOP/BOTTOM_MAP)
 *     - Container width (max-width from WIDTH_MAP or designSystem.sectionWidths)
 *     - Horizontal padding (responsive px-* utilities)
 *
 *   When `designSystem` is provided, section width tokens from the Design System
 *   Manager override the Tailwind max-width classes, allowing tenant-configured
 *   widths to flow through to the renderer.
 *
 * ONE RENDERING PATH
 *   Used identically for: Homepage, Pages, Admin Preview, Public Website.
 *   No separate layout implementations exist per surface.
 *
 * PUBLIC WEBSITE USAGE
 *   This component is part of the public-website integration surface.
 *   The public website (separate Next.js project) MUST copy or import this
 *   component and use it to wrap every rendered CMS section.
 *
 *   Rendering pattern for the public website:
 *
 *     import SectionShell from "@/components/website/SectionShell";
 *     import { resolveLayout } from "@/lib/website/integration-contract";
 *
 *     function CmsSection({ section }) {
 *       const layout = resolveLayout(section.config._layout);
 *       return (
 *         <SectionShell layout={layout} blockType={section.type}>
 *           <YourBlockContent config={section.config} />
 *         </SectionShell>
 *       );
 *     }
 *
 * BACKWARD COMPATIBILITY
 *   `splitContentCards` sections without `_layout` (pre-migration data) are
 *   handled by `resolveBlockLayout()` in SplitContentCardsRenderer, which
 *   reads legacy `config.style` + `config.background` and converts them.
 *   SectionShell itself is not aware of legacy fields — it only consumes
 *   SectionLayout. Resolving the fallback is the block renderer's responsibility.
 *
 * DESIGN SYSTEM INTEGRATION (CMS V4)
 *   Width, spacing and padding are resolved from the Design System token maps
 *   (WIDTH_MAP, SPACING_*_MAP, PADDING_X_MAP in layout-types.ts).
 *   When `designSystem` is passed, sectionWidths tokens override the default
 *   Tailwind max-width classes, allowing tenant-configured widths to apply
 *   globally without requiring individual block updates.
 *   Renderers should never hardcode max-width, spacing or padding classes —
 *   those are controlled by the section layout and Design System.
 *
 * PROPS
 *   layout      — SectionLayout from `config._layout` (use resolveLayout() to
 *                 apply defaults before passing here).
 *   previewMode — adds admin border + block-type label overlay.
 *   blockType   — block type key string for the preview label.
 *   children    — inner section content rendered inside the container.
 *   className   — extra className applied to the outer <section>.
 *   designSystem — optional resolved design system tokens (CMS V4).
 */

import type { ReactNode } from "react";
import type { SectionLayout, SectionBackground } from "@/lib/cms/layout-types";
import {
  resolveLayout,
  GRADIENT_PRESETS,
  SPACING_TOP_MAP,
  SPACING_BOTTOM_MAP,
  WIDTH_MAP,
  PADDING_X_MAP,
  THEME_TOKENS,
} from "@/lib/cms/layout-types";
import type { ResolvedDesignSystem } from "@/lib/website/design-system-types";

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
  /**
   * Optional resolved design system tokens (CMS V4).
   * When provided, sectionWidths tokens override the Tailwind max-width classes,
   * allowing tenant-configured widths to apply globally.
   */
  designSystem?: ResolvedDesignSystem;
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
  designSystem,
}: SectionShellProps) {
  const resolved = resolveLayout(layout);

  const themeTokens = THEME_TOKENS[resolved.theme];
  const spacingTop = SPACING_TOP_MAP[resolved.spacingTop];
  const spacingBottom = SPACING_BOTTOM_MAP[resolved.spacingBottom];

  // When design system tokens are available, use the tenant-configured width
  // value as an inline maxWidth style instead of a Tailwind class.
  const dsWidth = designSystem?.sectionWidths?.[resolved.width];
  const widthClass = dsWidth ? "" : WIDTH_MAP[resolved.width];
  const widthStyle: React.CSSProperties = dsWidth && dsWidth !== "none"
    ? { maxWidth: dsWidth }
    : {};

  const { className: bgClass, style: bgStyle, hasImageOverlay, imageOverlayClass } =
    resolveBackgroundStyle(resolved.background);

  // Horizontal padding resolved from Design System via PADDING_X_MAP.
  // Falls back to "md" when paddingX is not set (covered by resolveLayout defaults).
  const paddingXClass = PADDING_X_MAP[resolved.paddingX];

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
      <div
        className={`relative mx-auto ${paddingXClass} ${widthClass}`}
        style={widthStyle}
      >
        {children}
      </div>
    </section>
  );
}
