/**
 * SceWordmark — Sprint 7: Screen 3 Premium SaaS Branding
 *
 * Renders the SportClubEvo platform wordmark with the new two-tone typography:
 *   [SCE Icon] SportClub(black) + Evo(orange)
 *
 * ─── Modes ───────────────────────────────────────────────────────────────────
 *
 *   • platform — SCE icon + "SportClubEvo" wordmark only
 *   • tenant   — SCE icon + "SportClubEvo" wordmark + tenant club selector row
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   <SceWordmark size={32} />
 *   <SceWordmark size={32} tenantName="FC Allschwil" logoUrl={ctx.logoUrl} collapsed={false} />
 */

import TenantLogo from "./TenantLogo";
import SportClubEvoLogo from "@/components/shared/SportClubEvoLogo";

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
      {/* Platform logo row — PNG logo; in collapsed mode clip to icon-width only */}
      <div className="flex items-center min-w-0">
        {collapsed ? (
          <div style={{ width: size, height: size, overflow: "hidden", flexShrink: 0 }}>
            <SportClubEvoLogo height={size} />
          </div>
        ) : (
          <SportClubEvoLogo height={size} />
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
