/**
 * GET  /api/media  — list media assets for the session tenant.
 * POST /api/media  — upload a new media asset (multipart/form-data, field "file").
 *
 * Permission: NEWS_MANAGE
 * Isolation:  tenantId resolved from session — never from request body.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantFromSession } from "@/lib/tenants/queries";
import { validateMediaUploadFile } from "@/lib/media/types";
import { uploadMediaAsset } from "@/lib/media/upload";
import { listMediaAssets, countMediaAssets, createMediaAsset } from "@/lib/media/queries";

// ── GET /api/media ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.NEWS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawType = searchParams.get("type")?.toUpperCase();
  const type = rawType === "IMAGE" || rawType === "VIDEO" ? rawType : undefined;
  const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 200);
  const offset = Math.max(Number(searchParams.get("offset") ?? "0"), 0);

  const [assets, total] = await Promise.all([
    listMediaAssets({ tenantId, type, limit, offset }),
    countMediaAssets(tenantId, type),
  ]);

  return NextResponse.json({ assets, meta: { total, limit, offset } });
}

// ── POST /api/media ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.NEWS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const sessionTenantId = access.session.user?.tenantId;
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

  const altText = typeof formData.get("altText") === "string"
    ? (formData.get("altText") as string).trim() || null
    : null;
  const caption = typeof formData.get("caption") === "string"
    ? (formData.get("caption") as string).trim() || null
    : null;

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
    createdByUserId: access.session.user?.id ?? null,
  });

  return NextResponse.json({ asset }, { status: 201 });
}
