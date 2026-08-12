/**
 * app/(admin)/dashboard/infoboard/[id]/page.tsx
 *
 * Individual Infoboard configuration page — INFOBOARD-V2
 *
 * Route: /dashboard/infoboard/[id]
 *
 * Architecture:
 *   - Server component. Auth + tenant from session.
 *   - Loads the specific Infoboard by id (tenant-scoped).
 *   - Renders InboardDetailClient for tab-based configuration.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
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
    <div className="max-w-[1000px] space-y-6">
      {/* Breadcrumb */}
      <div>
        <Link
          href="/dashboard/infoboard"
          className="inline-flex items-center gap-1.5 text-[0.8rem] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Infoboards
        </Link>
      </div>

      <InboardDetailClient board={board} tenantName={tenantContext.name} />
    </div>
  );
}
