import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import PersonsList from "@/components/admin/persons/PersonsList";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

export default async function PersonsPage() {
  await requirePermission(PERMISSIONS.PEOPLE_VIEW);

  const records = await prisma.person.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      displayName: true,
      email: true,
      phone: true,
      dateOfBirth: true,
      isActive: true,
      isPlayer: true,
      isTrainer: true,
      trainerExperienceYears: true,
      clubJoinDate: true,
      playerSquadMembers: {
        where: { status: "ACTIVE" },
        take: 1,
        orderBy: { createdAt: "desc" },
        select: {
          teamSeason: {
            select: {
              shortName: true,
              displayName: true,
              team: { select: { name: true } },
            },
          },
        },
      },
      trainerTeamMembers: {
        where: { status: "ACTIVE" },
        orderBy: { sortOrder: "asc" },
        select: {
          roleLabel: true,
          teamSeason: {
            select: {
              shortName: true,
              displayName: true,
              team: { select: { name: true } },
            },
          },
        },
      },
      user: {
        select: {
          isActive: true,
          userRoles: {
            select: {
              role: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  const persons = records.map((person) => {
    const name = person.displayName ?? `${person.firstName} ${person.lastName}`.trim();
    const activePlayerTeam = person.playerSquadMembers[0]?.teamSeason ?? null;
    const activeTrainerTeams = person.trainerTeamMembers.map((entry) => entry.teamSeason.shortName ?? entry.teamSeason.displayName ?? entry.teamSeason.team.name);
    const roleNames = person.user?.userRoles.map((entry) => entry.role.name) ?? [];

    const typeLabels = [
      person.isPlayer ? "Spieler" : null,
      person.isTrainer ? "Trainer" : null,
      roleNames.length ? "Vereinsfunktionär" : null,
      !person.isPlayer && !person.isTrainer && roleNames.length === 0 ? "Person" : null,
    ].filter((value): value is string => Boolean(value));

    return {
      id: person.id,
      name,
      email: person.email,
      phone: person.phone,
      imageSrc: null,
      isActive: person.isActive,
      typeLabels,
      primaryType: person.isTrainer ? "Trainer" : person.isPlayer ? "Spieler" : roleNames.length ? "Vereinsfunktionär" : "Person",
      teamLabel:
        activePlayerTeam?.shortName ??
        activePlayerTeam?.displayName ??
        activePlayerTeam?.team.name ??
        activeTrainerTeams[0] ??
        null,
      roleLabel: roleNames[0] ?? person.trainerTeamMembers[0]?.roleLabel ?? null,
      birthYear: person.dateOfBirth ? String(person.dateOfBirth.getFullYear()) : null,
      trainerExperienceYears: person.trainerExperienceYears,
      clubJoinDate: person.clubJoinDate ? person.clubJoinDate.toISOString() : null,
    };
  });

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Personen"
        title="Personen"
        description="Eine zentrale Personenübersicht für Spieler, Trainer, Vereinsfunktionäre, Sponsor-Kontakte und weitere Rollen."
      />

      <PersonsList persons={persons} />
    </div>
  );
}
