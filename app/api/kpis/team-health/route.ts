import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

function getRequiredDiploma(category: string | null) {
  if (!category) return "D-Diplom";

  if (["G", "F", "E"].includes(category)) return "D-Diplom";
  if (["D7", "D9", "C", "B", "A"].includes(category)) return "C-Diplom";

  return "B-Diplom"; // Aktive / default
}

function normalizeDiploma(label: string) {
  return label.toLowerCase();
}

function meetsRequirement(required: string, trainerDiplomas: string[]) {
  const req = normalizeDiploma(required);

  return trainerDiplomas.some((d) => {
    const diploma = normalizeDiploma(d);

    if (req.includes("d")) {
      return diploma.includes("d") || diploma.includes("c") || diploma.includes("b") || diploma.includes("a");
    }
    if (req.includes("c")) {
      return diploma.includes("c") || diploma.includes("b") || diploma.includes("a");
    }
    if (req.includes("b")) {
      return diploma.includes("b") || diploma.includes("a");
    }
    return false;
  });
}

export async function GET() {
  try {
    const teams = await prisma.team.findMany({
      include: {
        teamSeasons: {
          include: {
            season: true,
            trainerTeamMembers: {
              include: {
                person: {
                  include: {
                    trainerQualifications: true,
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
        team.teamSeasons.find((s) => s.season.isActive) ??
        team.teamSeasons[0];

      if (!activeSeason) {
        return {
          teamId: team.id,
          teamName: team.name,
          status: "unknown",
        };
      }

      const required = getRequiredDiploma(team.category);

      const trainerDiplomas = activeSeason.trainerTeamMembers.flatMap((tm) =>
        tm.person.trainerQualifications.map((q) => q.title)
      );

      const ok = meetsRequirement(required, trainerDiplomas);

      return {
        teamId: team.id,
        teamName: team.name,
        category: team.category,
        requiredDiploma: required,
        hasRequired: ok,
        trainerCount: activeSeason.trainerTeamMembers.length,
      };
    });

    const summary = {
      total: results.length,
      compliant: results.filter((r) => r.hasRequired).length,
      nonCompliant: results.filter((r) => !r.hasRequired).length,
    };

    return NextResponse.json({
      summary,
      teams: results,
    });
  } catch (e) {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

