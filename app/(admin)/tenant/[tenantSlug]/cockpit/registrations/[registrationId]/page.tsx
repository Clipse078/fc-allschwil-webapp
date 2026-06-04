import { notFound } from "next/navigation";
import RegistrationDetailCard from "@/components/admin/registrations/RegistrationDetailCard";
import { hasPermission } from "@/lib/permissions/has-permission";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getRegistrationForTenant } from "@/lib/registrations/queries";
import { getCurrentTenantContext } from "@/lib/tenants/context";
import { requireTenant } from "@/lib/tenants/require-tenant";
import { prisma } from "@/lib/db/prisma";

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

  // Resolve tenant first so we can scope all subsequent queries to this tenant.
  const tenant = await requireTenant(tenantSlug);
  const tenantId = tenant.id;

  const [registration, ctx, users, targetGroups] = await Promise.all([
    getRegistrationForTenant(tenantSlug, registrationId),
    getCurrentTenantContext(tenantSlug),
    // Tenant-scoped: only users belonging to this tenant are assignable.
    prisma.user.findMany({
      where: { isActive: true, tenantId },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true, email: true },
    }),
    // Tenant-scoped: target groups for this tenant + global groups (tenantId IS NULL).
    prisma.targetGroup.findMany({
      where: {
        status: "ACTIVE",
        OR: [{ tenantId }, { tenantId: null }],
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, key: true },
    }),
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
      assignableUsers={users}
      targetGroups={targetGroups}
    />
  );
}
