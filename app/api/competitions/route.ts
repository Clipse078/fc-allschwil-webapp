/**
 * GET  /api/competitions  — List competitions for the authenticated tenant.
 * POST /api/competitions  — Create a competition manually.
 *
 * Authorization:
 *   GET  — requires COMPETITIONS_VIEW or COMPETITIONS_MANAGE.
 *   POST — requires COMPETITIONS_MANAGE.
 *
 * Query parameters (GET):
 *   search          — free-text filter over name fields
 *   provider        — filter by provider (e.g. "SFV")
 *   externalSeasonId — filter by provider season (integer)
 *   includeArchived — "true" to include archived (default: false)
 *   competitionType — filter by type (LEAGUE, CUP, TOURNAMENT_SERIES, OTHER)
 *   gender          — filter by gender (MALE, FEMALE, MIXED)
 *
 * Tenant-safe contract:
 *   - tenantId is resolved exclusively from the authenticated session.
 *   - No cross-tenant data is returned.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { listCompetitions } from "@/lib/competitions/queries";
import { createCompetition, CompetitionConflictError } from "@/lib/competitions/competition-service";
import { CompetitionValidationError } from "@/lib/competitions/validators";
import type { CompetitionFilterParams } from "@/lib/competitions/dto";

export const dynamic = "force-dynamic";

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const access = await requireApiAnyPermission([
    PERMISSIONS.COMPETITIONS_VIEW,
    PERMISSIONS.COMPETITIONS_MANAGE,
  ]);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandanten-Kontext." }, { status: 403 });
  }

  const sp = request.nextUrl.searchParams;

  const filters: CompetitionFilterParams = {
    search: sp.get("search") ?? undefined,
    provider: sp.get("provider") ?? undefined,
    externalSeasonId: sp.has("externalSeasonId")
      ? parseInt(sp.get("externalSeasonId")!, 10)
      : undefined,
    includeArchived: sp.get("includeArchived") === "true",
    competitionType: (sp.get("competitionType") as CompetitionFilterParams["competitionType"]) ?? undefined,
    gender: (sp.get("gender") as CompetitionFilterParams["gender"]) ?? undefined,
  };

  const competitions = await listCompetitions(tenantId, filters);
  return NextResponse.json({ competitions });
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const access = await requireApiPermission(PERMISSIONS.COMPETITIONS_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandanten-Kontext." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  try {
    const competition = await createCompetition(tenantId, body as never);
    return NextResponse.json({ competition }, { status: 201 });
  } catch (err) {
    if (err instanceof CompetitionValidationError) {
      return NextResponse.json(
        { error: err.message, field: err.field },
        { status: 400 },
      );
    }

    if (err instanceof CompetitionConflictError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }

    console.error("[competitions] POST error:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Interner Serverfehler." }, { status: 500 });
  }
}
