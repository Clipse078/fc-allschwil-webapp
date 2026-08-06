/**
 * GET    /api/provider-mapping/[mappingId]  — Get mapping detail.
 * PUT    /api/provider-mapping/[mappingId]  — Replace mapping with new provider team.
 * DELETE /api/provider-mapping/[mappingId]  — Remove mapping (unlinks TeamSeason, preserves row).
 *
 * Authorization: TEAMS_MANAGE.
 *
 * PUT body (CreateProviderMappingInput fields):
 *   teamSeasonId      string  — must match existing mapping's teamSeasonId
 *   provider          string
 *   externalTeamId    number  — new provider team to map to
 *   externalSeasonId  number
 *   competitionId?    string
 *   confidenceLevel?  string
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getProviderMappingById } from "@/lib/provider-mapping/provider-mapping-queries";
import {
  replaceProviderMapping,
  removeProviderMapping,
} from "@/lib/provider-mapping/provider-mapping-service";
import { ensureSfvAdapterRegistered } from "@/lib/integrations/sfv/register-adapter";
import { parseConfidenceLevel } from "@/lib/provider-mapping/validators";
import type { CreateProviderMappingInput } from "@/lib/provider-mapping/types";

export const dynamic = "force-dynamic";

ensureSfvAdapterRegistered();

type Params = { params: Promise<{ mappingId: string }> };

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(_request: NextRequest, { params }: Params): Promise<NextResponse> {
  const access = await requireApiPermission(PERMISSIONS.TEAMS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandanten-Kontext." }, { status: 403 });
  }

  const { mappingId } = await params;
  const mapping = await getProviderMappingById(tenantId, mappingId);

  if (!mapping) {
    return NextResponse.json({ error: "Zuordnung nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ mapping });
}

// ── PUT ───────────────────────────────────────────────────────────────────────

export async function PUT(request: NextRequest, { params }: Params): Promise<NextResponse> {
  const access = await requireApiPermission(PERMISSIONS.TEAMS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandanten-Kontext." }, { status: 403 });
  }

  const { mappingId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  if (!body.teamSeasonId || typeof body.teamSeasonId !== "string") {
    return NextResponse.json({ error: "teamSeasonId ist erforderlich." }, { status: 400 });
  }
  if (!body.provider || typeof body.provider !== "string") {
    return NextResponse.json({ error: "provider ist erforderlich." }, { status: 400 });
  }
  if (typeof body.externalTeamId !== "number") {
    return NextResponse.json({ error: "externalTeamId (Zahl) ist erforderlich." }, { status: 400 });
  }
  if (typeof body.externalSeasonId !== "number") {
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

  const result = await replaceProviderMapping(tenantId, mappingId, input);

  if (!result.ok) {
    const status =
      result.code === "ALREADY_MAPPED" || result.code === "EXTERNAL_TEAM_ALREADY_MAPPED"
        ? 409
        : 400;
    return NextResponse.json({ error: result.message }, { status });
  }

  return NextResponse.json({ mapping: result.mapping });
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(_request: NextRequest, { params }: Params): Promise<NextResponse> {
  const access = await requireApiPermission(PERMISSIONS.TEAMS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandanten-Kontext." }, { status: 403 });
  }

  const { mappingId } = await params;
  const result = await removeProviderMapping(tenantId, mappingId);

  if (!result.ok) {
    const status = result.code === "MAPPING_NOT_FOUND" ? 404 : 500;
    return NextResponse.json({ error: result.message }, { status });
  }

  return NextResponse.json({ ok: true });
}
