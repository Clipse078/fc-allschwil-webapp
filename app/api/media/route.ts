/**
 * /api/media — Media Library list and upload.
 *
 * GET  /api/media?type=IMAGE&status=ACTIVE   — list tenant assets
 * POST /api/media                            — upload new asset (multipart/form-data)
 *
 * All endpoints require NEWS_MANAGE or WEBSITE_MANAGE permission.
 * All data is tenant-scoped from the session.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasAnyPermission } from "@/lib/permissions/has-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantFromSession } from "@/lib/tenants/queries";
import { listMediaAssets, createMediaAsset } from "@/lib/media/queries";
import { validateMediaUploadFile, mimeToAssetType, safeStem } from "@/lib/media/validation";
import { uploadMediaAsset } from "@/lib/media/storage";
import type { MediaAssetType, MediaAssetStatus } from "@prisma/client";

const REQUIRED_PERMISSIONS = [PERMISSIONS.NEWS_MANAGE, PERMISSIONS.WEBSITE_MANAGE];

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    if (!hasAnyPermission(session, REQUIRED_PERMISSIONS)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const tenant = await getTenantFromSession(session.user.tenantId);
    if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const rawType = searchParams.get("type");
    const rawStatus = searchParams.get("status");
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 200);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10) || 0;

    const validTypes: MediaAssetType[] = ["IMAGE", "VIDEO", "DOCUMENT"];
    const validStatuses: MediaAssetStatus[] = ["ACTIVE", "ARCHIVED"];

    const type = rawType && validTypes.includes(rawType as MediaAssetType)
      ? (rawType as MediaAssetType)
      : null;
    const status = rawStatus && validStatuses.includes(rawStatus as MediaAssetStatus)
      ? (rawStatus as MediaAssetStatus)
      : ("ACTIVE" as const);

    const { assets, total } = await listMediaAssets({
      tenantId: tenant.id,
      type,
      status,
      limit,
      offset,
    });

    return NextResponse.json({ assets, total, limit, offset });
  } catch (error) {
    console.error("[GET /api/media]", error);
    return NextResponse.json({ error: "Interner Fehler." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    if (!hasAnyPermission(session, REQUIRED_PERMISSIONS)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const tenant = await getTenantFromSession(session.user.tenantId);
    if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });

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
        { error: "Kein Datei-Feld 'file' im Formular gefunden." },
        { status: 400 },
      );
    }

    const validation = validateMediaUploadFile(fileEntry);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const customName = formData.get("name");
    const altText = formData.get("altText");

    const arrayBuffer = await fileEntry.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const assetId = crypto.randomUUID().replace(/-/g, "");

    const uploadResult = await uploadMediaAsset(
      tenant.key,
      assetId,
      buffer,
      validation.mimeType,
    );

    if (!uploadResult.ok) {
      return NextResponse.json({ error: uploadResult.error }, { status: uploadResult.status });
    }

    const assetType = mimeToAssetType(validation.mimeType) ?? "IMAGE";
    const originalName = fileEntry.name || "asset";
    const displayName = typeof customName === "string" && customName.trim()
      ? customName.trim()
      : safeStem(originalName.replace(/\.[^.]+$/, ""));

    const asset = await createMediaAsset({
      tenantId: tenant.id,
      type: assetType,
      name: displayName,
      altText: typeof altText === "string" && altText.trim() ? altText.trim() : null,
      fileName: originalName,
      mimeType: validation.mimeType,
      fileSize: fileEntry.size,
      storageProvider: uploadResult.provider,
      storageKey: uploadResult.storageKey,
      storagePath: uploadResult.publicUrl,
      createdById: session.user.id ?? null,
    });

    return NextResponse.json({ asset }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/media]", error);
    return NextResponse.json({ error: "Interner Fehler." }, { status: 500 });
  }
}
