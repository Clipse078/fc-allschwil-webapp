/**
 * GET  /api/media  — list media assets for the session tenant.
 * POST /api/media  — upload a new media asset (multipart/form-data, field "file").
 *
 * Permission: NEWS_MANAGE or WEBSITE_MANAGE
 * Isolation:  tenantId resolved from session — never from request body.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantFromSession } from "@/lib/tenants/queries";
import { validateMediaUploadFile } from "@/lib/media/types";
import { uploadMediaAsset } from "@/lib/media/upload";
import { listMediaAssets, countMediaAssets, createMediaAsset } from "@/lib/media/queries";

const MEDIA_PERMISSIONS = [PERMISSIONS.NEWS_MANAGE, PERMISSIONS.WEBSITE_MANAGE];

// ── GET /api/media ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const access = await requireApiAnyPermission(MEDIA_PERMISSIONS);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawType = searchParams.get("type")?.toUpperCase();
  const type = rawType === "IMAGE" || rawType === "VIDEO" ? rawType : undefined;
  const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 200);
  const offset = Math.max(Number(searchParams.get("offset") ?? "0"), 0);
  const folderId = searchParams.has("folderId")
    ? (searchParams.get("folderId") ?? undefined)
    : undefined;
  const rawTagIds = searchParams.get("tagIds");
  const tagIds = rawTagIds ? rawTagIds.split(",").filter(Boolean) : undefined;
  const search = searchParams.get("q") ?? undefined;
  const showArchived = searchParams.get("archived") === "1";

  const input = { tenantId, type: type as "IMAGE" | "VIDEO" | undefined, folderId, tagIds, search, showArchived, limit, offset };

  const [assets, total] = await Promise.all([
    listMediaAssets(input),
    countMediaAssets(tenantId, { type, folderId, tagIds, search, showArchived }),
  ]);

  return NextResponse.json({ assets, meta: { total, limit, offset } });
}

// ── POST /api/media ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const access = await requireApiAnyPermission(MEDIA_PERMISSIONS);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const sessionTenantId = access.session.user?.activeTenantId;
  if (!sessionTenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const tenant = await getTenantFromSession(sessionTenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant nicht gefunden." }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Ungültige Anfrage: multipart/form-data erwartet." },
      { status: 400 },
    );
  }

  const fileEntry = formData.get("file");
  if (!(fileEntry instanceof File)) {
    return NextResponse.json(
      { error: "Kein Datei-Feld 'file' gefunden." },
      { status: 400 },
    );
  }

  const validation = validateMediaUploadFile(fileEntry);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const getString = (key: string) => {
    const v = formData.get(key);
    return typeof v === "string" ? v.trim() || null : null;
  };

  const altText     = getString("altText");
  const caption     = getString("caption");
  const description = getString("description");
  const copyright   = getString("copyright");
  const photographer = getString("photographer");
  const folderId    = getString("folderId");

  const assetId = crypto.randomUUID().replace(/-/g, "");
  const arrayBuffer = await fileEntry.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  const uploadResult = await uploadMediaAsset(
    tenant.key,
    assetId,
    buffer,
    validation.mimeType,
  );

  if (!uploadResult.ok) {
    return NextResponse.json({ error: uploadResult.error }, { status: uploadResult.status });
  }

  const storageKey = `media/${tenant.key}/${assetId}.${uploadResult.ext}`;

  const asset = await createMediaAsset({
    id: assetId,
    tenantId: tenant.id,
    type: uploadResult.assetType,
    filename: fileEntry.name,
    mimeType: validation.mimeType,
    sizeBytes: fileEntry.size,
    url: uploadResult.publicUrl,
    altText,
    caption,
    description,
    copyright,
    photographer,
    folderId,
    storageKey,
    createdByUserId: access.session.user?.id ?? null,
  });

  return NextResponse.json({ asset }, { status: 201 });
}
