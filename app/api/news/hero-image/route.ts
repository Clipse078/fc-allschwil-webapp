/**
 * POST /api/news/hero-image
 *
 * Uploads a hero image for a news article to Vercel Blob.
 * Returns the public CDN URL to be stored as NewsArticle.imageUrl.
 *
 * Body: multipart/form-data with a "file" field (PNG, JPEG, WebP ≤ 2 MB)
 *       and an optional "articleId" field.
 *
 * Permission: NEWS_MANAGE
 * Tenant isolation: strict (session.user.tenantId required)
 *
 * Storage key: news/{tenantKey}/{articleId|timestamp}.{ext}
 *
 * Note: If BLOB_READ_WRITE_TOKEN is not configured, returns 503 with a
 * descriptive message. The CMS form falls back to a manual URL input.
 */

import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantFromSession } from "@/lib/tenants/queries";
import {
  validateLogoUploadFile,
  isAllowedLogoUploadMimeType,
  mimeToLogoExtension,
} from "@/lib/assets/validation";
import { fileTypeFromBuffer } from "file-type";

export async function POST(req: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.NEWS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json(
      { error: "Kein Mandant in der Sitzung." },
      { status: 401 },
    );
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json(
      {
        error:
          "Bild-Upload ist derzeit nicht verfügbar (Speicher nicht konfiguriert). " +
          "Bitte BLOB_READ_WRITE_TOKEN konfigurieren oder imageUrl manuell eingeben.",
      },
      { status: 503 },
    );
  }

  const tenant = await getTenantFromSession(tenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant nicht gefunden." }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Ungültige Anfrage: multipart/form-data erwartet." },
      { status: 400 },
    );
  }

  const fileEntry = formData.get("file");
  if (!(fileEntry instanceof File)) {
    return NextResponse.json(
      { error: "Kein Datei-Feld 'file' im Formular gefunden." },
      { status: 400 },
    );
  }

  const validation = validateLogoUploadFile(fileEntry);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const arrayBuffer = await fileEntry.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  const detected = await fileTypeFromBuffer(buffer);
  if (!detected || !isAllowedLogoUploadMimeType(detected.mime)) {
    return NextResponse.json(
      { error: "Dateityp konnte nicht erkannt werden. Nur PNG, JPEG und WebP sind erlaubt." },
      { status: 400 },
    );
  }
  if (detected.mime !== validation.mimeType) {
    return NextResponse.json(
      {
        error: `Deklarierter Typ (${validation.mimeType}) stimmt nicht mit erkanntem Typ (${detected.mime}) überein.`,
      },
      { status: 400 },
    );
  }

  const ext = mimeToLogoExtension(detected.mime);
  if (!ext) {
    return NextResponse.json(
      { error: "Keine Dateiendung für MIME-Typ ermittelt." },
      { status: 400 },
    );
  }

  const articleId =
    typeof formData.get("articleId") === "string"
      ? (formData.get("articleId") as string).trim()
      : null;

  const suffix = articleId || Date.now().toString();
  const storageKey = `news/${tenant.key}/${suffix}.${ext}`;

  const blob = await put(storageKey, Buffer.from(buffer), {
    access: "public",
    contentType: detected.mime,
    token,
    allowOverwrite: true,
  });

  return NextResponse.json({ imageUrl: blob.url });
}
