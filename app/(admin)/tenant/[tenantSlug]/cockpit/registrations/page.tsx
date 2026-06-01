import RegistrationsInboxTable from "@/components/admin/registrations/RegistrationsInboxTable";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import { hasPermission } from "@/lib/permissions/has-permission";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { listRegistrationsForTenant } from "@/lib/registrations/queries";

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
  const registrations = await listRegistrationsForTenant(tenantSlug);
  const canEdit = hasPermission(session, PERMISSIONS.REGISTRATIONS_EDIT);

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Cockpit"
        title="Registration Inbox"
        description="Eingehende Anmeldungen, Anfragen und Probetrainings — nach Status gefiltert und mit automatischer Routing-Vorschau."
      />

      <RegistrationsInboxTable
        tenantSlug={tenantSlug}
        initialRegistrations={registrations}
        canEdit={canEdit}
      />
    </div>
  );
}
