import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import {
  getMatchcenterMatchDetail,
  type MatchcenterQueryDatabase,
} from "@/lib/matchcenter/query-service";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { getTenantContextFromSession } from "@/lib/tenants/context";
import MatchcenterDetail from "@/components/admin/matchcenter/MatchcenterDetail";

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

  const tenantId = session.user?.tenantId;

  if (!tenantId) {
    notFound();
  }

  const tenantContext = await getTenantContextFromSession(tenantId);

  if (!tenantContext) {
    notFound();
  }

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

  return (
    <MatchcenterDetail
      match={match}
      locale={tenantContext.locale ?? "de-CH"}
      timezone={tenantContext.timezone ?? "Europe/Zurich"}
    />
  );
}