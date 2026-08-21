import RegistrationInbox from "@/components/admin/registrations/RegistrationInbox";
import { hasPermission } from "@/lib/permissions/has-permission";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { listEligibleRegistrationCoordinatorsForTenant } from "@/lib/registrations/coordinator-queries";
import { getWaitingListScopeOptionsForTenant } from "@/lib/registrations/waiting-list-scope-options";
import { listRegistrationsForTenant } from "@/lib/registrations/queries";
import { isArchiveRegistrationStatus } from "@/lib/registrations/status";
import { requireTenantContextForSlug } from "@/lib/tenants/active-tenant";
import { prisma } from "@/lib/db/prisma";
import { PageShell } from "@/components/ui/page";

type Props = {
  params: Promise<{
    tenantSlug: string;
  }>;
};

export default async function TenantRegistrationArchivePage({ params }: Props) {
  const { tenantSlug } = await params;

  const tenantContext = await requireTenantContextForSlug(tenantSlug);
  const tenantId = tenantContext.id;

  const session = await requireAnyPermission(
    [PERMISSIONS.REGISTRATIONS_VIEW, PERMISSIONS.REGISTRATIONS_EDIT, PERMISSIONS.REGISTRATIONS_DELETE],
    tenantId,
  );

  const [allRegistrations, assignableUsers, eligibleCoordinators, targetGroups, scopeOptions] = await Promise.all([
    listRegistrationsForTenant(tenantSlug),
    prisma.user.findMany({
      where: { isActive: true, tenantId },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true, email: true },
    }),
    listEligibleRegistrationCoordinatorsForTenant(tenantSlug),
    prisma.targetGroup.findMany({
      where: {
        status: "ACTIVE",
        OR: [{ tenantId }, { tenantId: null }],
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, key: true },
    }),
    getWaitingListScopeOptionsForTenant(tenantSlug),
  ]);

  const registrations = allRegistrations.filter((registration) =>
    isArchiveRegistrationStatus(registration.status),
  );

  const canEdit = hasPermission(session, PERMISSIONS.REGISTRATIONS_EDIT);
  const canDelete = hasPermission(session, PERMISSIONS.REGISTRATIONS_DELETE);
  const currentUserId = session.user?.effectiveUserId ?? session.user?.id ?? null;

  return (
    <PageShell fullWidth>
      <RegistrationInbox
        tenantSlug={tenantSlug}
        initialRegistrations={registrations}
        workspaceMode="archive"
        canEdit={canEdit}
        canDelete={canDelete}
        locale={tenantContext.locale ?? undefined}
        timezone={tenantContext.timezone ?? undefined}
        assignableUsers={assignableUsers}
        eligibleCoordinators={eligibleCoordinators}
        targetGroups={targetGroups}
        orgUnits={scopeOptions.orgUnits}
        teamSeasons={scopeOptions.teamSeasons}
        currentUserId={currentUserId}
      />
    </PageShell>
  );
}
