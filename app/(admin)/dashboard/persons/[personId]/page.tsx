import PlayerSeasonRatingsCard from "@/components/admin/players/PlayerSeasonRatingsCard";
import TrainerQualificationsCard from "@/components/admin/players/TrainerQualificationsCard";
import BasePersonProfile from "@/components/admin/persons/profile/BasePersonProfile";
import PlayerProfile from "@/components/admin/persons/profile/PlayerProfile";
import StaffProfile from "@/components/admin/persons/profile/StaffProfile";
import TrainerProfile from "@/components/admin/persons/profile/TrainerProfile";
import { auth } from "@/auth";
import { getPlayerRatingPermissionReasons } from "@/lib/players/player-rating-permissions";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

type Props = {
  params: Promise<{ personId: string }>;
};

function getName(input: { displayName: string | null; firstName: string; lastName: string }) {
  return input.displayName ?? `${input.firstName} ${input.lastName}`.trim();
}

export default async function PersonDetailPage({ params }: Props) {
  await requirePermission(PERMISSIONS.PEOPLE_VIEW);
  const session = await auth();
  const { personId } = await params;

  const person = await prisma.person.findUnique({
    where: { id: personId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      displayName: true,
      email: true,
      phone: true,
      dateOfBirth: true,
      notes: true,
      isActive: true,
      isPlayer: true,
      isTrainer: true,
      trainerExperienceYears: true,
      clubJoinDate: true,
      photoUrl: true,
      user: {
        select: {
          isActive: true,
          accessState: true,
          userRoles: {
            select: {
              role: {
                select: {
                  name: true,
                  key: true,
                  organigrammDisplayName: true,
                  organigrammDepartment: { select: { name: true } },
                },
              },
            },
          },
        },
      },
      playerSquadMembers: {
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        select: {
          shirtNumber: true,
          positionLabel: true,
          isCaptain: true,
          isViceCaptain: true,
          teamSeason: {
            select: {
              shortName: true,
              displayName: true,
              season: { select: { name: true, isActive: true } },
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
          isWebsiteVisible: true,
          teamSeason: {
            select: {
              shortName: true,
              displayName: true,
              season: { select: { name: true, isActive: true } },
              team: { select: { name: true } },
            },
          },
        },
      },
      trainerQualifications: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          issuer: true,
          issuedAt: true,
          expiresAt: true,
          isClubVerified: true,
          isWebsiteVisible: true,
          createdAt: true,
        },
      },
      playerSeasonRatings: {
        orderBy: { season: { startDate: "desc" } },
        select: {
          id: true,
          personId: true,
          seasonId: true,
          overallRating: true,
          potentialRating: true,
          technicalRating: true,
          tacticalRating: true,
          physicalRating: true,
          mentalityRating: true,
          socialRating: true,
          notes: true,
          season: { select: { id: true, key: true, name: true, isActive: true } },
        },
      },
      vereinsleitungOwnedMatters: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { title: true, status: true, priority: true, dueDate: true },
      },
      meetingParticipants: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          displayName: true,
          roleLabel: true,
          status: true,
          meeting: { select: { title: true, startAt: true } },
        },
      },
    },
  });

  if (!person) notFound();

  const name = getName(person);
  const roleNames = person.user?.userRoles.map((entry) => entry.role.organigrammDisplayName ?? entry.role.name) ?? [];
  const departments = Array.from(new Set((person.user?.userRoles.map((entry) => entry.role.organigrammDepartment?.name).filter((value): value is string => Boolean(value)) ?? [])));
  const primaryType = person.isPlayer ? "Spieler" : person.isTrainer ? "Trainer" : roleNames.length ? "Vereinsfunktionär" : "Person";
  const typeLabels = [
    person.isPlayer ? "Spieler" : null,
    person.isTrainer ? "Trainer" : null,
    roleNames.length ? "Vereinsfunktionär" : null,
    !person.isPlayer && !person.isTrainer && roleNames.length === 0 ? "Person" : null,
  ].filter((value): value is string => Boolean(value));

  const seasons = person.isPlayer
    ? await prisma.season.findMany({ orderBy: { startDate: "desc" }, select: { id: true, key: true, name: true, isActive: true } })
    : [];

  const currentSeason = seasons.find((season) => season.isActive) ?? null;
  const actorUserId = session?.user?.effectiveUserId ?? session?.user?.id ?? null;
  const ratingPermission = person.isPlayer && currentSeason
    ? await getPlayerRatingPermissionReasons({ userId: actorUserId ?? null, personId: person.id, seasonId: currentSeason.id })
    : { canRate: false, reasons: ["Keine aktive Saison gefunden."] };

  if (person.isPlayer) {
    return (
      <PlayerProfile
        person={person}
        name={name}
        primaryType={primaryType}
        typeLabels={typeLabels}
        ratings={
          <PlayerSeasonRatingsCard
            personId={person.id}
            seasons={seasons}
            currentSeasonId={currentSeason?.id ?? null}
            initialRatings={person.playerSeasonRatings}
            canEdit={ratingPermission.canRate}
            permissionReasons={ratingPermission.reasons}
          />
        }
      />
    );
  }

  if (person.isTrainer) {
    return (
      <TrainerProfile
        person={person}
        name={name}
        primaryType={primaryType}
        typeLabels={typeLabels}
        qualificationsEditor={<TrainerQualificationsCard personId={person.id} initialQualifications={person.trainerQualifications} canEdit={true} />}
      />
    );
  }

  if (roleNames.length) {
    return <StaffProfile person={person} name={name} primaryType={primaryType} typeLabels={typeLabels} roleNames={roleNames} departments={departments} />;
  }

  return <BasePersonProfile person={person} name={name} primaryType={primaryType} typeLabels={typeLabels} />;
}







