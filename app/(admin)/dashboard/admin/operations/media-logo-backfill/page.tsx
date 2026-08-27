/**
 * TEMPORARY MEDIA-LOGO-01 operational route.
 * Remove after successful backfill verification before STAGE merge.
 */

import { notFound, redirect } from "next/navigation";

import MediaLogoBackfillOperationPanel from "@/components/admin/operations/MediaLogoBackfillOperationPanel";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import { isMediaLogoBackfillAuthEnvironmentAllowed } from "@/lib/assets/media-logo-backfill-operation-environment";
import { MEDIA_LOGO_01G4_FROZEN_CONTRACT } from "@/lib/assets/media-logo-backfill-operation-contract";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { getActiveTenant } from "@/lib/tenants/active-tenant";

export default async function MediaLogoBackfillOperationPage() {
  if (!isMediaLogoBackfillAuthEnvironmentAllowed()) {
    redirect("/dashboard");
  }

  await requireAnyPermission([PERMISSIONS.WEBSITE_MANAGE]);

  const tenant = await getActiveTenant();
  if (!tenant || tenant.key !== MEDIA_LOGO_01G4_FROZEN_CONTRACT.tenantKey) {
    redirect("/dashboard");
  }

  if (tenant.status !== "ACTIVE") {
    notFound();
  }

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Temporary Operations"
        title="MEDIA-LOGO Provider-Logo Backfill"
        description="Temporary authenticated Vercel-runtime execution surface for the approved MEDIA-LOGO backfill. Direct URL only — not linked from navigation. Requires STAGE database, Vercel runtime, and Blob capability."
      />
      <MediaLogoBackfillOperationPanel />
    </div>
  );
}
