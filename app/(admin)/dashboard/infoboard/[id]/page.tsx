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
import { getFacilitiesForTenant } from "@/lib/facilities/queries";
import type { AnlageplanResourceOption } from "@/lib/infoboard/anlageplan-types";
import { InboardDetailClient } from "@/components/infoboard/v2/InboardDetailClient";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function InboardDetailPage({ params }: PageProps) {
  await requireAnyPermission([PERMISSIONS.INFOBOARD_MANAGE]);

  const tenantContext = await getActiveTenant();
  if (!tenantContext) notFound();

  const { id } = await params;

  // Load board + facility options in parallel
  const [board, facilities] = await Promise.all([
    getInfoboard(id, tenantContext.id),
    getFacilitiesForTenant(tenantContext.id),
  ]);

  if (!board) notFound();

  // Flatten to serialisable AnlageplanResourceOption[] (FULL_PITCH/HALF_PITCH only)
  const facilityOptions: AnlageplanResourceOption[] = facilities.flatMap((f) =>
    f.resources
      .filter(
        (r): r is typeof r & { type: "FULL_PITCH" | "HALF_PITCH" } =>
          r.type === "FULL_PITCH" || r.type === "HALF_PITCH",
      )
      .map((r) => ({
        code: r.code,
        name: r.name,
        type: r.type,
        facilityName: f.name,
      })),
  );

  return (
    <div className="max-w-[1400px]">
      <InboardDetailClient
        board={board}
        tenantName={tenantContext.name}
        facilityOptions={facilityOptions}
      />
    </div>
  );
}
