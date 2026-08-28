/**
 * TEAM-COCKPIT-PREMIUM-01J-C — PATCH/DELETE /api/teams/[teamId]/documents/[documentId]
 *
 * PATCH  — Rename a TeamDocument title.
 *           Requires: team-specific document manage access.
 *
 * DELETE — Delete document record + blob from private storage.
 *           Requires: team-specific document manage access.
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireApiTeamDocumentAccess } from "@/lib/teams/team-document-auth";
import {
  deleteTeamDocument,
  getTeamDocument,
  renameTeamDocument,
  TeamDocumentServiceError,
} from "@/lib/teams/team-document-service";

type RouteContext = { params: Promise<{ teamId: string; documentId: string }> };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { teamId, documentId } = await params;
  const access = await requireApiTeamDocumentAccess(teamId, { requireManage: true });
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof body.title !== "string") {
    return NextResponse.json({ error: "Titel ist erforderlich." }, { status: 400 });
  }

  try {
    const updated = await renameTeamDocument({
      tenantId: access.access.tenantId,
      teamId,
      documentId,
      actorUserId: access.session.user.id,
      title: body.title,
    });

    const { _storageKey: _sk, ...clientDoc } = updated;
    return NextResponse.json({ document: clientDoc });
  } catch (err) {
    if (err instanceof TeamDocumentServiceError) {
      const status =
        err.code === "DOCUMENT_NOT_FOUND" || err.code === "TEAM_NOT_FOUND"
          ? 404
          : err.code === "INVALID_INPUT"
            ? 400
            : 500;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    throw err;
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { teamId, documentId } = await params;
  const access = await requireApiTeamDocumentAccess(teamId, { requireManage: true });
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    await deleteTeamDocument({
      tenantId: access.access.tenantId,
      teamId,
      documentId,
      actorUserId: access.session.user.id,
    });
    return NextResponse.json({ message: "Dokument gelöscht." });
  } catch (err) {
    if (err instanceof TeamDocumentServiceError) {
      const status =
        err.code === "DOCUMENT_NOT_FOUND" || err.code === "TEAM_NOT_FOUND"
          ? 404
          : 500;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    throw err;
  }
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { teamId, documentId } = await params;
  const access = await requireApiTeamDocumentAccess(teamId);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const doc = await getTeamDocument(access.access.tenantId, teamId, documentId);
    if (!doc) {
      return NextResponse.json({ error: "Dokument nicht gefunden." }, { status: 404 });
    }

    const { _storageKey: _sk, ...clientDoc } = doc;
    return NextResponse.json({ document: clientDoc });
  } catch (err) {
    if (err instanceof TeamDocumentServiceError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    throw err;
  }
}
