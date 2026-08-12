import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getActiveTenant } from "@/lib/tenants/active-tenant";
import { getTournament } from "@/lib/tournaments/tournament-service";
import { TournamentNotFoundError } from "@/lib/tournaments/errors";
import { getFacilitiesForTenant } from "@/lib/facilities/queries";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import { ToastProvider } from "@/components/ui/ToastProvider";
import TournamentEditForm from "@/components/admin/tournamentcenter/TournamentEditForm";
import type { FacilityGroup } from "@/components/admin/training/FacilityResourceSelector";

type Props = { params: Promise<{ tournamentId: string }> };

export default async function TournamentEditPage({ params }: Props) {
  // ADMIN-DELETE-02A: a delegated user may hold tournaments.delete without
  // events.view/events.manage — they must still be able to reach this page
  // to exercise the permanent-delete action gated below (mirrors
  // app/(admin)/dashboard/teams/[teamId]/page.tsx, ADMIN-DELETE-01B).
  const session = await requireAnyPermission([
    PERMISSIONS.EVENTS_VIEW,
    PERMISSIONS.EVENTS_MANAGE,
    PERMISSIONS.TOURNAMENTS_DELETE,
  ]);

  const tenantContext = await getActiveTenant();
  if (!tenantContext) notFound();

  const canManage = hasPermission(session, PERMISSIONS.EVENTS_MANAGE);
  // ADMIN-DELETE-02A: permanent "Löschen" gating — deliberately independent
  // of canManage/events.manage.
  const canDelete = hasPermission(session, PERMISSIONS.TOURNAMENTS_DELETE);
  const { tournamentId } = await params;

  let tournament;
  try {
    tournament = await getTournament(tenantContext.id, tournamentId);
  } catch (err) {
    if (err instanceof TournamentNotFoundError) notFound();
    throw err;
  }

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
    <ToastProvider>
      <div className="max-w-[900px] space-y-6">
        <Link
          href="/dashboard/tournamentcenter"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-2)] transition hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Zurück zum TournamentCenter
        </Link>

        <AdminSectionHeader
          eyebrow="TournamentCenter · Turnier bearbeiten"
          title={tournament.title}
          description="Änderungen gelten für dieses Turnier. Sichtbarkeits-Einstellungen wirken sich direkt auf Website, Wochenplan, Teamseite und Infoboard aus."
        />

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <TournamentEditForm
            tournament={tournament}
            canManage={canManage}
            canDelete={canDelete}
            pitchHallFacilityGroups={pitchHallFacilityGroups}
            dressingRoomFacilityGroups={dressingRoomFacilityGroups}
          />
        </div>
      </div>
    </ToastProvider>
  );
}
