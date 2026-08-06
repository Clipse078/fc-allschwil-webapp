/**
 * GET  /api/provider-mapping   — List provider mappings for the authenticated tenant.
 * POST /api/provider-mapping   — Create a manual provider mapping.
 *
 * Authorization: TEAMS_MANAGE (both verbs).
 *
 * GET query parameters:
 *   provider        — filter by provider (e.g. "SFV")
 *   teamSeasonId    — filter by TeamSeason ID
 *   competitionId   — filter by competition used as mapping context
 *   seasonId        — filter by canonical season ID (via teamSeason)
 *   mappingSource   — "SYNC" | "MANUAL"
 *   search          — free-text filter over team name and provider team name
 *
 * POST body (CreateProviderMappingInput):
 *   teamSeasonId      string  — canonical TeamSeason to map
 *   provider          string  — e.g. "SFV"
 *   externalTeamId    number  — provider's team identifier
 *   externalSeasonId  number  — provider's season identifier
 *   competitionId?    string  — optional competition context
 *   confidenceLevel?  string  — "HIGH" | "MEDIUM" | "LOW"
 *
 * Tenant-safe contract:
 *   - tenantId is resolved exclusively from the authenticated session.
 *   - No cross-tenant data is returned or modified.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { listProviderMappings } from "@/lib/provider-mapping/provider-mapping-queries";
import { createProviderMapping } from "@/lib/provider-mapping/provider-mapping-service";
import { ensureSfvAdapterRegistered } from "@/lib/integrations/sfv/register-adapter";
import { parseConfidenceLevel } from "@/lib/provider-mapping/validators";
import type { MappingFilterParams } from "@/lib/provider-mapping/provider-mapping-queries";
import type { CreateProviderMappingInput } from "@/lib/provider-mapping/types";

export const dynamic = "force-dynamic";

// ── Ensure SFV adapter is registered ──────────────────────────────────────────
ensureSfvAdapterRegistered();

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const access = await requireApiPermission(PERMISSIONS.TEAMS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandanten-Kontext." }, { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const filters: MappingFilterParams = {
    provider: sp.get("provider") ?? undefined,
    teamSeasonId: sp.get("teamSeasonId") ?? undefined,
    competitionId: sp.get("competitionId") ?? undefined,
    seasonId: sp.get("seasonId") ?? undefined,
    mappingSource: (sp.get("mappingSource") as MappingFilterParams["mappingSource"]) ?? undefined,
    search: sp.get("search") ?? undefined,
  };

  const mappings = await listProviderMappings(tenantId, filters);
  return NextResponse.json({ mappings });
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const access = await requireApiPermission(PERMISSIONS.TEAMS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandanten-Kontext." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  // Basic shape validation
  if (!body.teamSeasonId || typeof body.teamSeasonId !== "string") {
    return NextResponse.json({ error: "teamSeasonId ist erforderlich." }, { status: 400 });
  }
  if (!body.provider || typeof body.provider !== "string") {
    return NextResponse.json({ error: "provider ist erforderlich." }, { status: 400 });
  }
  if (!body.externalTeamId || typeof body.externalTeamId !== "number") {
    return NextResponse.json({ error: "externalTeamId (Zahl) ist erforderlich." }, { status: 400 });
  }
  if (!body.externalSeasonId || typeof body.externalSeasonId !== "number") {
    return NextResponse.json({ error: "externalSeasonId (Zahl) ist erforderlich." }, { status: 400 });
  }

  const input: CreateProviderMappingInput = {
    tenantId,
    teamSeasonId: body.teamSeasonId as string,
    provider: body.provider as string,
    externalTeamId: body.externalTeamId as number,
    externalSeasonId: body.externalSeasonId as number,
    competitionId: typeof body.competitionId === "string" ? body.competitionId : undefined,
    confidenceLevel: parseConfidenceLevel(body.confidenceLevel),
  };

  const result = await createProviderMapping(input);

  if (!result.ok) {
    const status =
      result.code === "ALREADY_MAPPED" || result.code === "EXTERNAL_TEAM_ALREADY_MAPPED"
        ? 409
        : result.code === "TEAM_SEASON_NOT_FOUND" ||
          result.code === "COMPETITION_NOT_FOUND" ||
          result.code === "PROVIDER_NOT_FOUND"
        ? 404
        : result.code === "TEAM_SEASON_TENANT_MISMATCH" ||
          result.code === "COMPETITION_TENANT_MISMATCH"
        ? 403
        : 400;

    return NextResponse.json({ error: result.message }, { status });
  }

  return NextResponse.json({ mapping: result.mapping }, { status: 201 });
}
