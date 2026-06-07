/**
 * GET    /api/homepage-blocks/[id]  — get block detail.
 * PATCH  /api/homepage-blocks/[id]  — update block.
 * DELETE /api/homepage-blocks/[id]  — delete block.
 *
 * Permission: WEBSITE_MANAGE
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  getHomepageBlockAdminById,
  updateHomepageBlock,
  deleteHomepageBlock,
} from "@/lib/homepage-blocks/admin-queries";

type RouteParams = { params: Promise<{ id: string }> };

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const { id } = await params;
  const block = await getHomepageBlockAdminById(tenantId, id);
  if (!block) {
    return NextResponse.json({ error: "Block nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ block });
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const { id } = await params;

  const updateInput: Parameters<typeof updateHomepageBlock>[2] = {};

  if (typeof body.title === "string") updateInput.title = body.title.trim();

  if (body.data !== undefined) {
    const rawData = (body.data ?? {}) as Record<string, unknown>;
    updateInput.data = {
      headline: typeof rawData.headline === "string" ? rawData.headline : "",
      subheadline: typeof rawData.subheadline === "string" ? rawData.subheadline : "",
      ctaLabel: typeof rawData.ctaLabel === "string" ? rawData.ctaLabel : "",
      ctaUrl: typeof rawData.ctaUrl === "string" ? rawData.ctaUrl : "",
    };
  }

  if ("heroMediaId" in body) {
    updateInput.heroMediaId = typeof body.heroMediaId === "string" ? body.heroMediaId : null;
  }
  if ("overlayColor" in body) {
    updateInput.overlayColor = typeof body.overlayColor === "string" ? body.overlayColor || null : null;
  }
  if ("overlayOpacity" in body) {
    updateInput.overlayOpacity =
      typeof body.overlayOpacity === "number"
        ? Math.min(100, Math.max(0, Math.round(body.overlayOpacity)))
        : null;
  }
  if ("gradientType" in body) {
    updateInput.gradientType = typeof body.gradientType === "string" ? body.gradientType || null : null;
  }
  if ("gradientFrom" in body) {
    updateInput.gradientFrom = typeof body.gradientFrom === "string" ? body.gradientFrom || null : null;
  }
  if ("gradientTo" in body) {
    updateInput.gradientTo = typeof body.gradientTo === "string" ? body.gradientTo || null : null;
  }
  if ("textColor" in body) {
    updateInput.textColor = typeof body.textColor === "string" ? body.textColor || null : null;
  }
  if ("scheduledAt" in body) {
    updateInput.scheduledAt =
      typeof body.scheduledAt === "string" ? new Date(body.scheduledAt) : null;
  }
  if ("reviewNotes" in body) {
    updateInput.reviewNotes = typeof body.reviewNotes === "string" ? body.reviewNotes : null;
  }

  const block = await updateHomepageBlock(tenantId, id, updateInput);
  if (!block) {
    return NextResponse.json({ error: "Block nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ block });
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const { id } = await params;
  const ok = await deleteHomepageBlock(tenantId, id);
  if (!ok) {
    return NextResponse.json({ error: "Block nicht gefunden." }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
