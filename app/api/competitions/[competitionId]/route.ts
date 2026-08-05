/**
 * GET    /api/competitions/[competitionId]  — Get a single competition.
 * PATCH  /api/competitions/[competitionId]  — Update locally-managed fields.
 * DELETE /api/competitions/[competitionId]  — Archive (soft-delete).
 *
 * Authorization: COMPETITIONS_VIEW (GET) / COMPETITIONS_MANAGE (PATCH, DELETE).
 * tenantId always from session — never from URL or body.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getCompetitionById } from "@/lib/competitions/queries";
import {
  updateCompetition,
  archiveCompetition,
  CompetitionNotFoundError,
} from "@/lib/competitions/competition-service";
import { CompetitionValidationError } from "@/lib/competitions/validators";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ competitionId: string }> };

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const access = await requireApiAnyPermission([
    PERMISSIONS.COMPETITIONS_VIEW,
    PERMISSIONS.COMPETITIONS_MANAGE,
  ]);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandanten-Kontext." }, { status: 403 });
  }

  const { competitionId } = await params;
  const competition = await getCompetitionById(tenantId, competitionId);

  if (!competition) {
    return NextResponse.json({ error: "Wettkampf nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ competition });
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const access = await requireApiPermission(PERMISSIONS.COMPETITIONS_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandanten-Kontext." }, { status: 403 });
  }

  const { competitionId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  try {
    const competition = await updateCompetition(tenantId, competitionId, body as never);
    return NextResponse.json({ competition });
  } catch (err) {
    if (err instanceof CompetitionValidationError) {
      return NextResponse.json({ error: err.message, field: err.field }, { status: 400 });
    }
    if (err instanceof CompetitionNotFoundError) {
      return NextResponse.json({ error: "Wettkampf nicht gefunden." }, { status: 404 });
    }
    console.error("[competitions] PATCH error:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Interner Serverfehler." }, { status: 500 });
  }
}

// ── DELETE (archive) ──────────────────────────────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const access = await requireApiPermission(PERMISSIONS.COMPETITIONS_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandanten-Kontext." }, { status: 403 });
  }

  const { competitionId } = await params;

  try {
    const competition = await archiveCompetition(tenantId, competitionId);
    return NextResponse.json({ competition });
  } catch (err) {
    if (err instanceof CompetitionNotFoundError) {
      return NextResponse.json({ error: "Wettkampf nicht gefunden." }, { status: 404 });
    }
    console.error("[competitions] DELETE error:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Interner Serverfehler." }, { status: 500 });
  }
}
