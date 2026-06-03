import { notFound } from "next/navigation";
import RegistrationDetailCard from "@/components/admin/registrations/RegistrationDetailCard";
import { hasPermission } from "@/lib/permissions/has-permission";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getRegistrationForTenant } from "@/lib/registrations/queries";
import { getCurrentTenantContext } from "@/lib/tenants/context";

type Props = {
  params: Promise<{
    tenantSlug: string;
    registrationId: string;
  }>;
};

export default async function TenantRegistrationDetailPage({ params }: Props) {
  const session = await requireAnyPermission([
    PERMISSIONS.REGISTRATIONS_VIEW,
    PERMISSIONS.REGISTRATIONS_EDIT,
  ]);
  const { tenantSlug, registrationId } = await params;

  const [registration, ctx] = await Promise.all([
    getRegistrationForTenant(tenantSlug, registrationId),
    getCurrentTenantContext(tenantSlug),
  ]);

  const canEdit = hasPermission(session, PERMISSIONS.REGISTRATIONS_EDIT);

  if (!registration) {
    notFound();
  }

  return (
    <RegistrationDetailCard
      tenantSlug={tenantSlug}
      initialRegistration={registration}
      canEdit={canEdit}
      locale={ctx?.locale ?? undefined}
      timezone={ctx?.timezone ?? undefined}
    />
  );
}
