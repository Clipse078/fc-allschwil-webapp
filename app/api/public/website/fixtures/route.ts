/**
 * GET /api/public/website/fixtures
 *
 * Returns upcoming and recent fixtures (MATCH events) for the public FC Allschwil website.
 * Filters to website-visible MATCH events.
 *
 * Query params:
 *   seasonKey  — filter by season key
 *   teamSlug   — filter by team slug
 *   dateFrom   — ISO date string (default: today or -60 days when past=1)
 *   dateTo     — ISO date string (default: +60 days)
 *   limit      — max results (default 20, max 100)
 *   past       — "1" to include past fixtures (default: future only)
 *
 * Response: { count, filters, fixtures: PublicFixture[] }
 *
 * No auth required. CORS enabled for the website origin.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { resolveTenantFromRequest } from "@/lib/tenants/resolve-from-request";
import { addCorsHeaders, handleCorsPreflightPublic } from "@/lib/api/cors";
import { parseIntParam } from "@/lib/api/params";

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflightPublic(request) ?? new NextResponse(null, { status: 204 });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonKey = searchParams.get("seasonKey");
    const teamSlug = searchParams.get("teamSlug");
    const limit = parseIntParam(searchParams.get("limit"), 20, 100);
    const past = searchParams.get("past") === "1";

    const now = new Date();
    const dateFromParam = searchParams.get("dateFrom");
    const dateToParam = searchParams.get("dateTo");

    const dateFrom = dateFromParam
      ? new Date(dateFromParam)
      : past
        ? new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
        : now;

    const dateTo = dateToParam
      ? new Date(dateToParam)
      : new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

    const tenant = await resolveTenantFromRequest(request);
    if (!tenant) {
      return addCorsHeaders(
        NextResponse.json({ error: "Tenant nicht gefunden." }, { status: 404 }),
        request,
      );
    }

    const fixtures = await prisma.event.findMany({
      where: {
        tenantId: tenant.id,
        type: "MATCH",
        websiteVisible: true,
        startAt: { gte: dateFrom, lte: dateTo },
        ...(seasonKey ? { season: { key: seasonKey } } : {}),
        ...(teamSlug ? { team: { slug: teamSlug } } : {}),
      },
      orderBy: { startAt: past ? "desc" : "asc" },
      take: limit,
      select: {
        id: true,
        title: true,
        status: true,
        homeAway: true,
        startAt: true,
        endAt: true,
        location: true,
        opponentName: true,
        competitionLabel: true,
        resultLabel: true,
        season: {
          select: { key: true, name: true },
        },
        team: {
          select: { name: true, slug: true, category: true },
        },
      },
    });

    const result = fixtures.map((ev) => ({
      id: ev.id,
      title: ev.title,
      status: ev.status,
      homeAway: ev.homeAway,
      startAt: ev.startAt,
      endAt: ev.endAt,
      location: ev.location,
      opponentName: ev.opponentName,
      competitionLabel: ev.competitionLabel,
      resultLabel: ev.resultLabel,
      teamName: ev.team?.name ?? null,
      teamSlug: ev.team?.slug ?? null,
      teamCategory: ev.team?.category ?? null,
      seasonKey: ev.season?.key ?? null,
      seasonName: ev.season?.name ?? null,
    }));

    const response = NextResponse.json({
      count: result.length,
      filters: {
        seasonKey,
        teamSlug,
        dateFrom: dateFrom.toISOString().slice(0, 10),
        dateTo: dateTo.toISOString().slice(0, 10),
        limit,
        past,
      },
      fixtures: result,
    });

    return addCorsHeaders(response, request);
  } catch (error) {
    console.error("Public website fixtures failed:", error);
    return addCorsHeaders(
      NextResponse.json(
        { error: "Fixtures konnten nicht geladen werden." },
        { status: 500 },
      ),
      request,
    );
  }
}
