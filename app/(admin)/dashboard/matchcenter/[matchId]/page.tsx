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
import { getActiveResourceOptionsForTenant } from "@/lib/facilities/queries";

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

  // MASTERDATA-CONSISTENCY-02: canonical, tenant-scoped, active FacilityResource
  // options replace the static FCA_PITCH_ALLOCATIONS / FCA_DRESSING_ROOMS
  // registries as the source for the pitch/dressing-room selects below. This
  // query runs on every request/navigation, so create/rename/archive/restore
  // of a FacilityResource is reflected immediately — no extra cache layer.
  const [pitchResources, dressingRoomResources] = await Promise.all([
    getActiveResourceOptionsForTenant(tenantId, "PITCH"),
    getActiveResourceOptionsForTenant(tenantId, "DRESSING_ROOM"),
  ]);

  // Matches (unlike training) only ever assign a full pitch, mirroring the
  // previous static getPitchOptionsForEventType("MATCH") behaviour.
  const pitchOptions = pitchResources
    .filter((r) => r.type === "FULL_PITCH")
    .map((r) => ({ code: r.code, label: r.name }));
  const dressingRoomOptions = dressingRoomResources.map((r) => ({ code: r.code, label: r.name }));

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