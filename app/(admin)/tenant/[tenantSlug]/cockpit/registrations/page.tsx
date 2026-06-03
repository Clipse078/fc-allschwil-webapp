import RegistrationsInboxTable from "@/components/admin/registrations/RegistrationsInboxTable";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import { hasPermission } from "@/lib/permissions/has-permission";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { listRegistrationsForTenant } from "@/lib/registrations/queries";
import { getCurrentTenantContext } from "@/lib/tenants/context";
import { getCurrentSeasonLabel } from "@/lib/tenants/season-boundary";

type Props = {
  params: Promise<{
    tenantSlug: string;
  }>;
};

export default async function TenantRegistrationsPage({ params }: Props) {
  const session = await requireAnyPermission([
    PERMISSIONS.REGISTRATIONS_VIEW,
    PERMISSIONS.REGISTRATIONS_EDIT,
  ]);
  const { tenantSlug } = await params;

  const [registrations, ctx] = await Promise.all([
    listRegistrationsForTenant(tenantSlug),
    getCurrentTenantContext(tenantSlug),
  ]);

  const canEdit = hasPermission(session, PERMISSIONS.REGISTRATIONS_EDIT);

  // Build a context-aware description for the header.
  const seasonLabel = ctx ? getCurrentSeasonLabel(ctx) : null;
  const tenantLabel = ctx?.name ?? tenantSlug;
  const description = seasonLabel
    ? `${tenantLabel} — Saison ${seasonLabel} — Eingehende Anmeldungen, Anfragen und Probetrainings.`
    : "Eingehende Anmeldungen, Anfragen und Probetrainings — nach Status gefiltert und mit automatischer Routing-Vorschau.";

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Cockpit"
        title="Registration Inbox"
        description={description}
      />

      <RegistrationsInboxTable
        tenantSlug={tenantSlug}
        initialRegistrations={registrations}
        canEdit={canEdit}
      />
    </div>
  );
}
