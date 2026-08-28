/**
 * TEAM-COCKPIT-PREMIUM-01J-C — GET/POST /api/teams/[teamId]/documents
 *
 * GET  — List TeamDocuments (metadata only; no storage URLs returned).
 *         Requires: team-specific document view access.
 *
 * POST — Upload a new TeamDocument (multipart/form-data).
 *         Requires: team-specific document manage access.
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireApiTeamDocumentAccess } from "@/lib/teams/team-document-auth";
import { getTenantFromSession } from "@/lib/tenants/queries";
import {
  createTeamDocument,
  listTeamDocuments,
  TeamDocumentServiceError,
} from "@/lib/teams/team-document-service";
import { validateTeamDocumentUpload } from "@/lib/teams/team-document-validation";

type RouteContext = { params: Promise<{ teamId: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { teamId } = await params;
  const access = await requireApiTeamDocumentAccess(teamId);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const docs = await listTeamDocuments(access.access.tenantId, teamId);
    const clientDocs = docs.map(({ _storageKey: _sk, ...rest }) => rest);
    return NextResponse.json({ documents: clientDocs });
  } catch (err) {
    if (err instanceof TeamDocumentServiceError) {
      const status = err.code === "TEAM_NOT_FOUND" ? 404 : 500;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    throw err;
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { teamId } = await params;
  const access = await requireApiTeamDocumentAccess(teamId, { requireManage: true });
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenant = await getTenantFromSession(access.access.tenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant nicht gefunden." }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Datei ist erforderlich." }, { status: 400 });
  }

  const titleRaw = formData.get("title");
  const title =
    typeof titleRaw === "string" && titleRaw.trim()
      ? titleRaw.trim()
      : file.name;

  const fileBuffer = new Uint8Array(await file.arrayBuffer());

  try {
    await validateTeamDocumentUpload({
      filename: file.name,
      declaredContentType: file.type,
      buffer: fileBuffer,
    });
  } catch (err) {
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  try {
    const doc = await createTeamDocument({
      tenantId: access.access.tenantId,
      teamId,
      actorUserId: access.session.user.id,
      tenantKey: tenant.key,
      title,
      fileBuffer,
      filename: file.name,
      mimeType: file.type,
    });

    const { _storageKey: _sk, ...clientDoc } = doc;
    return NextResponse.json({ document: clientDoc }, { status: 201 });
  } catch (err) {
    if (err instanceof TeamDocumentServiceError) {
      const status =
        err.code === "TEAM_NOT_FOUND"
          ? 404
          : err.code === "INVALID_INPUT"
            ? 400
            : err.code === "STORAGE_NOT_CONFIGURED"
              ? 503
              : 500;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    throw err;
  }
}
