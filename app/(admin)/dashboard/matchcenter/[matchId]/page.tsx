import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import {
  getMatchcenterMatchDetail,
  type MatchcenterQueryDatabase,
} from "@/lib/matchcenter/query-service";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { getActiveTenant } from "@/lib/tenants/active-tenant";
import MatchcenterDetail from "@/components/admin/matchcenter/MatchcenterDetail";
import { hasPermission } from "@/lib/permissions/has-permission";
import { ToastProvider } from "@/components/ui/ToastProvider";

type MatchcenterDetailPageProps = {
  params: Promise<{
    matchId: string;
  }>;
};

export default async function MatchcenterDetailPage({
  params,
}: MatchcenterDetailPageProps) {
  const session = await requireAnyPermission([
    PERMISSIONS.EVENTS_VIEW,
    PERMISSIONS.EVENTS_MANAGE,
  ]);

  const tenantContext = await getActiveTenant();

  if (!tenantContext) {
    notFound();
  }

  const tenantId = tenantContext.id;

  const { matchId } = await params;

  /*
   * Prisma's generated delegate is adapted locally to the deliberately narrow,
   * tested Matchcenter query contract. The query service itself remains the
   * tenant-isolated source of truth.
   */
  const matchcenterDatabase =
    prisma as unknown as MatchcenterQueryDatabase;

  const match = await getMatchcenterMatchDetail(
    matchcenterDatabase,
    {
      tenantId,
      eventId: matchId,
    },
  );

  if (!match) {
    notFound();
  }

  const canManageMappings = hasPermission(
    session,
    PERMISSIONS.EVENTS_MANAGE,
  );

  return (
    <ToastProvider>
      <MatchcenterDetail
        match={match}
        locale={tenantContext.locale ?? "de-CH"}
        timezone={tenantContext.timezone ?? "Europe/Zurich"}
        canManageMappings={canManageMappings}
      />
    </ToastProvider>
  );
}