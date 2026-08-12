import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { findTeamSeasonsForTenant } from "@/lib/training/queries";
import { getFacilitiesForTenant } from "@/lib/facilities/queries";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import TrainingSeriesCreateForm from "@/components/admin/training/TrainingSeriesCreateForm";
import type { FacilityGroup } from "@/components/admin/training/FacilityResourceSelector";

export default async function NewTrainingSeriesPage() {
  const session = await requireAnyPermission([PERMISSIONS.TRAININGS_MANAGE]);

  const tenantId = session.user?.activeTenantId;
  if (!tenantId) notFound();

  // PLANNING-CREATION-UX-01B: TrainingCenter has exactly one permission tier
  // today (trainings.manage — also the gate above) and no draft/pending
  // review state (see lib/training/create-training-series-orchestration.ts
  // doc comment). `canValidateDirectly` is wired from that EXISTING
  // permission rather than inventing a new one, so the guided form's final
  // action reflects the real lifecycle instead of a fabricated review queue.
  const canValidateDirectly = hasPermission(session, PERMISSIONS.TRAININGS_MANAGE);

  const [teamSeasons, facilities] = await Promise.all([
    findTeamSeasonsForTenant(tenantId),
    getFacilitiesForTenant(tenantId),
  ]);

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
        teamSeasons={teamSeasons.map((ts) => ({ id: ts.id, teamId: ts.teamId, teamName: ts.teamName, seasonName: ts.seasonName }))}
        pitchHallFacilityGroups={pitchHallFacilityGroups}
        dressingRoomFacilityGroups={dressingRoomFacilityGroups}
        canValidateDirectly={canValidateDirectly}
      />
    </div>
  );
}
