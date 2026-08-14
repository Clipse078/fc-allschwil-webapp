/**
 * app/api/infoboards/[id]/anlageplan/background/route.ts
 *
 * Anlageplan background image upload.
 *
 * POST /api/infoboards/[id]/anlageplan/background
 *   multipart/form-data — field "file"
 *   Uploads a site-plan image, stores in Vercel Blob under
 *   "infoboards/{tenantKey}/{boardId}/anlageplan/{boardId}.{ext}",
 *   writes the public CDN URL to Infoboard.anlageplanBackgroundUrl.
 *
 * DELETE /api/infoboards/[id]/anlageplan/background
 *   Removes the background image (deletes Blob object if present,
 *   sets Infoboard.anlageplanBackgroundUrl = null).
 *
 * Blob storage: sportclubevo-assets (public) via BLOB_READ_WRITE_TOKEN.
 * Shared helper: lib/assets/storage.ts — same convention as media/logo uploads.
 *
 * Permission: INFOBOARD_MANAGE
 * Tenant isolation: activeTenantId from session.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  uploadAnlageplanBackground,
  deleteAnlageplanBackground,
} from "@/lib/assets/storage";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getInfoboard, updateInfoboard } from "@/lib/infoboard/queries";
import { getActiveTenant } from "@/lib/tenants/active-tenant";

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const access = await requireApiAnyPermission([PERMISSIONS.INFOBOARD_MANAGE]);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const tenantCtx = await getActiveTenant();
  if (!tenantCtx) {
    return NextResponse.json({ error: "Mandant nicht gefunden." }, { status: 401 });
  }

  const board = await getInfoboard(id, tenantId);
  if (!board) {
    return NextResponse.json({ error: "Infoboard nicht gefunden." }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Ungültige Formulardaten." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Feld 'file' fehlt oder ist kein Datei-Upload." },
      { status: 422 },
    );
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: `Datei ist zu groß (max. ${MAX_SIZE_BYTES / 1024 / 1024} MB).` },
      { status: 422 },
    );
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const result = await uploadAnlageplanBackground(tenantCtx.key, id, buffer, file.type);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  // Best-effort cleanup of previous blob when the extension changed
  // (same key → same URL → allowOverwrite handles it; different ext → orphan).
  if (board.anlageplanBackgroundUrl && board.anlageplanBackgroundUrl !== result.publicUrl) {
    await deleteAnlageplanBackground(board.anlageplanBackgroundUrl);
  }

  const updated = await updateInfoboard(id, tenantId, {
    anlageplanBackgroundUrl: result.publicUrl,
  });

  return NextResponse.json({ board: updated, backgroundUrl: result.publicUrl }, { status: 200 });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const access = await requireApiAnyPermission([PERMISSIONS.INFOBOARD_MANAGE]);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const board = await getInfoboard(id, tenantId);
  if (!board) {
    return NextResponse.json({ error: "Infoboard nicht gefunden." }, { status: 404 });
  }

  await deleteAnlageplanBackground(board.anlageplanBackgroundUrl);

  const updated = await updateInfoboard(id, tenantId, {
    anlageplanBackgroundUrl: null,
  });

  return NextResponse.json({ board: updated });
}
