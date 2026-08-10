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
import {
  getActiveResourceOptionsForTenant,
  getFacilityResourcesByCodesForTenant,
  withRequiredCodes,
} from "@/lib/facilities/queries";

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

  // MASTERDATA-CONSISTENCY-02 — canonical, tenant-scoped, active resource
  // options for the operational pitch/dressing-room selectors, replacing the
  // static FCA_PITCH_ALLOCATIONS / FCA_DRESSING_ROOMS registries. Any code
  // already persisted on this match (even archived/renamed-away) is merged
  // back in via withRequiredCodes() so existing allocations remain readable
  // and are never silently cleared.
  const [activePitchOptions, activeDressingRoomOptions] = await Promise.all([
    getActiveResourceOptionsForTenant(tenantId, "PITCH_HALL"),
    getActiveResourceOptionsForTenant(tenantId, "DRESSING_ROOM"),
  ]);

  const requiredPitchCodes = [match.operational.pitchCode];
  const requiredRoomCodes = [
    match.operational.homeDressingRoomCode,
    match.operational.awayDressingRoomCode,
  ];

  const historicalCodes = [...requiredPitchCodes, ...requiredRoomCodes].filter(
    (code): code is string => Boolean(code),
  );
  const historicalNamesByCode = await getFacilityResourcesByCodesForTenant(
    historicalCodes,
    tenantId,
  );

  const pitchOptions = withRequiredCodes(
    activePitchOptions,
    requiredPitchCodes,
    historicalNamesByCode,
  );
  const dressingRoomOptions = withRequiredCodes(
    activeDressingRoomOptions,
    requiredRoomCodes,
    historicalNamesByCode,
  );

  return (
    <ToastProvider>
      <MatchcenterDetail
        match={match}
        locale={tenantContext.locale ?? "de-CH"}
        timezone={tenantContext.timezone ?? "Europe/Zurich"}
        canManageMappings={canManageMappings}
        pitchOptions={pitchOptions}
        dressingRoomOptions={dressingRoomOptions}
      />
    </ToastProvider>
  );
}