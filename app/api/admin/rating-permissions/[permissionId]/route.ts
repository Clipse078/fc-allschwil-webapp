import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

type Context = { params: Promise<{ permissionId: string }> };

function clean(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : null;
}

const permissionInclude = {
  teamSeason: {
    select: {
      id: true,
      displayName: true,
      shortName: true,
      season: { select: { id: true, key: true, name: true, isActive: true } },
      team: { select: { id: true, name: true, slug: true } },
    },
  },
  season: { select: { id: true, key: true, name: true, isActive: true } },
  role: { select: { id: true, key: true, name: true } },
};

export async function PATCH(request: NextRequest, context: Context) {
  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { permissionId } = await context.params;
  const body = await request.json().catch(() => ({}));

  const existing = await prisma.playerRatingPermission.findUnique({
    where: { id: permissionId },
    select: { id: true, teamSeasonId: true },
  });

  if (!existing) return NextResponse.json({ error: "Bewertungsrecht nicht gefunden." }, { status: 404 });

  const teamSeasonId = clean(body.teamSeasonId) ?? existing.teamSeasonId;
  const roleId = Object.prototype.hasOwnProperty.call(body, "roleId") ? clean(body.roleId) : undefined;
  const includeTeamTrainers = Object.prototype.hasOwnProperty.call(body, "includeTeamTrainers") ? body.includeTeamTrainers === true : undefined;

  const teamSeason = await prisma.teamSeason.findUnique({ where: { id: teamSeasonId }, select: { id: true, seasonId: true } });
  if (!teamSeason) return NextResponse.json({ error: "Team-Saison nicht gefunden." }, { status: 404 });

  if (roleId) {
    const role = await prisma.role.findUnique({ where: { id: roleId }, select: { id: true } });
    if (!role) return NextResponse.json({ error: "Rolle nicht gefunden." }, { status: 404 });
  }

  const permission = await prisma.playerRatingPermission.update({
    where: { id: permissionId },
    data: {
      teamSeasonId,
      seasonId: teamSeason.seasonId,
      label: Object.prototype.hasOwnProperty.call(body, "label") ? clean(body.label) : undefined,
      isActive: Object.prototype.hasOwnProperty.call(body, "isActive") ? body.isActive === false ? false : true : undefined,
      roleId,
      includeTeamTrainers,
      personId: null,
    },
    include: permissionInclude,
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
