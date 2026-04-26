import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

type Context = {
  params: Promise<{ teamId: string; teamSeasonId: string }>;
};

function personName(person: { displayName: string | null; firstName: string; lastName: string }) {
  return person.displayName || `${person.firstName} ${person.lastName}`.trim();
}

export async function GET(_: Request, context: Context) {
  const { teamSeasonId } = await context.params;

  try {
    const data = await prisma.playerSquadMember.findMany({
      where: { teamSeasonId },
      include: { person: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json(
      data.map((x) => ({
        id: x.id,
        personId: x.personId,
        name: personName(x.person),
        subline: [x.shirtNumber ? "Nr. " + x.shirtNumber : "", x.person.dateOfBirth ? "Jahrgang " + new Date(x.person.dateOfBirth).getUTCFullYear() : ""].filter(Boolean).join(" • "),
        meta: x.positionLabel ?? "",
        imageUrl: null,
      })),
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Spieler konnten nicht geladen werden." }, { status: 500 });
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

    const member = await prisma.playerSquadMember.upsert({
      where: { teamSeasonId_personId: { teamSeasonId, personId } },
      update: { status: "ACTIVE" },
      create: { teamSeasonId, personId },
      include: { person: true },
    });

    return NextResponse.json({
      id: member.id,
      personId: member.personId,
      name: personName(member.person),
      subline: [member.shirtNumber ? "Nr. " + member.shirtNumber : "", member.person.dateOfBirth ? "Jahrgang " + new Date(member.person.dateOfBirth).getUTCFullYear() : ""].filter(Boolean).join(" • "),
      meta: member.positionLabel ?? "",
      imageUrl: null,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Spieler konnte nicht hinzugefügt werden." }, { status: 500 });
  }
}

