import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantContextFromSession } from "@/lib/tenants/context";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import HomepageBlockManager from "@/components/admin/homepage/HomepageBlockManager";

export default async function HomepageBlocksPage() {
  const session = await requireAnyPermission([PERMISSIONS.WEBSITE_MANAGE]);

  const tenantCtx = await getTenantContextFromSession(session.user?.tenantId);
  const requiresReview = tenantCtx?.approvedDataOnly ?? false;

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Website"
        title="Homepage Blöcke"
        description="Reusable Inhaltsblöcke für die Homepage verwalten. Blöcke können aktiviert, deaktiviert, umgeordnet und einzeln veröffentlicht werden."
      />
      <HomepageBlockManager requiresReview={requiresReview} />
    </div>
  );
}
