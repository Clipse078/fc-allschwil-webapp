import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

type Context = { params: Promise<{ areaId: string }> };

function clean(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : null;
}

export async function PATCH(request: NextRequest, context: Context) {
  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { areaId } = await context.params;
  const body = await request.json().catch(() => ({}));

  const area = await prisma.playerRatingAreaDefinition.update({
    where: { id: areaId },
    data: { label: clean(body.label) ?? undefined, description: clean(body.description), sortOrder: Number.isInteger(Number(body.sortOrder)) ? Number(body.sortOrder) : undefined, isActive: body.isActive === false ? false : true },
    include: { season: { select: { id: true, key: true, name: true, isActive: true } } },
  });

  return NextResponse.json({ area, message: "Bewertungsbereich aktualisiert." });
}

export async function DELETE(_: NextRequest, context: Context) {
  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { areaId } = await context.params;
  await prisma.playerRatingAreaDefinition.delete({ where: { id: areaId } });

  return NextResponse.json({ message: "Bewertungsbereich gelöscht." });
}
