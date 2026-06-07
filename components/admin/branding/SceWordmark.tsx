/**
 * SceWordmark — Sprint 4: Tenant Branding System
 *
 * Logo integration architecture for the SportClubEvo platform.
 *
 * ─── Integration Points ──────────────────────────────────────────────────────
 *
 * Renders the [SCE Symbol] + SportClubEvo wordmark in two modes:
 *
 *   • platform — Shows the SportClubEvo platform icon + name (no tenant)
 *   • tenant   — Shows the tenant logo (via TenantLogo) + tenant name
 *                with a subtle "SportClubEvo" platform attribution below
 *
 * ─── Logo Asset Architecture ─────────────────────────────────────────────────
 *
 * When no tenant logo is configured:
 *   The SCE Symbol is rendered as a rounded square with the tenant primary
 *   color background and a Trophy icon. This is the canonical platform fallback.
 *
 * When a tenant logo URL is set:
 *   The <img> tag renders the tenant logo (via TenantLogo).
 *   A broken-image fallback reverts to the platform icon automatically.
 *
 * Future logo asset readiness:
 *   When a final SportClubEvo SVG logo becomes available, replace the Trophy
 *   fallback in TenantLogo with:
 *     <img src="/brand/sce-symbol.svg" alt="SportClubEvo" />
 *   No other code changes required — all surfaces share this component.
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   // Platform mode (e.g. global login page, platform header)
 *   <SceWordmark size={32} />
 *
 *   // Tenant mode (e.g. admin sidebar brand header)
 *   <SceWordmark size={32} tenantName={ctx.name} logoUrl={ctx.logoUrl} collapsed={isCollapsed} />
 */

import TenantLogo from "./TenantLogo";

type SceWordmarkProps = {
  /** Symbol/logo size in pixels. Default: 32 */
  size?: number;
  /** Tenant display name. When provided, renders in tenant mode. */
  tenantName?: string;
  /** Raw logoUrl from tenant config. Null/invalid → fallback icon. */
  logoUrl?: string | null;
  /** When true, hides the text portion (collapsed sidebar state). */
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
    <div className="flex items-center gap-2.5 min-w-0">
      {/* Symbol: tenant logo OR platform icon */}
      <TenantLogo
        logoUrl={logoUrl}
        size={size}
        alt={tenantName ? `${tenantName} logo` : "SportClubEvo"}
      />

      {/* Text: platform label + tenant name */}
      {!collapsed && (
        <div className="min-w-0 flex-1">
          <p
            className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] leading-none"
            style={{ color: "var(--muted)" }}
          >
            SportClubEvo
          </p>
          {hasTenant ? (
            <p
              className="mt-0.5 truncate text-[0.88rem] font-bold leading-tight tracking-tight"
              style={{ color: "var(--tenant-primary)" }}
            >
              {tenantName}
            </p>
          ) : (
            <p
              className="mt-0.5 text-[0.88rem] font-semibold leading-tight tracking-tight"
              style={{ color: "var(--foreground)" }}
            >
              Club Management
            </p>
          )}
        </div>
      )}
    </div>
  );
}
