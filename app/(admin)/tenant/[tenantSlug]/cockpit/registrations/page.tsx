import RegistrationInbox from "@/components/admin/registrations/RegistrationInbox";
import { hasPermission } from "@/lib/permissions/has-permission";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { listEligibleRegistrationCoordinatorsForTenant } from "@/lib/registrations/coordinator-queries";
import { getWaitingListScopeOptionsForTenant } from "@/lib/registrations/waiting-list-scope-options";
import { listRegistrationsForTenant } from "@/lib/registrations/queries";
import { isActiveInboxRegistrationStatus } from "@/lib/registrations/status";
import { requireTenantContextForSlug } from "@/lib/tenants/active-tenant";
import { prisma } from "@/lib/db/prisma";
import { PageShell } from "@/components/ui/page";

type Props = {
  params: Promise<{
    tenantSlug: string;
  }>;
};

export default async function TenantRegistrationsPage({ params }: Props) {
  const { tenantSlug } = await params;

  // RPERM-04-C1: resolve + validate the tenant named in the URL FIRST — never
  // authorize this route against session.user.activeTenantId. Redirects to
  // /dashboard before any registration data is fetched if the tenant does
  // not exist, is not ACTIVE, or the user has no active membership in it.
  const tenantContext = await requireTenantContextForSlug(tenantSlug);
  const tenantId = tenantContext.id;

  // Permission is evaluated against the EXACT tenant resolved from the URL,
  // not the caller's own default tenant.
  // ADMIN-DELETE-03B: include REGISTRATIONS_DELETE so a delegated user who
  // holds registrations.delete without registrations.view/edit can still reach
  // this page to exercise the permanent-delete action.
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
    isActiveInboxRegistrationStatus(registration.status),
  );

  const canEdit = hasPermission(session, PERMISSIONS.REGISTRATIONS_EDIT);
  // ADMIN-DELETE-03B: permanent delete authority — deliberately separate from
  // canEdit (registrations.edit authorizes status/workflow mutations but must
  // never imply permanent deletion). Club Admins can receive this permission
  // through canonical Roles & Permissions.
  const canDelete = hasPermission(session, PERMISSIONS.REGISTRATIONS_DELETE);
  // REGISTRATION-01F — Goal 9: "Assigned to me" filter needs the viewer's own user id.
  const currentUserId = session.user?.effectiveUserId ?? session.user?.id ?? null;

  return (
    <PageShell fullWidth>
      <RegistrationInbox
        tenantSlug={tenantSlug}
        initialRegistrations={registrations}
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
