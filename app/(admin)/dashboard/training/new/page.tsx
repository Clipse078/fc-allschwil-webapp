import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { findTeamSeasonsForTenant } from "@/lib/training/queries";
import { getFacilitiesForTenant } from "@/lib/facilities/queries";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import TrainingSeriesCreateForm from "@/components/admin/training/TrainingSeriesCreateForm";
import type { FacilityGroup } from "@/components/admin/training/FacilityResourceSelector";
import { prisma } from "@/lib/db/prisma";
import { createPlanningAuthorizationPolicy } from "@/lib/planning/planning-authorization-policy";

export default async function NewTrainingSeriesPage() {
  // ORG-ACCESS-03: broaden gate to also allow TRAININGS_VIEW so scoped users
  // (who have trainings.manage at OrgUnit scope only, plus trainings.view at
  // tenant level) can reach this create page. The backend enforces 403 if
  // the submitted teamSeason is outside their write scope.
  const session = await requireAnyPermission([
    PERMISSIONS.TRAININGS_MANAGE,
    PERMISSIONS.TRAININGS_VIEW,
  ]);

  const tenantId = session.user?.activeTenantId;
  if (!tenantId) notFound();

  const userId = session.user?.effectiveUserId ?? session.user?.id;
  if (!userId) notFound();

  // PLANNING-CREATION-UX-01B: canValidateDirectly is true for tenant-wide
  // trainings.manage holders (coordinators). Scoped users start records as DRAFT.
  const canValidateDirectly = hasPermission(session, PERMISSIONS.TRAININGS_MANAGE);

  const policy = createPlanningAuthorizationPolicy(prisma);

  const [teamSeasons, facilities, writableTeamIds] = await Promise.all([
    findTeamSeasonsForTenant(tenantId),
    getFacilitiesForTenant(tenantId),
    // ORG-ACCESS-03: compute writable team IDs for this user.
    // Coordinators get all teams; scoped users get only their OrgUnit-covered teams.
    policy.getWritableTeamIds({ userId, tenantId }, "training"),
  ]);

  // ORG-ACCESS-03: filter teamSeasons to those the user may write.
  // For coordinators, writableTeamIds covers all teams so no filtering effect.
  const writableTeamIdSet = new Set(writableTeamIds);
  const filteredTeamSeasons = writableTeamIds.length > 0
    ? teamSeasons.filter((ts) => writableTeamIdSet.has(ts.teamId))
    : [];

  function facilityGroupsForTypes(types: readonly string[]): FacilityGroup[] {
    return facilities
      .filter((f) => f.status !== "ARCHIVED")
      .map((f) => ({
        facilityId: f.id,
        facilityName: f.name,
        facilityType: f.type as string,
        resources: f.resources
          .filter((r) => r.status !== "ARCHIVED" && types.includes(r.type))
          .map((r) => ({
            id: r.id,
            name: r.name,
            code: r.code,
            type: r.type,
            facilityId: f.id,
            facilityName: f.name,
            facilityType: f.type as string,
          })),
      }))
      .filter((fg) => fg.resources.length > 0);
  }

  const pitchHallFacilityGroups = facilityGroupsForTypes(["FULL_PITCH", "HALF_PITCH"]);
  const dressingRoomFacilityGroups = facilityGroupsForTypes(["DRESSING_ROOM"]);

  return (
    <div className="max-w-[1000px] space-y-6">
      <AdminSectionHeader
        eyebrow="TrainingCenter"
        title="Neue Trainingsserie"
        description="Geführte Erstellung: Team, Tag & Zeit, Wiederholung sowie Spielfeld/Halle und Garderobe werden direkt erfasst. Nach dem Erstellen wird der erste Trainingstermin automatisch generiert."
      />

      <TrainingSeriesCreateForm
        teamSeasons={filteredTeamSeasons.map((ts) => ({ id: ts.id, teamId: ts.teamId, teamName: ts.teamName, seasonName: ts.seasonName }))}
        pitchHallFacilityGroups={pitchHallFacilityGroups}
        dressingRoomFacilityGroups={dressingRoomFacilityGroups}
        canValidateDirectly={canValidateDirectly}
      />
    </div>
  );
}
