import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

function normalizeLabel(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/-/g, "");
}

function getFallbackDiplomaLevel(label: string | null | undefined) {
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

function getQualificationLevel(
  title: string | null | undefined,
  definitionLevels: Map<string, number>,
) {
  const normalizedTitle = normalizeLabel(title);
  const configuredLevel = definitionLevels.get(normalizedTitle);

  if (typeof configuredLevel === "number" && configuredLevel > 0) {
    return configuredLevel;
  }

  return getFallbackDiplomaLevel(title);
}

export async function GET() {
  try {
    const clubConfig = await prisma.clubConfig.findFirst({
      include: {
        qualificationDefinitions: true,
        teamCategoryRules: {
          include: {
            qualificationRequirements: {
              include: {
                qualificationDefinition: true,
              },
              orderBy: [{ sortOrder: "asc" }],
            },
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const rules = clubConfig?.teamCategoryRules ?? [];

    const definitionLevels = new Map<string, number>(
      (clubConfig?.qualificationDefinitions ?? []).map((definition) => [
        normalizeLabel(definition.name),
        definition.hierarchyLevel > 0
          ? definition.hierarchyLevel
          : getFallbackDiplomaLevel(definition.name),
      ]),
    );

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
            playerSquadMembers: {
              where: {
                status: "ACTIVE",
              },
              include: {
                person: {
                  select: {
                    dateOfBirth: true,
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
          hasHealthyPlayerTrainerRatio: null,
          playerCount: 0,
          trainerCount: 0,
          requiredTrainerCount: null,
          maxPlayersPerTrainer: null,
          requiredDiploma: null,
          requiredDiplomaLevel: null,
          requiredDiplomaTrainerCount: null,
          matchingDiplomaTrainerCount: 0,
          matchedRuleCategory: null,
          qualificationRequirements: [],
        };
      }

      const ruleKeys = getTeamRuleKeys(team);
      const rule =
        rules.find((candidate) =>
          ruleKeys.includes(candidate.category.trim().toUpperCase()),
        ) ??
        rules.find(
          (candidate) =>
            candidate.category.trim().toUpperCase() ===
            String(team.category).trim().toUpperCase(),
        ) ??
        null;

      const playerCount = activeSeason.playerSquadMembers.length;
      const birthYearCounts = Array.from(
        activeSeason.playerSquadMembers.reduce((counts, member) => {
          const value = member.person.dateOfBirth;
          if (!value) return counts;

          const year = value.getUTCFullYear();
          if (!Number.isFinite(year)) return counts;

          counts.set(year, (counts.get(year) ?? 0) + 1);
          return counts;
        }, new Map<number, number>()),
      )
        .sort(([a], [b]) => a - b)
        .map(([year, count]) => ({ year, count }));
      const trainerCount = activeSeason.trainerTeamMembers.length;
      const requiredTrainerCount = rule?.minTrainerCount ?? null;
      const maxPlayersPerTrainer = rule?.maxPlayersPerTrainer ?? null;

      const trainerDiplomas = activeSeason.trainerTeamMembers.flatMap((member) =>
        member.person.trainerQualifications.map((qualification) => qualification.title),
      );

      const requirementResults =
        rule?.qualificationRequirements?.map((requirement) => {
          const qualificationName = requirement.qualificationDefinition?.name ?? null;
          const requiredLevel =
            requirement.qualificationDefinition?.hierarchyLevel && requirement.qualificationDefinition.hierarchyLevel > 0
              ? requirement.qualificationDefinition.hierarchyLevel
              : getFallbackDiplomaLevel(qualificationName);

                    const matchingQualifications =
            requiredLevel === 0
              ? []
              : activeSeason.trainerTeamMembers.flatMap((member) =>
                  member.person.trainerQualifications
                    .filter(
                      (qualification) =>
                        getQualificationLevel(qualification.title, definitionLevels) >= requiredLevel,
                    )
                    .map((qualification) => ({
                      title: qualification.title,
                      level: getQualificationLevel(qualification.title, definitionLevels),
                    })),
                );

          const matchingTrainerCount =
            requiredLevel === 0
              ? 0
              : activeSeason.trainerTeamMembers.filter((member) =>
                  member.person.trainerQualifications.some(
                    (qualification) =>
                      getQualificationLevel(qualification.title, definitionLevels) >= requiredLevel,
                  ),
                ).length;

          const fulfilledByQualificationName =
            matchingQualifications.sort((a, b) => b.level - a.level || a.title.localeCompare(b.title))[0]?.title ?? null;

          return {
            qualificationName,
            requiredDiploma: qualificationName,
            requiredLevel,
            requiredTrainerCount: requirement.requiredTrainerCount,
            matchingTrainerCount,
            fulfilledByQualificationName,
            isFulfilled:
              requirement.requiredTrainerCount === 0
                ? true
                : matchingTrainerCount >= requirement.requiredTrainerCount,
          };
        }) ?? [];

      const firstRequirement = requirementResults[0] ?? null;
      const requiredDiploma = firstRequirement?.qualificationName ?? null;
      const requiredDiplomaLevel = firstRequirement?.requiredLevel ?? null;
      const requiredDiplomaTrainerCount = firstRequirement?.requiredTrainerCount ?? null;
      const matchingDiplomaTrainerCount = firstRequirement?.matchingTrainerCount ?? 0;

      const hasRequired =
        requirementResults.length === 0
          ? true
          : requirementResults.every((requirement) => requirement.isFulfilled);

      const hasEnoughTrainers =
        typeof requiredTrainerCount === "number"
          ? trainerCount >= requiredTrainerCount
          : false;

      const hasHealthyPlayerTrainerRatio =
        typeof maxPlayersPerTrainer === "number" && maxPlayersPerTrainer > 0
          ? trainerCount > 0 && playerCount / trainerCount <= maxPlayersPerTrainer
          : null;

      return {
        teamId: team.id,
        teamSeasonId: activeSeason.id,
        teamName: team.name,
        category: team.category,
        ageGroup: team.ageGroup,
        playerCount,
        birthYearCounts,
        trainerCount,
        requiredDiploma,
        requiredDiplomaLevel,
        requiredTrainerCount,
        maxPlayersPerTrainer,
        requiredDiplomaTrainerCount,
        matchingDiplomaTrainerCount,
        matchedRuleCategory: rule?.category ?? null,
        qualificationRequirements: requirementResults,
        hasRequired,
        hasEnoughTrainers,
        hasHealthyPlayerTrainerRatio,
        trainerDiplomas,
        status:
          hasRequired &&
          hasEnoughTrainers &&
          (hasHealthyPlayerTrainerRatio === null || hasHealthyPlayerTrainerRatio)
            ? "healthy"
            : "attention",
      };
    });

    const summary = {
      total: results.length,
      compliant: results.filter(
        (result) =>
          result.hasRequired &&
          result.hasEnoughTrainers &&
          (result.hasHealthyPlayerTrainerRatio === null || result.hasHealthyPlayerTrainerRatio),
      ).length,
      nonCompliant: results.filter(
        (result) =>
          !result.hasRequired ||
          !result.hasEnoughTrainers ||
          result.hasHealthyPlayerTrainerRatio === false,
      ).length,
      missingRule: results.filter((result) => !result.matchedRuleCategory).length,
    };

    return NextResponse.json({
      config: clubConfig
        ? {
            club: clubConfig.clubName,
            country: clubConfig.country,
            rules: rules.length,
            qualificationDefinitions: clubConfig.qualificationDefinitions.length,
          }
        : null,
      summary,
      teams: results,
    });
  } catch (error) {
    console.error("Failed to load team health KPIs", error);

    return NextResponse.json(
      { error: "Team health KPIs konnten nicht geladen werden." },
      { status: 500 },
    );
  }
}


