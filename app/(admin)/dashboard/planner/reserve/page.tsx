import PitchReservationForm from "@/components/admin/reservations/PitchReservationForm";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function ReservePitchPage() {
  await requirePermission(PERMISSIONS.WOCHENPLAN_MANAGE);

  const [seasons, teams, resources] = await Promise.all([
    prisma.season.findMany({
      orderBy: [{ startDate: "desc" }],
      select: {
        id: true,
        name: true,
        isActive: true,
      },
    }),
    prisma.team.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        category: true,
      },
    }),
    prisma.planningResource.findMany({
      where: { isActive: true },
      orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        key: true,
        name: true,
        type: true,
      },
    }),
  ]);

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Planung"
        title="Platz reservieren"
        description="Training, Testspiel, Turnier oder sonstigen platzrelevanten Event mit Spielfeld und Garderoben zur Freigabe in den Wochenplan einreichen."
      />

      <PitchReservationForm
        seasons={seasons}
        teams={teams}
        pitches={resources.filter((resource) => resource.type === "PITCH")}
        dressingRooms={resources.filter((resource) => resource.type === "DRESSING_ROOM")}
      />
    </div>
  );
}
