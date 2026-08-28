/**
 * TEAM-COCKPIT-PREMIUM-01K — Team photo API.
 *
 * POST   /api/teams/[teamId]/photo  — upload / replace team photo
 * DELETE /api/teams/[teamId]/photo  — remove team photo
 *
 * Auth: team-specific manage access (trainer / Club Admin / SCE Superadmin).
 * Tenant isolation: target Team must belong to the caller's active tenant.
 *
 * Storage namespace: team-photos/{tenantKey}/{teamId}.{ext}
 * Does NOT create TeamDocument rows or use private document storage.
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiTeamDocumentAccess } from "@/lib/teams/team-document-auth";
import {
  validateTeamPhotoFile,
  uploadTeamPhoto,
  removeTeamPhoto,
} from "@/lib/teams/team-photo-shared";

type RouteContext = { params: Promise<{ teamId: string }> };

async function resolveAuthorizedTeam(teamId: string, requireManage: boolean) {
  const access = await requireApiTeamDocumentAccess(teamId, { requireManage });
  if (!access.ok) {
    return {
      ok: false as const,
      status: access.status,
      error: access.error,
    };
  }

  const team = await prisma.team.findFirst({
    where: { id: teamId, tenantId: access.access.tenantId },
    select: { id: true, photoUrl: true, tenantId: true },
  });

  if (!team) {
    return {
      ok: false as const,
      status: 404 as const,
      error: "Team nicht gefunden.",
    };
  }

  const actorUserId =
    access.session?.user?.effectiveUserId ?? access.session?.user?.id ?? null;

  return {
    ok: true as const,
    team,
    tenantId: access.access.tenantId,
    tenantKey: access.access.tenantKey,
    actorUserId,
  };
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json(
      {
        error:
          "Teamfoto-Upload ist derzeit nicht verfügbar (Speicher nicht konfiguriert).",
      },
      { status: 503 },
    );
  }

  const { teamId } = await params;
  const resolved = await resolveAuthorizedTeam(teamId, true);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Ungültige Formulardaten." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "Keine Bilddatei übermittelt." }, { status: 400 });
  }

  const filename = file instanceof File ? file.name : undefined;
  const validation = await validateTeamPhotoFile(file, filename);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: validation.status });
  }

  const result = await uploadTeamPhoto({
    teamId: resolved.team.id,
    tenantId: resolved.tenantId,
    tenantKey: resolved.tenantKey,
    currentPhotoUrl: resolved.team.photoUrl,
    buffer: validation.buffer,
    mime: validation.mime,
    ext: validation.ext,
    actorUserId: resolved.actorUserId,
    token,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ photoUrl: result.photoUrl });
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  const { teamId } = await params;
  const resolved = await resolveAuthorizedTeam(teamId, true);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const result = await removeTeamPhoto({
    teamId: resolved.team.id,
    tenantId: resolved.tenantId,
    currentPhotoUrl: resolved.team.photoUrl,
    actorUserId: resolved.actorUserId,
    token,
  });

  if (!result.ok) {
    if (result.status === 404) {
      return NextResponse.json({ message: "Kein Teamfoto vorhanden." });
    }
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ message: result.message });
}
