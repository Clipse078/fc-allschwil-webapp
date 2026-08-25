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
  getFacilitiesForTenant,
  withRequiredCodes,
} from "@/lib/facilities/queries";
import { classifyFacilityResourceType } from "@/lib/training/allocation-groups";
import type { FacilityGroup } from "@/components/admin/training/FacilityResourceSelector";

type MatchcenterDetailPageProps = {
  params: Promise<{
    matchId: string;
  }>;
};

export default async function MatchcenterDetailPage({
  params,
}: MatchcenterDetailPageProps) {
  // ADMIN-DELETE-02A: a delegated user may hold matches.delete without
  // events.view/events.manage — they must still be able to reach this page
  // to exercise the permanent-delete action gated below (mirrors
  // app/(admin)/dashboard/teams/[teamId]/page.tsx, ADMIN-DELETE-01B).
  const session = await requireAnyPermission([
    PERMISSIONS.EVENTS_VIEW,
    PERMISSIONS.EVENTS_MANAGE,
    PERMISSIONS.MATCHES_DELETE,
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

  // ADMIN-DELETE-02A: permanent "Löschen" gating — deliberately independent
  // of events.manage (manage alone must never authorize deletion).
  const canDelete = hasPermission(session, PERMISSIONS.MATCHES_DELETE);

  // ORG-ACCESS-03: planning workflow action visibility.
  // Coordinator = tenant-wide EVENTS_MANAGE → can validate/reopen.
  // Scoped user = no tenant-wide EVENTS_MANAGE → can submit DRAFT manual records.
  // Provider-owned records (SFV/CLUBCORNER_FVNWS/CSV_EXCEL_IMPORT) are never
  // exposed to scoped mutation regardless of stage.
  const PROTECTED_SOURCES = new Set(["SFV", "CLUBCORNER_FVNWS", "CSV_EXCEL_IMPORT"]);
  const isProtectedSource = PROTECTED_SOURCES.has(match.source.eventSource);
  // isCoordinator drives validate/reopen; submit is shown for non-coordinator
  // on DRAFT records (the actual authz check happens server-side in the endpoint).
  const isCoordinatorForPlanning = canManageMappings;
  const canSubmitPlanning = !isProtectedSource && !canManageMappings && match.reviewStage === "DRAFT";
  const canValidatePlanning = !isProtectedSource && canManageMappings;

  // MASTERDATA-CONSISTENCY-02 — canonical, tenant-scoped, active resource
  // options for the operational pitch/dressing-room selectors, replacing the
  // static FCA_PITCH_ALLOCATIONS / FCA_DRESSING_ROOMS registries. Any code
  // already persisted on this match (even archived/renamed-away) is merged
  // back in via withRequiredCodes() so existing allocations remain readable
  // and are never silently cleared.
  const [activePitchOptions, activeDressingRoomOptions, facilities] = await Promise.all([
    getActiveResourceOptionsForTenant(tenantId, "PITCH_HALL"),
    getActiveResourceOptionsForTenant(tenantId, "DRESSING_ROOM"),
    getFacilitiesForTenant(tenantId),
  ]);

  function buildFacilityGroups(group: "PITCH_HALL" | "DRESSING_ROOM"): FacilityGroup[] {
    return facilities
      .map((facility) => ({
        facilityId: facility.id,
        facilityName: facility.name,
        facilityType: facility.type as string,
        resources: facility.resources
          .filter((resource) => classifyFacilityResourceType(resource.type) === group)
          .map((resource) => ({
            id: resource.id,
            name: resource.name,
            code: resource.code,
            type: resource.type,
            facilityId: facility.id,
            facilityName: facility.name,
            facilityType: facility.type as string,
          })),
      }))
      .filter((fg) => fg.resources.length > 0);
  }

  const pitchHallFacilityGroups = buildFacilityGroups("PITCH_HALL");
  const dressingRoomFacilityGroups = buildFacilityGroups("DRESSING_ROOM");

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
        canDelete={canDelete}
        pitchOptions={pitchOptions}
        dressingRoomOptions={dressingRoomOptions}
        pitchHallFacilityGroups={pitchHallFacilityGroups}
        dressingRoomFacilityGroups={dressingRoomFacilityGroups}
        canSubmitPlanning={canSubmitPlanning}
        canValidatePlanning={canValidatePlanning}
        isProtectedSource={isProtectedSource}
        tenantLogoUrl={tenantContext.logoUrl}
      />
    </ToastProvider>
  );
}