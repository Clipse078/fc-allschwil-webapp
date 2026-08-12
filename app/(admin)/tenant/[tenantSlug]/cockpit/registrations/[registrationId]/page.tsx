import { notFound } from "next/navigation";
import RegistrationDetailCard from "@/components/admin/registrations/RegistrationDetailCard";
import { hasPermission } from "@/lib/permissions/has-permission";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getRegistrationForTenant } from "@/lib/registrations/queries";
import { requireTenantContextForSlug } from "@/lib/tenants/active-tenant";
import { prisma } from "@/lib/db/prisma";

type Props = {
  params: Promise<{
    tenantSlug: string;
    registrationId: string;
  }>;
};

export default async function TenantRegistrationDetailPage({ params }: Props) {
  const { tenantSlug, registrationId } = await params;

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

  const [registration, users, targetGroups] = await Promise.all([
    getRegistrationForTenant(tenantSlug, registrationId),
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
  // ADMIN-DELETE-03B: separate delete authority — never implied by canEdit.
  const canDelete = hasPermission(session, PERMISSIONS.REGISTRATIONS_DELETE);

  if (!registration) {
    notFound();
  }

  return (
    <RegistrationDetailCard
      tenantSlug={tenantSlug}
      initialRegistration={registration}
      canEdit={canEdit}
      canDelete={canDelete}
      locale={tenantContext.locale ?? undefined}
      timezone={tenantContext.timezone ?? undefined}
      assignableUsers={users}
      targetGroups={targetGroups}
    />
  );
}
