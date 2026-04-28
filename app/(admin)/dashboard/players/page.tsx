import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import PlayersList from "@/components/admin/players/PlayersList";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

export default async function PlayersPage() {
  await requirePermission(PERMISSIONS.PEOPLE_VIEW);

  const playerRecords = await prisma.person.findMany({
    where: {
      isPlayer: true,
    },
    orderBy: [
      { lastName: "asc" },
      { firstName: "asc" },
    ],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      displayName: true,
      dateOfBirth: true,
      isActive: true,
      playerSquadMembers: {
        where: {
          status: "ACTIVE",
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
        select: {
          teamSeason: {
            select: {
              displayName: true,
              shortName: true,
              team: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const players = playerRecords.map((player) => {
    const activeSquad = player.playerSquadMembers[0]?.teamSeason ?? null;

    return {
      id: player.id,
      name: player.displayName ?? `${player.firstName} ${player.lastName}`.trim(),
      teamLabel:
        activeSquad?.shortName ??
        activeSquad?.displayName ??
        activeSquad?.team.name ??
        null,
      positionLabel: null,
      birthYear: player.dateOfBirth ? String(player.dateOfBirth.getFullYear()) : null,
      imageSrc: null,
      isActive: player.isActive,
    };
  });

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Spieler"
        title="Spieler"
        description="Foto-first Spielerübersicht im FCA Premium UX Stil – mit echten Spielerprofilen, Teamhinweisen und direktem Zugriff auf die Saisonbewertungen."
      />

      <PlayersList players={players} />
    </div>
  );
}
