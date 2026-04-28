import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

type Context = { params: Promise<{ permissionId: string }> };

function clean(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : null;
}

export async function PATCH(request: NextRequest, context: Context) {
  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { permissionId } = await context.params;
  const body = await request.json().catch(() => ({}));

  const permission = await prisma.playerRatingPermission.update({
    where: { id: permissionId },
    data: { label: clean(body.label), isActive: body.isActive === false ? false : true },
    include: {
      teamSeason: { select: { id: true, displayName: true, shortName: true, season: { select: { id: true, key: true, name: true, isActive: true } }, team: { select: { id: true, name: true, slug: true } } } },
      season: { select: { id: true, key: true, name: true, isActive: true } },
      role: { select: { id: true, key: true, name: true } },
    },
  });

  return NextResponse.json({ permission, message: "Bewertungsrecht aktualisiert." });
}

export async function DELETE(_: NextRequest, context: Context) {
  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { permissionId } = await context.params;
  await prisma.playerRatingPermission.delete({ where: { id: permissionId } });

  return NextResponse.json({ message: "Bewertungsrecht gelöscht." });
}
