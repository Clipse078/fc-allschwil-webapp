import RegistrationInbox from "@/components/admin/registrations/RegistrationInbox";
import { hasPermission } from "@/lib/permissions/has-permission";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { listRegistrationsForTenant } from "@/lib/registrations/queries";
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
  const session = await requireAnyPermission(
    [PERMISSIONS.REGISTRATIONS_VIEW, PERMISSIONS.REGISTRATIONS_EDIT],
    tenantId,
  );

  const [registrations, assignableUsers, targetGroups] = await Promise.all([
    listRegistrationsForTenant(tenantSlug),
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
  // REGISTRATION-01F — Goal 9: "Assigned to me" filter needs the viewer's own user id.
  const currentUserId = session.user?.effectiveUserId ?? session.user?.id ?? null;

  return (
    <PageShell fullWidth>
      <RegistrationInbox
        tenantSlug={tenantSlug}
        initialRegistrations={registrations}
        canEdit={canEdit}
        locale={tenantContext.locale ?? undefined}
        timezone={tenantContext.timezone ?? undefined}
        assignableUsers={assignableUsers}
        targetGroups={targetGroups}
        currentUserId={currentUserId}
      />
    </PageShell>
  );
}
