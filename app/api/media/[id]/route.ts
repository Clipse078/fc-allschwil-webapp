/**
 * /api/media/[id] — Media asset detail, update, and archive.
 *
 * GET   /api/media/[id]   — get asset detail
 * PATCH /api/media/[id]   — update name, altText, focalX, focalY, or archive
 *
 * No DELETE: assets are archived only to preserve referential integrity.
 * All endpoints are tenant-scoped from the session.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasAnyPermission } from "@/lib/permissions/has-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantFromSession } from "@/lib/tenants/queries";
import { getMediaAssetById, updateMediaAsset } from "@/lib/media/queries";
import { isValidFocalPoint } from "@/lib/media/validation";

const REQUIRED_PERMISSIONS = [PERMISSIONS.NEWS_MANAGE, PERMISSIONS.WEBSITE_MANAGE];

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    if (!hasAnyPermission(session, REQUIRED_PERMISSIONS)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const tenant = await getTenantFromSession(session.user.tenantId);
    if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });

    const asset = await getMediaAssetById(id, tenant.id);
    if (!asset) return NextResponse.json({ error: "Asset nicht gefunden." }, { status: 404 });

    return NextResponse.json({ asset });
  } catch (error) {
    console.error("[GET /api/media/[id]]", error);
    return NextResponse.json({ error: "Interner Fehler." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    if (!hasAnyPermission(session, REQUIRED_PERMISSIONS)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const tenant = await getTenantFromSession(session.user.tenantId);
    if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
    }

    const { name, altText, focalX, focalY, status: assetStatus } = body;

    if (name !== undefined && (typeof name !== "string" || !name.trim())) {
      return NextResponse.json({ error: "name muss ein nicht-leerer String sein." }, { status: 400 });
    }

    if (focalX !== undefined && !isValidFocalPoint(focalX)) {
      return NextResponse.json({ error: "focalX muss eine Zahl zwischen 0 und 100 sein." }, { status: 400 });
    }

    if (focalY !== undefined && !isValidFocalPoint(focalY)) {
      return NextResponse.json({ error: "focalY muss eine Zahl zwischen 0 und 100 sein." }, { status: 400 });
    }

    if (assetStatus !== undefined && assetStatus !== "ACTIVE" && assetStatus !== "ARCHIVED") {
      return NextResponse.json({ error: "status muss ACTIVE oder ARCHIVED sein." }, { status: 400 });
    }

    const updated = await updateMediaAsset(id, tenant.id, {
      ...(name !== undefined ? { name: String(name).trim() } : {}),
      ...(altText !== undefined ? { altText: altText === null ? null : String(altText) } : {}),
      ...(focalX !== undefined ? { focalX: focalX as number } : {}),
      ...(focalY !== undefined ? { focalY: focalY as number } : {}),
      ...(assetStatus !== undefined ? { status: assetStatus as "ACTIVE" | "ARCHIVED" } : {}),
    });

    if (!updated) {
      return NextResponse.json({ error: "Asset nicht gefunden." }, { status: 404 });
    }

    return NextResponse.json({ asset: updated });
  } catch (error) {
    console.error("[PATCH /api/media/[id]]", error);
    return NextResponse.json({ error: "Interner Fehler." }, { status: 500 });
  }
}
