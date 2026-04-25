import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { type, items } = body as {
      type: "trainer" | "player";
      items: { personId: string; sortOrder: number }[];
    };

    if (!type || !items?.length) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const updates = items.map((item) => {
      if (type === "trainer") {
        return prisma.trainerTeamMember.updateMany({
          where: { personId: item.personId },
          data: { sortOrder: item.sortOrder },
        });
      }

      return prisma.playerSquadMember.updateMany({
        where: { personId: item.personId },
        data: { sortOrder: item.sortOrder },
      });
    });

    await prisma.$transaction(updates);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "Failed to reorder" }, { status: 500 });
  }
}