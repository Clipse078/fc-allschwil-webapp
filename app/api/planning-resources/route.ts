import { NextResponse } from "next/server";
import { PlanningResourceType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body?.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "Name fehlt." }, { status: 400 });
  }

  if (!Object.values(PlanningResourceType).includes(body.type)) {
    return NextResponse.json({ error: "Ungültiger Ressourcentyp." }, { status: 400 });
  }

  const baseKey =
    typeof body.key === "string" && body.key.trim()
      ? body.key.trim()
      : body.name
          .trim()
          .toLowerCase()
          .replace(/ä/g, "ae")
          .replace(/ö/g, "oe")
          .replace(/ü/g, "ue")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");

  const resource = await prisma.planningResource.create({
    data: {
      key: baseKey,
      name: body.name.trim(),
      type: body.type,
      sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 999,
      isActive: true,
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
    },
  });

  return NextResponse.json({ resource });
}
