import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

type Context = {
  params: Promise<{ teamId: string; teamSeasonId: string }>;
};

function displayName(person: { displayName: string | null; firstName: string; lastName: string }) {
  return person.displayName || [person.firstName, person.lastName].filter(Boolean).join(" ");
}

function normalizeLabel(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, "").replace(/-/g, "");
}

function getDiplomaRank(label: string | null | undefined) {
  const value = normalizeLabel(label);

  if (!value) return 0;
  if (value.includes("a")) return 4;
  if (value.includes("b")) return 3;
  if (value.includes("c")) return 2;
  if (value.includes("d")) return 1;

  return 0;
}

function getTeamRuleKeys(team: { category: string | null; ageGroup: string | null; name: string }) {
  return Array.from(
    new Set(
      [team.ageGroup, team.category, team.name.match(/\b(D7|D9|[GFECBA])\b/i)?.[1]]
        .filter(Boolean)
        .map((value) => String(value).trim().toUpperCase()),
    ),
  );
}

export async function GET(_: Request, context: Context) {
  try {
    const { teamId, teamSeasonId } = await context.params;

    const teamSeason = await prisma.teamSeason.findUnique({
      where: { id: teamSeasonId },
      select: {
        id: true,
        teamId: true,
        team: {
          select: {
            id: true,
            name: true,
            category: true,
            ageGroup: true,
          },
        },
        trainerTeamMembers: {
          select: { personId: true },
        },
      },
    });

    if (!teamSeason || teamSeason.teamId !== teamId) {
      return NextResponse.json({ error: "Team season not found." }, { status: 404 });
    }

    const clubConfig = await prisma.clubConfig.findFirst({
      include: {
        teamCategoryRules: {
          include: {
            qualificationRequirements: {
              include: { qualificationDefinition: true },
              orderBy: [{ sortOrder: "asc" }],
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const ruleKeys = getTeamRuleKeys(teamSeason.team);
    const rule =
      clubConfig?.teamCategoryRules.find((candidate) =>
        ruleKeys.includes(candidate.category.trim().toUpperCase()),
      ) ?? null;

    const requiredDiploma =
      rule?.qualificationRequirements?.[0]?.qualificationDefinition?.name ?? null;
    const requiredRank = getDiplomaRank(requiredDiploma);
    const assignedPersonIds = new Set(teamSeason.trainerTeamMembers.map((member) => member.personId));

    const trainers = await prisma.person.findMany({
      where: {
        isActive: true,
        isTrainer: true,
        id: { notIn: Array.from(assignedPersonIds) },
      },
      take: 30,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        displayName: true,
        email: true,
        phone: true,
        trainerQualifications: {
          select: {
            title: true,
            issuer: true,
            status: true,
            isClubVerified: true,
          },
        },
        trainerTeamMembers: {
          where: { status: "ACTIVE" },
          select: {
            teamSeason: {
              select: {
                displayName: true,
                shortName: true,
                status: true,
                team: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    const recommendations = trainers
      .map((trainer) => {
        const bestQualification = [...trainer.trainerQualifications].sort((a, b) => {
          const rankDiff = getDiplomaRank(b.title) - getDiplomaRank(a.title);
          if (rankDiff !== 0) return rankDiff;
          if (a.status !== b.status) return a.status === "VALID" ? -1 : 1;
          if (a.isClubVerified !== b.isClubVerified) return a.isClubVerified ? -1 : 1;
          return a.title.localeCompare(b.title);
        })[0];

        const bestRank = getDiplomaRank(bestQualification?.title);
        const qualificationMatches = requiredRank === 0 || bestRank >= requiredRank;
        const activeAssignments = trainer.trainerTeamMembers.filter(
          (member) => member.teamSeason.status === "ACTIVE",
        );

        const score =
          (qualificationMatches ? 60 : 0) +
          (bestQualification?.status === "VALID" ? 20 : 0) +
          (bestQualification?.isClubVerified ? 10 : 0) +
          Math.max(0, 10 - activeAssignments.length * 3);

        return {
          id: trainer.id,
          displayName: displayName(trainer),
          email: trainer.email,
          phone: trainer.phone,
          bestQualification: bestQualification
            ? [bestQualification.title, bestQualification.issuer, bestQualification.status === "VALID" ? "valid" : null]
                .filter(Boolean)
                .join(" - ")
            : null,
          requiredDiploma,
          qualificationMatches,
          activeAssignmentCount: activeAssignments.length,
          activeAssignments: activeAssignments.map((assignment) =>
            assignment.teamSeason.shortName ||
            assignment.teamSeason.team.name ||
            assignment.teamSeason.displayName,
          ),
          score,
          reason: qualificationMatches
            ? "Best match for the required diploma level."
            : "Available trainer, but diploma level should be checked.",
        };
      })
      .sort((a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName))
      .slice(0, 3);

    return NextResponse.json({ requiredDiploma, recommendations });
  } catch (error) {
    console.error("Recommended trainers failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Recommended trainers could not be loaded." },
      { status: 500 },
    );
  }
}