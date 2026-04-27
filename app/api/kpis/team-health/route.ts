import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

function normalizeLabel(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/-/g, "");
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

function getTeamRuleKeys(team: {
  category: string | null;
  ageGroup: string | null;
  name: string;
}) {
  const keys = [
    team.ageGroup,
    team.category,
    team.name.match(/\b(D7|D9|[GFECBA])\b/i)?.[1],
  ]
    .filter(Boolean)
    .map((value) => String(value).trim().toUpperCase());

  return Array.from(new Set(keys));
}

export async function GET() {
  try {
    const clubConfig = await prisma.clubConfig.findFirst({
      include: {
        teamCategoryRules: { include: { qualificationRequirements: { include: { qualificationDefinition: true }, orderBy: [{ sortOrder: "asc" }] } } },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const rules = clubConfig?.teamCategoryRules ?? [];

    const teams = await prisma.team.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        teamSeasons: {
          include: {
            season: true,
            trainerTeamMembers: {
              where: {
                status: "ACTIVE",
              },
              include: {
                person: {
                  include: {
                    trainerQualifications: {
                      where: {
                        type: "DIPLOMA",
                        status: {
                          in: ["VALID", "IN_PROGRESS", "UNKNOWN"],
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const results = teams.map((team) => {
      const activeSeason =
        team.teamSeasons.find((teamSeason) => teamSeason.season.isActive) ??
        team.teamSeasons[0];

      if (!activeSeason) {
        return {
          teamId: team.id,
          teamName: team.name,
          category: team.category,
          ageGroup: team.ageGroup,
          status: "unknown",
          hasRequired: false,
          hasEnoughTrainers: false,
          trainerCount: 0,
          requiredTrainerCount: null,
          requiredDiploma: null,
          matchedRuleCategory: null,
        };
      }

      const ruleKeys = getTeamRuleKeys(team);
      const rule =
        rules.find((candidate) =>
          ruleKeys.includes(candidate.category.trim().toUpperCase())
        ) ??
        rules.find(
          (candidate) =>
            candidate.category.trim().toUpperCase() ===
            String(team.category).trim().toUpperCase()
        ) ??
        null;

      const trainerDiplomas = activeSeason.trainerTeamMembers.flatMap((member) =>
        member.person.trainerQualifications.map((qualification) => qualification.title)
      );

      const firstRequirement = rule?.qualificationRequirements?.[0] ?? null;
      const requiredDiploma = firstRequirement?.qualificationDefinition?.name ?? null;
      const requiredDiplomaRank = getDiplomaRank(requiredDiploma);
      const requiredDiplomaTrainerCount = firstRequirement?.requiredTrainerCount ?? 1;
      const matchingDiplomaTrainerCount =
        requiredDiplomaRank === 0
          ? 0
          : activeSeason.trainerTeamMembers.filter((member) =>
              member.person.trainerQualifications.some(
                (qualification) => getDiplomaRank(qualification.title) >= requiredDiplomaRank
              )
            ).length;

      const hasRequired =
        requiredDiplomaTrainerCount === 0
          ? true
          : matchingDiplomaTrainerCount >= requiredDiplomaTrainerCount;

      const requiredTrainerCount = rule?.minTrainerCount ?? null;
      const trainerCount = activeSeason.trainerTeamMembers.length;
      const hasEnoughTrainers =
        typeof requiredTrainerCount === "number"
          ? trainerCount >= requiredTrainerCount
          : false;

      return {
        teamId: team.id,
        teamName: team.name,
        category: team.category,
        ageGroup: team.ageGroup,
        requiredDiploma,
        requiredTrainerCount,
        requiredDiplomaTrainerCount,
        matchingDiplomaTrainerCount,
        matchedRuleCategory: rule?.category ?? null,
        hasRequired,
        hasEnoughTrainers,
        trainerCount,
        trainerDiplomas,
        status: hasRequired && hasEnoughTrainers ? "healthy" : "attention",
      };
    });

    const summary = {
      total: results.length,
      compliant: results.filter((result) => result.hasRequired && result.hasEnoughTrainers).length,
      nonCompliant: results.filter((result) => !result.hasRequired || !result.hasEnoughTrainers).length,
      missingRule: results.filter((result) => !result.matchedRuleCategory).length,
    };

    return NextResponse.json({
      config: clubConfig
        ? {
            club: clubConfig.clubName,
            country: clubConfig.country,
            rules: rules.length,
          }
        : null,
      summary,
      teams: results,
    });
  } catch (error) {
    console.error("Failed to load team health KPIs", error);

    return NextResponse.json(
      { error: "Team health KPIs konnten nicht geladen werden." },
      { status: 500 }
    );
  }
}









