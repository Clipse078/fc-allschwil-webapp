/**
 * Tenant Cockpit Layout — Slice 10.8
 *
 * Canonical injection point for tenant-specific CSS branding variables
 * within the cockpit content area.
 *
 * ─── Position in the layout hierarchy ──────────────────────────────────────
 *
 *   app/layout.tsx                       (root — fonts, globals.css)
 *   └─ app/(admin)/layout.tsx            (admin shell — sidebar, topnav,
 *                                         DEFAULT tenant CSS vars for the shell)
 *      └─ app/(admin)/tenant/[tenantSlug]/layout.tsx  ← THIS FILE
 *         └─ cockpit/registrations/page.tsx  (and other cockpit pages)
 *
 * ─── Why two levels of CSS var injection? ───────────────────────────────────
 *
 * The admin shell layout injects branding for the PLATFORM DEFAULT tenant
 * (DEFAULT_TENANT_KEY). This keeps the sidebar, top nav, and shell chrome
 * consistently branded for the platform administrator.
 *
 * This layout overrides --tenant-primary / --tenant-secondary with the
 * SPECIFIC tenant's branding (from the URL tenantSlug) — scoped to the
 * cockpit content area only. The shell chrome above is unaffected.
 *
 * For the current single-tenant setup (only fc-allschwil), both levels
 * produce identical values, so there is no visual difference. In a
 * multi-tenant future, cockpit pages for a different tenant will correctly
 * display that tenant's brand colors.
 *
 * ─── No duplication ─────────────────────────────────────────────────────────
 *
 * generateTenantCssVars() is called once here for the cockpit scope.
 * No page inside this layout calls generateTenantCssVars() or applies
 * inline tenant color calculations — branding is inherited from this layout.
 *
 * ─── Single source of truth ─────────────────────────────────────────────────
 *
 *   lib/tenant-runtime/branding.ts  →  resolveTenantBranding() + PLATFORM_BRANDING
 *   lib/tenant-runtime/theme.ts     →  generateTenantCssVars()
 */

import type { ReactNode } from "react";
import { getCurrentTenantContext } from "@/lib/tenants/context";
import { generateTenantCssVars } from "@/lib/tenant-runtime/theme";

type Props = {
  children: ReactNode;
  params: Promise<{ tenantSlug: string }>;
};

export default async function TenantCockpitLayout({ children, params }: Props) {
  const { tenantSlug } = await params;

  // Fetch the specific tenant's context (branding + formatting config).
  // generateTenantCssVars() applies PLATFORM_BRANDING defaults when null,
  // so this is safe even if the tenant has no branding configured.
  const ctx = await getCurrentTenantContext(tenantSlug);
  const tenantCssVars = generateTenantCssVars(ctx);

  // Minimal passthrough wrapper: no added visual structure, no UX change.
  // The div only exists to scope --tenant-primary / --tenant-secondary
  // to this tenant's cockpit content, overriding the outer admin layout's
  // default-tenant values for all descendant elements.
  return (
    <div style={tenantCssVars as React.CSSProperties}>
      {children}
    </div>
  );
}
