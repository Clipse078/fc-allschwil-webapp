"use client";

import { useState } from "react";
import { Shield } from "lucide-react";
import { cn } from "@/lib/cn";

export type SportingTeamLogoProps = {
  logoUrl: string | null | undefined;
  size?: "sm" | "md";
  className?: string;
};

const SIZE_CLASSES: Record<NonNullable<SportingTeamLogoProps["size"]>, string> = {
  sm: "h-6 w-6",
  md: "h-7 w-7",
};

const ICON_SIZE_CLASSES: Record<
  NonNullable<SportingTeamLogoProps["size"]>,
  string
> = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
};

const DATA_IMAGE_URL =
  /^data:image\/(?:avif|gif|jpeg|png|svg\+xml|webp);base64,[a-z0-9+/=\s]+$/i;

export function normalizeSportingLogoUrl(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim() ?? "";

  if (normalized === "") {
    return null;
  }

  if (normalized.startsWith("/") && !normalized.startsWith("//")) {
    return normalized;
  }

  if (DATA_IMAGE_URL.test(normalized)) {
    return normalized;
  }

  try {
    return new URL(normalized).protocol === "https:" ? normalized : null;
  } catch {
    return null;
  }
}

export default function SportingTeamLogo({
  logoUrl,
  size = "md",
  className,
}: SportingTeamLogoProps) {
  const normalizedLogoUrl = normalizeSportingLogoUrl(logoUrl);
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);
  const sizeClass = SIZE_CLASSES[size];
  const sharedClassName = cn(
    sizeClass,
    "shrink-0 object-contain",
    className,
  );

  if (normalizedLogoUrl && failedLogoUrl !== normalizedLogoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- canonical crests may be tenant paths, Vercel Blob URLs, or validated data URIs.
      <img
        src={normalizedLogoUrl}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        className={sharedClassName}
        onError={() => setFailedLogoUrl(normalizedLogoUrl)}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        sizeClass,
        "flex shrink-0 items-center justify-center text-[var(--border-strong)]",
        className,
      )}
    >
      <Shield className={ICON_SIZE_CLASSES[size]} />
    </span>
  );
}
