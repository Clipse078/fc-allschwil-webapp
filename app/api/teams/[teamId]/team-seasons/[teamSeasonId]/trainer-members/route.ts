import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

function personName(person: { displayName: string | null; firstName: string; lastName: string }) {
  return person.displayName || `${person.firstName} ${person.lastName}`.trim();
}

export async function GET(req: Request, { params }: any) {
  const { teamSeasonId } = params;

  try {
    const data = await prisma.trainerTeamMember.findMany({
      where: { teamSeasonId },
      include: { person: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json(
      data.map((x) => ({
        id: x.person.id,
        name: personName(x.person),
        imageUrl: null,
      }))
    );
  } catch {
    return NextResponse.json({ error: "Failed to load trainers" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: any) {
  const { teamSeasonId } = params;

  try {
    const body = await req.json();
    const personId = body?.personId;

    if (!personId) {
      return NextResponse.json({ error: "personId is required" }, { status: 400 });
    }

    await prisma.trainerTeamMember.upsert({
      where: { teamSeasonId_personId: { teamSeasonId, personId } },
      update: { status: "ACTIVE" },
      create: { teamSeasonId, personId },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to assign trainer" }, { status: 500 });
  }
}
