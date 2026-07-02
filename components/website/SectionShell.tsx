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

function resolveBackgroundStyle(
  bg: SectionBackground,
  backgroundImageUrl?: string,
  backgroundPositionOverride?: string,
): {
  className: string;
  style: React.CSSProperties;
  hasImageOverlay: boolean;
  imageOverlayClass: string;
  imageOverlayStyle: React.CSSProperties;
} {
  if (!bg || bg.type === "none") {
    return { className: "", style: {}, hasImageOverlay: false, imageOverlayClass: "", imageOverlayStyle: {} };
  }

  if (bg.type === "solid") {
    return {
      className: "",
      style: { backgroundColor: bg.color ?? "#f3f4f6" },
      hasImageOverlay: false,
      imageOverlayClass: "",
      imageOverlayStyle: {},
    };
  }

  if (bg.type === "gradient") {
    const preset = GRADIENT_PRESETS.find((p) => p.value === bg.gradientPreset);
    return {
      className: "",
      style: { backgroundImage: preset?.style ?? "" },
      hasImageOverlay: false,
      imageOverlayClass: "",
      imageOverlayStyle: {},
    };
  }

    if (bg.type === "image") {
    // Overlay class logic is unchanged from the original — only backgroundImageUrl
    // support has been added. The overlayOpacity path intentionally preserves the
    // original behaviour (empty overlayClass when opacity is set) so that existing
    // public sections are not visually affected.
    const opacity = bg.overlayOpacity;
    let overlayClass = "";
    if (bg.overlay === "dark") {
      overlayClass = opacity !== undefined ? "" : "bg-black/50";
    } else if (bg.overlay === "light") {
      overlayClass = opacity !== undefined ? "" : "bg-white/40";
    }

    // When a resolved image URL is provided (admin canvas preview only), apply it
    // as backgroundImage. Public callers never pass backgroundImageUrl so bgStyle
    // is {} for them — identical to the original code.
    //
    // backgroundPositionOverride is also admin-only (focal-point drag, Slice K).
    // It only takes effect when backgroundImageUrl is also provided, so public
    // website rendering is unaffected.
    const imageStyle: React.CSSProperties = backgroundImageUrl
      ? {
          backgroundImage: `url(${backgroundImageUrl})`,
          backgroundSize: "cover",
          backgroundPosition: backgroundPositionOverride ?? "center",
        }
      : {};

    return {
      className: "relative",
      style: imageStyle,
      hasImageOverlay: true,
      imageOverlayClass: overlayClass,
      imageOverlayStyle: {}, // always empty — inline overlay style is admin-canvas-only
    };
  }

  return { className: "", style: {}, hasImageOverlay: false, imageOverlayClass: "", imageOverlayStyle: {} };
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
  /**
   * Optional resolved background image URL (admin canvas preview only).
   * When provided with a `_layout.background.type === "image"` config, renders
   * the image as a CSS backgroundImage. Callers (e.g. CanvasBlockPreview) fetch
   * the URL from `/api/media/[id]` and pass it here so the canvas preview shows
   * the actual background image without modifying the stored config.
   * Public website renderers do not pass this prop and are unaffected.
   */
  backgroundImageUrl?: string;
  /**
   * Admin canvas only. Overrides the CSS background-position value for
   * focal-point drag preview (Slice K). Only takes effect when
   * backgroundImageUrl is also provided. Public website callers never set
   * this prop. See FocalPointControl.tsx for persistence gap notes.
   */
  backgroundPositionOverride?: string;
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
  backgroundImageUrl,
  backgroundPositionOverride,
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

  const { className: bgClass, style: bgStyle, hasImageOverlay, imageOverlayClass, imageOverlayStyle } =
    resolveBackgroundStyle(resolved.background, backgroundImageUrl, backgroundPositionOverride);

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
      {/* Background image overlay — rendered when bg type is "image" */}
      {hasImageOverlay && resolved.background.type === "image" && (
        <div
          className={`absolute inset-0 ${imageOverlayClass}`}
          style={imageOverlayStyle}
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
