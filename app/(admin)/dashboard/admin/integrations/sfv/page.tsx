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
import SfvConfigDeleteButton from "@/components/admin/integrations/SfvConfigDeleteButton";
import { getSfvConfigForTenant } from "@/lib/integrations/sfv/tenant-config-service";
import type { TenantSfvConfig } from "@/lib/integrations/sfv/tenant-config-types";

export const dynamic = "force-dynamic";

export default async function SfvIntegrationPage() {
  const session = await requireAnyPermission([PERMISSIONS.TENANTS_MANAGE]);

  const tenantId = session.user?.activeTenantId;
  if (!tenantId) notFound();

  let initialConfig: TenantSfvConfig | null = null;
  try {
    initialConfig = await getSfvConfigForTenant(tenantId);
  } catch {
    // Non-fatal: client form starts with empty values.
  }

  return (
    <ToastProvider>
      <div className="max-w-2xl space-y-8">
        <AdminSectionHeader
          eyebrow="Integrationen"
          title="SFV / ClubCorner"
          description="Schweizerischer Fussballverband — Mandantenverbindung konfigurieren und Diagnose ausführen."
        />

        <SfvTenantConfigPanel initialConfig={initialConfig} />

        {initialConfig ? (
          <div className="rounded-lg border border-red-200 bg-red-50/50 p-5">
            <p className="mb-3 text-sm font-semibold text-red-800">Konfiguration entfernen</p>
            <p className="mb-4 text-sm text-red-700">
              Entfernt die Verbindungskonfiguration dauerhaft. Importierte Daten bleiben erhalten.
              Die Konfiguration kann jederzeit neu erstellt werden.
            </p>
            <SfvConfigDeleteButton
              clubId={initialConfig.clubId}
              defaultSeasonId={initialConfig.defaultSeasonId}
            />
          </div>
        ) : null}
      </div>
    </ToastProvider>
  );
}
