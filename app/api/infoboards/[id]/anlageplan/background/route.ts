/**
 * app/api/infoboards/[id]/anlageplan/background/route.ts
 *
 * Anlageplan background image upload.
 *
 * POST /api/infoboards/[id]/anlageplan/background
 *   multipart/form-data — field "file"
 *   Uploads a site-plan image, stores in Vercel Blob under
 *   "infoboard-map/{tenantKey}/{boardId}.{ext}", writes the
 *   public CDN URL to Infoboard.anlageplanBackgroundUrl.
 *
 * DELETE /api/infoboards/[id]/anlageplan/background
 *   Removes the background image (deletes Blob object if present,
 *   sets Infoboard.anlageplanBackgroundUrl = null).
 *
 * Permission: INFOBOARD_MANAGE
 * Tenant isolation: activeTenantId from session.
 */

import { NextRequest, NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getInfoboard, updateInfoboard } from "@/lib/infoboard/queries";
import { getActiveTenant } from "@/lib/tenants/active-tenant";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

function isAllowedImageType(mime: string): boolean {
  return (ALLOWED_TYPES as readonly string[]).includes(mime);
}

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

  // Resolve tenant key for the blob path
  const tenantCtx = await getActiveTenant();
  if (!tenantCtx) {
    return NextResponse.json({ error: "Mandant nicht gefunden." }, { status: 401 });
  }

  const board = await getInfoboard(id, tenantId);
  if (!board) {
    return NextResponse.json({ error: "Infoboard nicht gefunden." }, { status: 404 });
  }

  // Check BLOB_READ_WRITE_TOKEN
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Blob-Speicher nicht konfiguriert." },
      { status: 503 },
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Ungültige Formulardaten." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Feld 'file' fehlt oder ist kein Datei-Upload." }, { status: 422 });
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: `Datei ist zu groß (max. ${MAX_SIZE_BYTES / 1024 / 1024} MB).` },
      { status: 422 },
    );
  }

  const mime = file.type;
  if (!isAllowedImageType(mime)) {
    return NextResponse.json(
      { error: "Nur JPEG, PNG und WebP sind erlaubt." },
      { status: 422 },
    );
  }

  const ext = mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";
  const blobKey = `infoboard-map/${tenantCtx.key}/${id}.${ext}`;

  let publicUrl: string;
  try {
    const result = await put(blobKey, file, {
      access: "public",
      contentType: mime,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    publicUrl = result.url;
  } catch (err) {
    console.error("[anlageplan/background] Blob upload error:", err);
    return NextResponse.json({ error: "Upload fehlgeschlagen." }, { status: 502 });
  }

  // Persist URL on the board
  const updated = await updateInfoboard(id, tenantId, {
    anlageplanBackgroundUrl: publicUrl,
  });

  return NextResponse.json({ board: updated, backgroundUrl: publicUrl }, { status: 200 });
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

  // Delete from Blob if URL is set
  if (board.anlageplanBackgroundUrl && process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      await del(board.anlageplanBackgroundUrl, {
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
    } catch (err) {
      // Non-fatal: just log and continue — still clear the DB URL
      console.warn("[anlageplan/background] Blob delete warning:", err);
    }
  }

  const updated = await updateInfoboard(id, tenantId, {
    anlageplanBackgroundUrl: null,
  });

  return NextResponse.json({ board: updated });
}
