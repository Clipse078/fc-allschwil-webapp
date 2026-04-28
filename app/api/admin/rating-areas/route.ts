import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

function clean(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : null;
}

function keyFromLabel(value: string) {
  return value.trim().toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").toUpperCase();
}

export async function GET() {
  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const areas = await prisma.playerRatingAreaDefinition.findMany({
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    include: { season: { select: { id: true, key: true, name: true, isActive: true } } },
  });

  return NextResponse.json({ areas });
}

export async function POST(request: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await request.json().catch(() => ({}));
  const label = clean(body.label);
  if (!label) return NextResponse.json({ error: "Bereichsname fehlt." }, { status: 400 });

  const seasonId = clean(body.seasonId);
  const key = clean(body.key) ?? keyFromLabel(label);

  const area = await prisma.playerRatingAreaDefinition.create({
    data: { seasonId, key, label, description: clean(body.description), sortOrder: Number.isInteger(Number(body.sortOrder)) ? Number(body.sortOrder) : 0, isActive: body.isActive === false ? false : true },
    include: { season: { select: { id: true, key: true, name: true, isActive: true } } },
  });

  return NextResponse.json({ area, message: "Bewertungsbereich gespeichert." }, { status: 201 });
}
