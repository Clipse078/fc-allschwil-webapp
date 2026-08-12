/**
 * app/(admin)/dashboard/infoboard/[id]/page.tsx
 *
 * Individual Infoboard configuration page — INFOBOARD-DESIGNER-01
 *
 * Route: /dashboard/infoboard/[id]
 *
 * Architecture:
 *   - Server component. Auth + tenant from session.
 *   - Loads the specific Infoboard by id (tenant-scoped).
 *   - Renders InboardDetailClient for premium tab-based UX.
 */

import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getActiveTenant } from "@/lib/tenants/active-tenant";
import { getInfoboard } from "@/lib/infoboard/queries";
import { InboardDetailClient } from "@/components/infoboard/v2/InboardDetailClient";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function InboardDetailPage({ params }: PageProps) {
  await requireAnyPermission([PERMISSIONS.INFOBOARD_MANAGE]);

  const tenantContext = await getActiveTenant();
  if (!tenantContext) notFound();

  const { id } = await params;
  const board = await getInfoboard(id, tenantContext.id);
  if (!board) notFound();

  return (
    <div className="max-w-[1400px]">
      <InboardDetailClient board={board} tenantName={tenantContext.name} />
    </div>
  );
}
