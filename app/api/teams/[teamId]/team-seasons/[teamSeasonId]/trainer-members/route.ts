import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

type Context = {
  params: Promise<{ teamId: string; teamSeasonId: string }>;
};

function personName(person: { displayName: string | null; firstName: string; lastName: string }) {
  return person.displayName || `${person.firstName} ${person.lastName}`.trim();
}

function bestQualificationLabel(person: {
  trainerQualifications: {
    title: string;
    issuer: string | null;
    status: string;
    isClubVerified: boolean;
  }[];
}) {
  const priority = ["VALID", "IN_PROGRESS", "PLANNED", "UNKNOWN", "EXPIRED"];
  const best = [...person.trainerQualifications].sort((a, b) => {
    const statusDiff = priority.indexOf(a.status) - priority.indexOf(b.status);
    if (statusDiff !== 0) return statusDiff;
    if (a.isClubVerified !== b.isClubVerified) return a.isClubVerified ? -1 : 1;
    return a.title.localeCompare(b.title);
  })[0];

  if (!best) return "";

  return [best.title, best.issuer, best.status === "VALID" ? "gültig" : null]
    .filter(Boolean)
    .join(" • ");
}

export async function GET(_: Request, context: Context) {
  const { teamSeasonId } = await context.params;

  try {
    const data = await prisma.trainerTeamMember.findMany({
      where: { teamSeasonId },
      include: {
        person: {
          include: {
            trainerQualifications: {
              select: {
                title: true,
                issuer: true,
                status: true,
                isClubVerified: true,
              },
            },
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json(
      data.map((x) => ({
        id: x.id,
        personId: x.personId,
        name: personName(x.person),
        subline: bestQualificationLabel(x.person) || x.person.email || "",
        meta: x.roleLabel ?? "Trainer",
        imageUrl: null,
      })),
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Trainer konnten nicht geladen werden." }, { status: 500 });
  }
}

export async function POST(req: Request, context: Context) {
  const { teamSeasonId } = await context.params;

  try {
    const body = await req.json();
    const personId = body?.personId;

    if (!personId) {
      return NextResponse.json({ error: "personId fehlt." }, { status: 400 });
    }

    const member = await prisma.trainerTeamMember.upsert({
      where: { teamSeasonId_personId: { teamSeasonId, personId } },
      update: { status: "ACTIVE" },
      create: { teamSeasonId, personId },
      include: {
        person: {
          include: {
            trainerQualifications: {
              select: {
                title: true,
                issuer: true,
                status: true,
                isClubVerified: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      id: member.id,
      personId: member.personId,
      name: personName(member.person),
      subline: bestQualificationLabel(member.person) || member.person.email || "",
      meta: member.roleLabel ?? "Trainer",
      imageUrl: null,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Trainer konnte nicht hinzugefügt werden." }, { status: 500 });
  }
}
