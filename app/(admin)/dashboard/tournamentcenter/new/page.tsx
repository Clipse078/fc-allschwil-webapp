import Link from "next/link";
import { notFound } from "next/navigation";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import TournamentCreateForm from "@/components/admin/tournamentcenter/TournamentCreateForm";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getActiveTenant } from "@/lib/tenants/active-tenant";
import { getFacilitiesForTenant } from "@/lib/facilities/queries";
import type { FacilityGroup } from "@/components/admin/training/FacilityResourceSelector";

export default async function NewTournamentCenterPage() {
  await requirePermission(PERMISSIONS.EVENTS_MANAGE);

  const tenantContext = await getActiveTenant();
  if (!tenantContext) notFound();

  const facilities = await getFacilitiesForTenant(tenantContext.id);

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
        eyebrow="TournamentCenter"
        title="Turnier erstellen"
        description="Teilnehmende Teams, Spielfeld/Halle und Garderoben werden direkt bei der Erstellung erfasst."
        actions={
          <Link href="/dashboard/tournamentcenter" className="fca-button-secondary">
            Zurück zum TournamentCenter
          </Link>
        }
      />

      <TournamentCreateForm
        pitchHallFacilityGroups={pitchHallFacilityGroups}
        dressingRoomFacilityGroups={dressingRoomFacilityGroups}
      />
    </div>
  );
}
