import Link from "next/link";
import { notFound } from "next/navigation";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import MatchCreateForm from "@/components/admin/matchcenter/MatchCreateForm";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getFacilitiesForTenant } from "@/lib/facilities/queries";
import type { FacilityGroup } from "@/components/admin/training/FacilityResourceSelector";

export default async function NewMatchCenterPage() {
  const session = await requireAnyPermission([PERMISSIONS.EVENTS_MANAGE]);

  const tenantId = session.user?.activeTenantId;
  if (!tenantId) notFound();

  // PLANNING-CREATION-UX-01C: mirrors POST /api/events' own decision
  // (lib/workflow/event-review-policy.ts) — same permissions, same
  // reasoning — so the guided form's copy reflects the real lifecycle
  // outcome instead of inventing a separate review-right check.
  const canValidateDirectly =
    hasPermission(session, PERMISSIONS.EVENTS_PUBLISH_WEBSITE) ||
    hasPermission(session, PERMISSIONS.EVENTS_PUBLISH_INFOBOARD);

  const facilities = await getFacilitiesForTenant(tenantId);

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
        eyebrow="Matchcenter"
        title="Match erstellen"
        description="Geführte Erstellung: Team, Heim/Auswärts, Ort, Gegner und Termin sowie — bei Heimspielen — Spielfeld/Halle und Garderobe werden direkt erfasst."
        actions={
          <Link href="/dashboard/matchcenter" className="fca-button-secondary">
            Zurück zum Matchcenter
          </Link>
        }
      />

      <MatchCreateForm
        pitchHallFacilityGroups={pitchHallFacilityGroups}
        dressingRoomFacilityGroups={dressingRoomFacilityGroups}
        canValidateDirectly={canValidateDirectly}
      />
    </div>
  );
}
