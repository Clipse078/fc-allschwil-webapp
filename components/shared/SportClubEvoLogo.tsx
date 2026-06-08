/**
 * SportClubEvoLogo — Shared platform logo component
 *
 * Renders the SportClubEvo platform logo PNG.
 * Used in: sidebar brand header (SceWordmark), login screen (LoginForm).
 *
 * Aspect ratio is always preserved. Pass `height` to scale; width adjusts automatically.
 */

type SportClubEvoLogoProps = {
  /** Logo height in pixels. Width scales proportionally. Default: 32 */
  height?: number;
  /** Additional className applied to the <img> element. */
  className?: string;
};

export default function SportClubEvoLogo({
  height = 32,
  className,
}: SportClubEvoLogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/images/branding/sportclubevo_logo.png"
      alt="SportClubEvo"
      height={height}
      className={className}
      style={{ height, width: "auto", display: "block" }}
    />
  );
}
