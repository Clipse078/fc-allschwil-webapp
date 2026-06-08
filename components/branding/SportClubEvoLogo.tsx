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
    // Clip to a square container showing only the left (aperture icon) portion
    // of the horizontal lockup. The image renders at full proportional width
    // and the container clips everything past the first `h` pixels.
    return (
      <div
        style={{ width: h, height: h, overflow: "hidden", flexShrink: 0 }}
        className={className}
      >
        <Image
          src="/images/branding/sportclubevo_logo.png"
          alt="SportClubEvo"
          width={LOGO_NATURAL_WIDTH}
          height={LOGO_NATURAL_HEIGHT}
          style={{ display: "block", height: h, width: w, maxWidth: "none" }}
          priority
        />
      </div>
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
