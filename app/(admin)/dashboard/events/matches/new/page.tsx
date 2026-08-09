import Link from "next/link";
import { notFound } from "next/navigation";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import MatchGuidedCreateForm from "@/components/admin/matchcenter/MatchGuidedCreateForm";
import { requirePermission } from "@/lib/permissions/require-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { resolveEventReviewDecision } from "@/lib/workflow/event-review-policy";
import { getActiveTenant } from "@/lib/tenants/active-tenant";
import { getFacilitiesForTenant } from "@/lib/facilities/queries";
import type { FacilityGroup } from "@/components/admin/training/FacilityResourceSelector";

export default async function NewMatchEventPage() {
  const session = await requirePermission(PERMISSIONS.EVENTS_MANAGE);

  const tenantContext = await getActiveTenant();
  if (!tenantContext) notFound();

  const facilities = await getFacilitiesForTenant(tenantContext.id);

  function facilityGroupsForTypes(types: readonly string[]): FacilityGroup[] {
    return facilities
      .filter((f) => f.status !== "ARCHIVED")
      .map((f) => ({
        facilityId: f.id,
        facilityName: f.name,
        resources: f.resources
          .filter((r) => r.status !== "ARCHIVED" && types.includes(r.type))
          .map((r) => ({
            id: r.id,
            name: r.name,
            code: r.code,
            type: r.type,
            facilityId: f.id,
            facilityName: f.name,
          })),
      }))
      .filter((fg) => fg.resources.length > 0);
  }

  const pitchHallFacilityGroups = facilityGroupsForTypes(["FULL_PITCH", "HALF_PITCH"]);
  const dressingRoomFacilityGroups = facilityGroupsForTypes(["DRESSING_ROOM"]);

  // PLANNING-CREATION-UX-01C: same review-decision inputs POST /api/events
  // itself uses for a MATCH create (see app/api/events/route.ts) — mirrored
  // here ONLY to tell the admin up front whether submitting will create the
  // match directly or send it for review. The server route remains the sole
  // authority; this never gates the submit button itself.
  const hasLeadingEventCapability =
    hasPermission(session, PERMISSIONS.EVENTS_PUBLISH_WEBSITE) ||
    hasPermission(session, PERMISSIONS.EVENTS_PUBLISH_INFOBOARD);

  const eventReviewDecision = resolveEventReviewDecision("create_event", {
    canCreate: true,
    canReview: hasLeadingEventCapability,
    canApprove: hasLeadingEventCapability,
    canPublish: hasLeadingEventCapability,
    canDirectManage: hasLeadingEventCapability,
    canReviewSeries: hasLeadingEventCapability,
  });

  return (
    <div className="max-w-[1000px] space-y-6">
      <AdminSectionHeader
        eyebrow="Matchcenter"
        title="Match erstellen"
        description="Geführte Erstellung: Team, Heim/Auswärts, Ort, Gegner und Termin werden direkt erfasst. Bei Heimspielen werden Spielfeld/Halle und Garderobe mit Live-Verfügbarkeit zugewiesen."
        actions={
          <Link href="/dashboard/matchcenter" className="fca-button-secondary">
            Zurück zum Matchcenter
          </Link>
        }
      />

      <MatchGuidedCreateForm
        pitchHallFacilityGroups={pitchHallFacilityGroups}
        dressingRoomFacilityGroups={dressingRoomFacilityGroups}
        canValidateDirectly={eventReviewDecision.allowsDirectExecution}
      />
    </div>
  );
}
