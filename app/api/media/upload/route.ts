/**
 * POST /api/media/upload
 *
 * Tenant-scoped media upload endpoint.
 * Stores assets in Vercel Blob under `media/{tenantKey}/…`.
 * Creates a MediaAsset record for the library.
 *
 * Permission: news.manage (extended to all modules that need media)
 * Body: multipart/form-data with field "file"
 * Returns: { asset: { id, url, mimeType, fileName } }
 *
 * Architecture: reusable for future modules (events, pages, galleries).
 * Module-specific routing (e.g. attaching to a news article) is the
 * caller's responsibility after getting back the public URL.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantFromSession } from "@/lib/tenants/queries";
import { uploadMediaAsset } from "@/lib/media/upload";
import { isAllowedMediaMimeType, MAX_MEDIA_FILE_SIZE_BYTES } from "@/lib/media/validation";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.NEWS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const tenant = await getTenantFromSession(tenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant nicht gefunden." }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Ungültige Multipart-Anfrage." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Feld 'file' fehlt oder ist kein File." }, { status: 400 });
  }

  if (!isAllowedMediaMimeType(file.type)) {
    return NextResponse.json(
      { error: `Nicht erlaubter Dateityp: ${file.type || "(unbekannt)"}. Erlaubt: JPEG, PNG, WebP, GIF.` },
      { status: 400 },
    );
  }

  if (file.size > MAX_MEDIA_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: `Datei zu gross (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum: 8 MB.` },
      { status: 400 },
    );
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const result = await uploadMediaAsset(tenant.key, buffer, file.type, file.name);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const asset = await prisma.mediaAsset.create({
    data: {
      tenantId: tenant.id,
      type: "IMAGE",
      url: result.publicUrl,
      storageKey: result.storageKey,
      mimeType: file.type,
      fileName: file.name,
      size: file.size,
    },
    select: { id: true, url: true, mimeType: true, fileName: true, altText: true },
  });

  return NextResponse.json({ asset }, { status: 201 });
}
