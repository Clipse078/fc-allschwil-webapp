import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

type Context = {
  params: Promise<{ teamId: string; teamSeasonId: string }>;
};

export async function POST(req: Request, context: Context) {
  try {
    const { teamSeasonId } = await context.params;
    const body = await req.json();
    const { type, items } = body as {
      type: "trainer" | "player";
      items: { personId: string; sortOrder: number }[];
    };

    if ((type !== "trainer" && type !== "player") || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Ungültige Sortierung." }, { status: 400 });
    }

    const updates = items.map((item) => {
      if (type === "trainer") {
        return prisma.trainerTeamMember.updateMany({
          where: { teamSeasonId, personId: item.personId },
          data: { sortOrder: item.sortOrder },
        });
      }

      return prisma.playerSquadMember.updateMany({
        where: { teamSeasonId, personId: item.personId },
        data: { sortOrder: item.sortOrder },
      });
    });

    await prisma.$transaction(updates);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? "Technischer Fehler: " + error.message : "Reihenfolge konnte nicht gespeichert werden." },
      { status: 500 },
    );
  }
}
