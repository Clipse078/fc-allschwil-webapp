/**
 * GET  /api/media/folders — list all folders for the session tenant.
 * POST /api/media/folders — create a new folder.
 *
 * Permission: NEWS_MANAGE or WEBSITE_MANAGE
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  listMediaFolders,
  buildFolderTree,
  createMediaFolder,
  validateMediaReferencesForTenant,
} from "@/lib/media/queries";

const MEDIA_PERMISSIONS = [PERMISSIONS.NEWS_MANAGE, PERMISSIONS.WEBSITE_MANAGE];

export async function GET(_request: NextRequest) {
  const access = await requireApiAnyPermission(MEDIA_PERMISSIONS);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const folders = await listMediaFolders(tenantId);
  const tree = buildFolderTree(folders);

  return NextResponse.json({ folders, tree });
}

export async function POST(request: NextRequest) {
  const access = await requireApiAnyPermission(MEDIA_PERMISSIONS);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Name ist erforderlich." }, { status: 400 });
  }

  const parentId =
    typeof body.parentId === "string" ? body.parentId : null;

  if (
    !(await validateMediaReferencesForTenant(tenantId, {
      folderId: parentId,
    }))
  ) {
    return NextResponse.json(
      { error: "Übergeordneter Medienordner nicht gefunden." },
      { status: 404 },
    );
  }

  const folder = await createMediaFolder({ tenantId, name, parentId });

  return NextResponse.json({ folder }, { status: 201 });
}
