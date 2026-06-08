/**
 * SceWordmark — Sprint 7: Screen 3 Premium SaaS Branding
 *
 * Renders the SportClubEvo platform wordmark using the final logo asset.
 *
 * ─── Modes ───────────────────────────────────────────────────────────────────
 *
 *   • platform — SCE logo icon + "SportClubEvo" wordmark only
 *   • tenant   — SCE logo icon + "SportClubEvo" wordmark + tenant club selector row
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   <SceWordmark size={32} />
 *   <SceWordmark size={32} tenantName="FC Allschwil" logoUrl={ctx.logoUrl} collapsed={false} />
 */

import Image from "next/image";
import TenantLogo from "./TenantLogo";

type SceWordmarkProps = {
  /** Symbol/logo size in pixels. Default: 32 */
  size?: number;
  /** Tenant display name. When provided, renders the club selector row. */
  tenantName?: string;
  /** Raw logoUrl from tenant config. Null/invalid → fallback icon. */
  logoUrl?: string | null;
  /** When true, hides all text (collapsed sidebar state). */
  collapsed?: boolean;
};

export default function SceWordmark({
  size = 32,
  tenantName,
  logoUrl,
  collapsed = false,
}: SceWordmarkProps) {
  const hasTenant = !!tenantName;

  return (
    <div className="flex flex-col gap-2 min-w-0 w-full">
      {/* Platform wordmark row: [SCE logo] SportClubEvo */}
      <div className="flex items-center gap-2 min-w-0">
        {/* SCE platform icon — real logo asset */}
        <Image
          src="/images/branding/sportclubevo_logo.png"
          alt="SportClubEvo"
          width={size}
          height={size}
          style={{ width: size, height: size, objectFit: "contain", flexShrink: 0 }}
          priority
        />

        {!collapsed && (
          <div className="min-w-0 flex-1">
            {/* Two-tone wordmark: SportClub (dark) + Evo (orange) */}
            <p className="text-[0.95rem] font-bold leading-none tracking-tight">
              <span className="text-[#111827]">SportClub</span>
              <span style={{ color: "#FF6A00" }}>Evo</span>
            </p>
          </div>
        )}
      </div>

      {/* Club selector row — shown only in tenant mode when not collapsed */}
      {hasTenant && !collapsed && (
        <div
          className="flex items-center gap-2 rounded-[10px] px-2 py-1.5 min-w-0"
          style={{
            background: "color-mix(in srgb, var(--tenant-primary) 6%, transparent)",
            border: "1px solid color-mix(in srgb, var(--tenant-primary) 12%, transparent)",
          }}
        >
          <TenantLogo
            logoUrl={logoUrl}
            size={24}
            alt={`${tenantName} logo`}
          />
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-[0.8rem] font-semibold leading-tight"
              style={{ color: "var(--foreground)" }}
            >
              {tenantName}
            </p>
          </div>
        </div>
      )}

      {/* Collapsed tenant indicator */}
      {hasTenant && collapsed && (
        <TenantLogo
          logoUrl={logoUrl}
          size={size}
          alt={`${tenantName} logo`}
        />
      )}
    </div>
  );
}
