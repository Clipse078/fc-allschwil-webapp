/**
 * GET /api/club-directory/teams
 *
 * Flat, tenant-scoped ExternalTeam search across ALL Club-Directory clubs
 * (unlike GET /api/club-directory/clubs/[clubId]/teams, which is scoped to
 * a single club). Added for TOURNAMENTCENTER-01B's "Team hinzufügen"
 * participant picker, which needs to search guest-club teams by name
 * without the admin first selecting a club — but this is a generic,
 * reusable lookup, not Tournament-specific.
 *
 * Query params:
 *   q      optional case-insensitive substring match against
 *          name / shortName / alternativeName
 *   limit  optional, default 50, max 200
 *
 * Archived teams are always excluded — a tournament participant must
 * reference a currently-active canonical ExternalTeam.
 *
 * Permission: EVENTS_VIEW / EVENTS_MANAGE (TournamentCenter) or
 * ORG_VIEW / ORG_MANAGE (Club Directory) — any of these may read the
 * directory for participant/opponent selection.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/db/prisma";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function GET(request: NextRequest) {
  const access = await requireApiAnyPermission([
    PERMISSIONS.EVENTS_VIEW,
    PERMISSIONS.EVENTS_MANAGE,
    PERMISSIONS.ORG_VIEW,
    PERMISSIONS.ORG_MANAGE,
  ]);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context is required." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("q")?.trim() || null;
  const rawLimit = searchParams.get("limit");
  const limit = rawLimit !== null ? Number.parseInt(rawLimit, 10) : DEFAULT_LIMIT;

  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return NextResponse.json(
      { error: `limit must be between 1 and ${MAX_LIMIT}.` },
      { status: 400 },
    );
  }

  const teams = await prisma.externalTeam.findMany({
    where: {
      tenantId,
      archivedAt: null,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { shortName: { contains: search, mode: "insensitive" } },
              { alternativeName: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: limit,
    select: {
      id: true,
      name: true,
      shortName: true,
      categoryLabel: true,
      externalClub: { select: { id: true, name: true, shortName: true } },
    },
  });

  return NextResponse.json({ teams });
}
