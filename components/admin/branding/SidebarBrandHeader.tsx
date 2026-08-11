/**
 * SidebarBrandHeader — DASHBOARD-SHELL-UX-01
 *
 * Tenant-first sidebar header. The tenant identity (crest + name) is the
 * dominant visual element — the tenant is the primary "brand" of its own
 * workspace. SportClubEvo platform branding moved to a subtle footer badge
 * (see PoweredByBadge) so it never competes with the tenant identity.
 *
 * Falls back to the platform name ("SportClubEvo") when no tenant is
 * active (e.g. a platform-only session with no tenant membership) — the
 * fallback icon in TenantLogo renders in that case too.
 */

import TenantLogo from "./TenantLogo";
import { cn } from "@/lib/cn";

type SidebarBrandHeaderProps = {
  tenantName: string;
  logoUrl?: string | null;
  collapsed?: boolean;
};

export default function SidebarBrandHeader({
  tenantName,
  logoUrl,
  collapsed = false,
}: SidebarBrandHeaderProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2.5",
        collapsed ? "justify-center" : "justify-start",
      )}
    >
      <TenantLogo
        logoUrl={logoUrl}
        size={collapsed ? 30 : 34}
        alt={`${tenantName} Logo`}
      />

      {!collapsed && (
        <p
          className="truncate text-[0.9375rem] font-bold leading-tight tracking-tight"
          style={{ color: "var(--foreground)" }}
        >
          {tenantName}
        </p>
      )}
    </div>
  );
}
