import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

function clean(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : null;
}

export async function GET() {
  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const permissions = await prisma.playerRatingPermission.findMany({
    orderBy: [{ teamSeason: { season: { startDate: "desc" } } }, { teamSeason: { team: { sortOrder: "asc" } } }],
    include: {
      teamSeason: { select: { id: true, displayName: true, shortName: true, season: { select: { id: true, key: true, name: true, isActive: true } }, team: { select: { id: true, name: true, slug: true } } } },
      season: { select: { id: true, key: true, name: true, isActive: true } },
      role: { select: { id: true, key: true, name: true } },
    },
  });

  return NextResponse.json({ permissions });
}

export async function POST(request: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await request.json().catch(() => ({}));
  const teamSeasonId = clean(body.teamSeasonId);
  const roleId = clean(body.roleId);
  const label = clean(body.label);
  const includeTeamTrainers = body.includeTeamTrainers === true;

  if (!teamSeasonId) return NextResponse.json({ error: "Team-Saison fehlt." }, { status: 400 });
  if (!includeTeamTrainers && !roleId) return NextResponse.json({ error: "Bitte Team-Trainer oder Rolle auswählen." }, { status: 400 });

  const teamSeason = await prisma.teamSeason.findUnique({ where: { id: teamSeasonId }, select: { id: true, seasonId: true } });
  if (!teamSeason) return NextResponse.json({ error: "Team-Saison nicht gefunden." }, { status: 404 });

  const permission = await prisma.playerRatingPermission.create({
    data: { teamSeasonId, seasonId: teamSeason.seasonId, roleId, personId: null, includeTeamTrainers, label, isActive: body.isActive === false ? false : true },
    include: {
      teamSeason: { select: { id: true, displayName: true, shortName: true, season: { select: { id: true, key: true, name: true, isActive: true } }, team: { select: { id: true, name: true, slug: true } } } },
      season: { select: { id: true, key: true, name: true, isActive: true } },
      role: { select: { id: true, key: true, name: true } },
    },
  });

  return NextResponse.json({ permission, message: "Bewertungsrecht gespeichert." }, { status: 201 });
}
