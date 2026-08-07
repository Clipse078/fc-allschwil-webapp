import { Shield } from "lucide-react";
import { cn } from "@/lib/cn";

type ClubLogoProps = {
  logoUrl: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZE_CLASSES: Record<NonNullable<ClubLogoProps["size"]>, string> = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-16 w-16",
};

const ICON_SIZE_CLASSES: Record<NonNullable<ClubLogoProps["size"]>, string> = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-7 w-7",
};

/**
 * ClubLogo
 *
 * Renders a club/team crest, or a clean placeholder (never a broken <img>)
 * when no logo is set — CLUB-DIRECTORY-01 LOGOS requirement.
 *
 * Callers pass the already-resolved effective logo URL (team override →
 * club fallback → null), see lib/club-directory/logo.ts.
 */
export function ClubLogo({ logoUrl, name, size = "md", className }: ClubLogoProps) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- external, tenant-supplied crest URLs (Vercel Blob or provider CDN), not a static local asset.
      <img
        src={logoUrl}
        alt={`Logo ${name}`}
        className={cn(
          SIZE_CLASSES[size],
          "shrink-0 rounded-lg border border-[var(--border)] bg-white object-contain p-1",
          className,
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        SIZE_CLASSES[size],
        "flex shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]",
        className,
      )}
      aria-hidden="true"
    >
      <Shield className={ICON_SIZE_CLASSES[size]} />
    </div>
  );
}
