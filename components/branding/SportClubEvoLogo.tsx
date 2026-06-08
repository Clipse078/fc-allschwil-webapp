/**
 * SportClubEvoLogo — Single source of truth for platform branding.
 *
 * Renders /public/images/branding/sportclubevo_logo.png via next/image,
 * preserving the image's natural aspect ratio at the requested size.
 *
 * ─── Sizes ────────────────────────────────────────────────────────────────
 *
 *   sm  30px height — sidebar (expanded or collapsed icon)
 *   md  44px height — login mobile / compact headers
 *   lg  56px height — login desktop / large headers
 *
 * ─── iconOnly ─────────────────────────────────────────────────────────────
 *
 *   When true, renders a square container that clips the image to show only
 *   the aperture icon on the left side of the lockup. Use this for the
 *   collapsed sidebar state.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────
 *
 *   <SportClubEvoLogo size="lg" />                    // full lockup
 *   <SportClubEvoLogo size="sm" iconOnly />           // icon-only square
 */

import Image from "next/image";

const LOGO_NATURAL_WIDTH = 1536;
const LOGO_NATURAL_HEIGHT = 1024;

const HEIGHT_PX = {
  sm: 30,
  md: 44,
  lg: 56,
} as const;

type Size = keyof typeof HEIGHT_PX;

type SportClubEvoLogoProps = {
  /** Named height preset. Default: "md" */
  size?: Size;
  /**
   * When true, crops the image to a square showing only the aperture icon.
   * Intended for the collapsed sidebar state.
   */
  iconOnly?: boolean;
  className?: string;
};

export default function SportClubEvoLogo({
  size = "md",
  iconOnly = false,
  className,
}: SportClubEvoLogoProps) {
  const h = HEIGHT_PX[size];
  // Natural width scaled to the display height
  const w = Math.round(h * (LOGO_NATURAL_WIDTH / LOGO_NATURAL_HEIGHT));

  if (iconOnly) {
    // Zoom in on the aperture icon using CSS background-image for reliable cropping.
    //
    // Measured pixel positions in the 1536×1024 source image:
    //   Icon x: 64–380 (center 222 = 14.45% of width)
    //   Icon y: 333–631 (center 482 = 47.07% of height)
    //   Text starts at x=400 (26.04% of width)
    //
    // ICON_SCALE=3.5 ensures the icon fills the container width and the text
    // remains out of frame (≥3px safety margin at all sizes).
    const ICON_SCALE = 3.5;
    const ICON_CENTER_X_FRAC = 0.1445; // 222 / 1536
    const ICON_CENTER_Y_FRAC = 0.4707; // 482 / 1024
    const renderH = Math.round(h * ICON_SCALE);
    const renderW = Math.round(renderH * (LOGO_NATURAL_WIDTH / LOGO_NATURAL_HEIGHT));
    // Center the icon within the square container
    const bgPosX = Math.round(h / 2 - renderW * ICON_CENTER_X_FRAC);
    const bgPosY = Math.round(h / 2 - renderH * ICON_CENTER_Y_FRAC);

    return (
      <div
        role="img"
        aria-label="SportClubEvo"
        style={{
          width: h,
          height: h,
          flexShrink: 0,
          backgroundImage: "url('/images/branding/sportclubevo_logo.png')",
          backgroundSize: `${renderW}px ${renderH}px`,
          backgroundPosition: `${bgPosX}px ${bgPosY}px`,
          backgroundRepeat: "no-repeat",
        }}
        className={className}
      />
    );
  }

  return (
    <Image
      src="/images/branding/sportclubevo_logo.png"
      alt="SportClubEvo"
      width={LOGO_NATURAL_WIDTH}
      height={LOGO_NATURAL_HEIGHT}
      style={{ height: h, width: "auto", flexShrink: 0, display: "block" }}
      className={className}
      priority
    />
  );
}
