import { Shield } from "lucide-react";
import { cn } from "@/lib/cn";

type ClubLogoProps = {
  logoUrl: string | null;
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  /**
   * When true, renders the logo without border, background, or padding.
   * Use for MatchCard and featured contexts where the crest floats directly
   * in the layout — no artificial avatar chrome around it.
   * Preserves transparent PNG/SVG; never crops or masks.
   * The fallback placeholder also renders without border/bg in bare mode.
   */
  bare?: boolean;
  className?: string;
};

const SIZE_CLASSES: Record<NonNullable<ClubLogoProps["size"]>, string> = {
  sm: "h-8 w-8",    // 32px — compact list rows, directory thumbnails
  md: "h-10 w-10",  // 40px — compact match cards
  lg: "h-16 w-16",  // 64px — comfortable match cards, detail headers
  xl: "h-20 w-20",  // 80px — inspector, featured/hero display
};

const ICON_SIZE_CLASSES: Record<NonNullable<ClubLogoProps["size"]>, string> = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-7 w-7",
  xl: "h-9 w-9",
};

/**
 * ClubLogo
 *
 * Renders a club/team crest, or a clean placeholder (never a broken <img>)
 * when no logo is set — CLUB-DIRECTORY-01 LOGOS requirement.
 *
 * Callers pass the already-resolved effective logo URL (team override →
 * club fallback → null), see lib/club-directory/logo.ts.
 *
 * MATCHCENTER-UX-03: the `bare` prop removes border/bg/padding so the crest
 * renders as a clean visual element without avatar chrome — mandatory for
 * dominant match-card logo presentation.
 */
export function ClubLogo({ logoUrl, name, size = "md", bare = false, className }: ClubLogoProps) {
  const sizeClass = SIZE_CLASSES[size];
  const iconSizeClass = ICON_SIZE_CLASSES[size];

  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- external, tenant-supplied crest URLs (Vercel Blob or provider CDN), not a static local asset.
      <img
        src={logoUrl}
        alt={`Logo ${name}`}
        className={cn(
          sizeClass,
          "shrink-0 object-contain",
          !bare && "rounded-lg border border-[var(--border)] bg-white p-1",
          className,
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        sizeClass,
        "flex shrink-0 items-center justify-center",
        !bare && "rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]",
        bare && "text-[var(--border-strong)]",
        className,
      )}
      aria-hidden="true"
    >
      <Shield className={iconSizeClass} />
    </div>
  );
}
