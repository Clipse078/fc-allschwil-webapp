import RegistrationInbox from "@/components/admin/registrations/RegistrationInbox";
import { hasPermission } from "@/lib/permissions/has-permission";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { listRegistrationsForTenant } from "@/lib/registrations/queries";
import { getCurrentTenantContext } from "@/lib/tenants/context";
import { requireTenant } from "@/lib/tenants/require-tenant";
import { prisma } from "@/lib/db/prisma";
import { PageShell } from "@/components/ui/page";

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

  const tenant = await requireTenant(tenantSlug);
  const tenantId = tenant.id;

  const [registrations, ctx, assignableUsers, targetGroups] =
    await Promise.all([
      listRegistrationsForTenant(tenantSlug),
      getCurrentTenantContext(tenantSlug),
      prisma.user.findMany({
        where: { isActive: true, tenantId },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        select: { id: true, firstName: true, lastName: true, email: true },
      }),
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

  return (
    <PageShell fullWidth>
      <RegistrationInbox
        tenantSlug={tenantSlug}
        initialRegistrations={registrations}
        canEdit={canEdit}
        locale={ctx?.locale ?? undefined}
        timezone={ctx?.timezone ?? undefined}
        assignableUsers={assignableUsers}
        targetGroups={targetGroups}
      />
    </PageShell>
  );
}
