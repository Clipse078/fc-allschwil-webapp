/**
 * TenantLogo — Slice 10.9
 *
 * Canonical logo rendering component for all surfaces (sidebar, cockpit header, etc.).
 *
 * ─── Rendering logic ─────────────────────────────────────────────────────────
 *
 * When logoUrl is a valid URL/path → renders <img> with the tenant logo.
 * Otherwise → renders the platform fallback (Trophy icon on --tenant-primary bg).
 *
 * ─── No duplication ──────────────────────────────────────────────────────────
 *
 * All surfaces that need a tenant logo MUST use this component.
 * No inline logo rendering elsewhere in the codebase.
 *
 * ─── Client safety ───────────────────────────────────────────────────────────
 *
 * This is a client component ("use client") so it can be used inside
 * existing client components (AdminSidebar) without wrapping.
 */

"use client";

import { Trophy } from "lucide-react";
import { isValidLogoUrl } from "@/lib/tenant-runtime/branding-validation";

type TenantLogoProps = {
  /** Raw logoUrl from tenant config. Null/invalid → fallback icon. */
  logoUrl: string | null | undefined;
  /** Display size in pixels (applies to both width and height). Default: 32 */
  size?: number;
  /** Alt text for the logo image. Default: "Club logo" */
  alt?: string;
  /** Additional className for the wrapper element. */
  className?: string;
};

/**
 * Renders the tenant logo when logoUrl is valid, otherwise the platform fallback icon.
 *
 * @example
 *   <TenantLogo logoUrl={ctx?.logoUrl} size={32} />
 */
export default function TenantLogo({
  logoUrl,
  size = 32,
  alt = "Club logo",
  className,
}: TenantLogoProps) {
  const hasLogo = isValidLogoUrl(logoUrl);
  const iconSize = Math.round(size * 0.44); // scale inner icon proportionally

  if (hasLogo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl!}
        alt={alt}
        width={size}
        height={size}
        className={className}
        style={{
          width: size,
          height: size,
          objectFit: "contain",
          borderRadius: 6,
          display: "block",
        }}
        onError={(e) => {
          // On load failure, hide the broken image — parent can render fallback.
          // We swap to a data URI transparent pixel rather than removing the element.
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 6,
        background: "var(--tenant-primary)",
        color: "#fff",
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      <Trophy style={{ width: iconSize, height: iconSize }} />
    </div>
  );
}
