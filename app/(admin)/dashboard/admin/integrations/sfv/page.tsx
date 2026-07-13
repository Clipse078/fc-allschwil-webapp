/**
 * Admin → Integrationen → SFV / ClubCorner
 *
 * Tenant SFV integration configuration page.
 *
 * Server component: resolves the authenticated tenantId from session and loads
 * the current TenantSfvConfig to populate the client form without a loading flash.
 *
 * Client interactions (save, diagnostics) flow through the HTTP API:
 *   GET|POST /api/admin/integrations/sfv/config
 *   POST     /api/admin/integrations/sfv/diagnostics
 *
 * Permission: TENANTS_MANAGE.
 * Tenant isolation: tenantId resolved from session — never from URL or request body.
 */

import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import { ToastProvider } from "@/components/ui/ToastProvider";
import SfvTenantConfigPanel from "@/components/admin/integrations/SfvTenantConfigPanel";
import { getSfvConfigForTenant } from "@/lib/integrations/sfv/tenant-config-service";
import type { TenantSfvConfig } from "@/lib/integrations/sfv/tenant-config-types";

export const dynamic = "force-dynamic";

export default async function SfvIntegrationPage() {
  const session = await requireAnyPermission([PERMISSIONS.TENANTS_MANAGE]);

  const tenantId = session.user?.tenantId;
  if (!tenantId) notFound();

  let initialConfig: TenantSfvConfig | null = null;
  try {
    initialConfig = await getSfvConfigForTenant(tenantId);
  } catch {
    // Non-fatal: client form starts with empty values.
  }

  return (
    <ToastProvider>
      <div className="space-y-8">
        <AdminSectionHeader
          eyebrow="Integrationen"
          title="SFV / ClubCorner"
          description="Schweizerischer Fussballverband — Mandantenverbindung konfigurieren und Diagnose ausführen."
        />

        <SfvTenantConfigPanel initialConfig={initialConfig} />
      </div>
    </ToastProvider>
  );
}
