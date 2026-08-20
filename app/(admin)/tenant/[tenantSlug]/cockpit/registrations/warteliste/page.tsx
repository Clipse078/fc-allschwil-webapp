/**
 * /tenant/[tenantSlug]/cockpit/registrations/warteliste
 *
 * REG-WAIT-01: Warteliste workspace — operational overview of WaitingListEntries.
 *
 * Authorization: REGISTRATIONS_VIEW | REGISTRATIONS_EDIT | REGISTRATIONS_DELETE.
 */

import { WaitingListWorkspace } from "@/components/admin/registrations/WaitingListWorkspace";
import { hasPermission } from "@/lib/permissions/has-permission";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { listEligibleRegistrationCoordinatorsForTenant } from "@/lib/registrations/coordinator-queries";
import { listWaitingListEntriesForTenant } from "@/lib/registrations/waiting-list-queries";
import { requireTenantContextForSlug } from "@/lib/tenants/active-tenant";
import { PageShell } from "@/components/ui/page";

type Props = {
  params: Promise<{ tenantSlug: string }>;
};

export default async function WartelistePage({ params }: Props) {
  const { tenantSlug } = await params;

  const tenantContext = await requireTenantContextForSlug(tenantSlug);
  const tenantId = tenantContext.id;

  const session = await requireAnyPermission(
    [PERMISSIONS.REGISTRATIONS_VIEW, PERMISSIONS.REGISTRATIONS_EDIT, PERMISSIONS.REGISTRATIONS_DELETE],
    tenantId,
  );

  const [entries, eligibleCoordinators] = await Promise.all([
    listWaitingListEntriesForTenant(tenantSlug),
    listEligibleRegistrationCoordinatorsForTenant(tenantSlug),
  ]);

  const canEdit = hasPermission(session, PERMISSIONS.REGISTRATIONS_EDIT);
  const canDelete = hasPermission(session, PERMISSIONS.REGISTRATIONS_DELETE);
  const currentUserId = session.user?.effectiveUserId ?? session.user?.id ?? null;

  return (
    <PageShell fullWidth>
      <WaitingListWorkspace
        tenantSlug={tenantSlug}
        initialEntries={entries}
        canEdit={canEdit}
        canDelete={canDelete}
        eligibleCoordinators={eligibleCoordinators}
        currentUserId={currentUserId}
      />
    </PageShell>
  );
}
