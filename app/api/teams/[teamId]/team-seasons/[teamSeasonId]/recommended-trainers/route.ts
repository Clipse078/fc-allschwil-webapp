import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

type Context = {
  params: Promise<{ teamId: string; teamSeasonId: string }>;
};

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

function personName(person: { displayName: string | null; firstName: string; lastName: string }) {
  return person.displayName || `${person.firstName} ${person.lastName}`.trim();
}

function yearsSince(date: Date | null) {
  if (!date) return null;
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return 0;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.25));
}

function isDiplomaStillValid(qualification: {
  status: string;
  expiresAt: Date | null;
}) {
  if (qualification.status !== "VALID") return false;
  if (!qualification.expiresAt) return true;
  return qualification.expiresAt.getTime() >= Date.now();
}

export async function GET(_: Request, context: Context) {
  try {
    const { teamId, teamSeasonId } = await context.params;

    const teamSeason = await prisma.teamSeason.findUnique({
      where: { id: teamSeasonId },
      include: {
        team: true,
        trainerTeamMembers: {
          select: { personId: true },
        },
      },
    });

    if (!teamSeason || teamSeason.teamId !== teamId) {
      return NextResponse.json({ error: "Team-Saison nicht gefunden." }, { status: 404 });
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

    const excludedIds = new Set(teamSeason.trainerTeamMembers.map((entry) => entry.personId));
    const ruleKey = String(teamSeason.team.ageGroup ?? teamSeason.team.category ?? "").trim().toUpperCase();

    const rule =
      clubConfig?.teamCategoryRules.find((entry) => entry.category.trim().toUpperCase() === ruleKey) ??
      clubConfig?.teamCategoryRules.find((entry) => entry.category.trim().toUpperCase() === String(teamSeason.team.category).trim().toUpperCase()) ??
      null;

    const requiredRank = Math.max(
      0,
      ...(rule?.qualificationRequirements ?? []).map((requirement) =>
        getDiplomaRank(requirement.qualificationDefinition?.name ?? null),
      ),
    );

    const people = await prisma.person.findMany({
      where: { isActive: true, isTrainer: true },
      take: 80,
      include: {
        trainerQualifications: true,
        trainerTeamMembers: true,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    const scored = people
      .filter((person) => !excludedIds.has(person.id))
      .map((person) => {
        const validDiplomas = person.trainerQualifications.filter(isDiplomaStillValid);
        const bestRank = Math.max(0, ...validDiplomas.map((qualification) => getDiplomaRank(qualification.title)));
        const hasValidDiploma = validDiplomas.length > 0;
        const activeAssignments = person.trainerTeamMembers.filter((assignment) => assignment.status === "ACTIVE").length;
        const hasRequiredDiploma = requiredRank === 0 || bestRank >= requiredRank;
        const experienceYears = person.trainerExperienceYears ?? 0;
        const yearsAtClub = yearsSince(person.clubJoinDate);

        let score = 50;

        if (hasRequiredDiploma) score += 30;
        if (bestRank > requiredRank) score += 8;
        if (hasValidDiploma) score += 12;
        score += Math.min(experienceYears * 3, 15);
        score += Math.min((yearsAtClub ?? 0) * 2, 12);
        if (activeAssignments === 0) score += 15;
        if (activeAssignments === 1) score += 5;
        if (activeAssignments >= 3) score -= 15;

        const reason = [
          hasValidDiploma ? "Diploma valid: yes" : "Diploma valid: no",
          requiredRank === 0 ? "No diploma target configured" : hasRequiredDiploma ? "Meets diploma target" : "Below diploma target",
          `Experience: ${experienceYears} year(s)`,
          yearsAtClub === null ? "Years at club: unknown" : `Years at club: ${yearsAtClub}`,
          activeAssignments === 0 ? "currently free" : `${activeAssignments} active assignment(s)`,
        ].join(" • ");

        return {
          id: person.id,
          displayName: personName(person),
          functionLabel: "Trainer",
          teamLabel: reason,
          score,
          reason,
          experienceYears,
          yearsAtClub,
          diplomaValid: hasValidDiploma,
        };
      })
      .sort((a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName))
      .slice(0, 5);

    return NextResponse.json(scored);
  } catch (error) {
    console.error("Recommended trainers failed:", error);
    return NextResponse.json({ error: "Empfohlene Trainer konnten nicht geladen werden." }, { status: 500 });
  }
}