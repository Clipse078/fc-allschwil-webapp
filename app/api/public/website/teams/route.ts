/**
 * GET /api/public/website/teams
 *
 * Returns the list of website-visible teams for the public FC Allschwil website.
 * Optionally filtered by ?seasonKey= to show teams from a specific season.
 *
 * Response: { teams: PublicTeam[] }
 *
 * No auth required. CORS enabled for the website origin.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { resolveTenantFromRequest } from "@/lib/tenants/resolve-from-request";
import { addCorsHeaders, handleCorsPreflightPublic } from "@/lib/api/cors";

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflightPublic(request) ?? new NextResponse(null, { status: 204 });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonKey = searchParams.get("seasonKey");

    const tenant = await resolveTenantFromRequest(request);
    if (!tenant) {
      return addCorsHeaders(
        NextResponse.json({ error: "Tenant nicht gefunden." }, { status: 404 }),
        request,
      );
    }

    const seasonWhere = seasonKey
      ? { season: { key: seasonKey } }
      : { season: { isActive: true } };

    const teams = await prisma.team.findMany({
      where: { websiteVisible: true },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        category: true,
        genderGroup: true,
        ageGroup: true,
        teamSeasons: {
          where: seasonWhere,
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            displayName: true,
            shortName: true,
            status: true,
            season: {
              select: { key: true, name: true },
            },
          },
        },
      },
    });

    const result = teams.map((team) => {
      const ts = team.teamSeasons[0] ?? null;
      return {
        id: team.id,
        name: team.name,
        slug: team.slug,
        category: team.category,
        genderGroup: team.genderGroup,
        ageGroup: team.ageGroup,
        seasonName: ts?.season.name ?? null,
        seasonKey: ts?.season.key ?? null,
        displayName: ts?.displayName ?? team.name,
        shortName: ts?.shortName ?? null,
        status: ts?.status ?? null,
      };
    });

    const response = NextResponse.json({ teams: result });
    return addCorsHeaders(response, request);
  } catch (error) {
    console.error("Public website teams failed:", error);
    return addCorsHeaders(
      NextResponse.json(
        { error: "Teams konnten nicht geladen werden." },
        { status: 500 },
      ),
      request,
    );
  }
}
