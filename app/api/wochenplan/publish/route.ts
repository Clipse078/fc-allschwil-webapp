import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const eventIds = Array.isArray(body?.eventIds)
    ? body.eventIds.filter((id: unknown) => typeof id === "string")
    : [];

  if (eventIds.length === 0) {
    return NextResponse.json(
      { error: "Keine Wochenplan-Einträge zum Publizieren erhalten." },
      { status: 400 },
    );
  }

  const result = await prisma.event.updateMany({
    where: {
      id: {
        in: eventIds,
      },
    },
    data: {
      wochenplanVisible: true,
      websiteVisible: true,
      infoboardVisible: true,
      publishedAt: new Date(),
      publishedByUserId: session.user.id,
    },
  });

  return NextResponse.json({
    publishedCount: result.count,
  });
}
