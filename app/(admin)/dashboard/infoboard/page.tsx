/**
 * app/(admin)/dashboard/infoboard/page.tsx
 *
 * Infoboard management workspace — INFOBOARD-V2
 *
 * Route: /dashboard/infoboard
 *
 * Architecture:
 *   - Server component. Auth + tenant from session.
 *   - Lists all tenant Infoboards from DB.
 *   - Client component (InboardOverview) handles create/delete/duplicate.
 *   - No hard-coded Display 1 / Display 2 concept.
 */

import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { createEffectivePermissionResolver } from "@/lib/permissions/services/effective-permission-resolver";
import { prisma } from "@/lib/db/prisma";
import { getActiveTenant } from "@/lib/tenants/active-tenant";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import { listInfoboards, countInfoboards } from "@/lib/infoboard/queries";
import { InboardOverview } from "@/components/infoboard/v2/InboardOverview";

export default async function InfoboardAdminPage() {
  const session = await requireAnyPermission([
    PERMISSIONS.INFOBOARD_MANAGE,
    PERMISSIONS.EVENTS_PUBLISH_INFOBOARD,
  ]);

  const tenantContext = await getActiveTenant();
  if (!tenantContext) notFound();

  const resolver = createEffectivePermissionResolver(prisma);
  const canDelete = await resolver.hasTenantDeletionAuthority({
    userId: session.user.id,
    permission: PERMISSIONS.INFOBOARD_DELETE,
    tenantId: tenantContext.id,
  });

  const [boards, counts] = await Promise.all([
    listInfoboards(tenantContext.id),
    countInfoboards(tenantContext.id),
  ]);

  return (
    <div className="space-y-8 max-w-[1400px]">
      <AdminSectionHeader
        eyebrow="Spielbetrieb"
        title="Infoboards"
        description="Verwalte alle Infoboards, deren Inhalte, Layouts und Geräte."
      />

      <InboardOverview
        boards={boards}
        totalCount={counts.total}
        activeCount={counts.active}
        draftCount={counts.draft}
        disabledCount={counts.disabled}
        canDelete={canDelete}
      />
    </div>
  );
}
