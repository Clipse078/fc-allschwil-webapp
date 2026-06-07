/**
 * GET    /api/homepage-blocks/[id]  — fetch one block.
 * PATCH  /api/homepage-blocks/[id]  — update block fields.
 * DELETE /api/homepage-blocks/[id]  — delete block + instances.
 *
 * Permission: WEBSITE_MANAGE
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  getHomepageBlockById,
  updateHomepageBlock,
  deleteHomepageBlock,
  setBlockEnabled,
} from "@/lib/homepage/admin-queries";

type RouteParams = { params: Promise<{ id: string }> };

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
  const block = await getHomepageBlockById(tenantId, id);
  if (!block) {
    return NextResponse.json({ error: "Block nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ block });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  // Handle enabled toggle via PATCH
  if (typeof body.enabled === "boolean") {
    const ok = await setBlockEnabled(tenantId, id, body.enabled);
    if (!ok) {
      return NextResponse.json({ error: "Block nicht gefunden." }, { status: 404 });
    }
    const updated = await getHomepageBlockById(tenantId, id);
    return NextResponse.json({ block: updated });
  }

  // General field update
  const updated = await updateHomepageBlock(tenantId, id, {
    ...(typeof body.title === "string" ? { title: body.title.trim() } : {}),
    ...(body.config !== undefined ? { config: body.config as never } : {}),
    ...(body.scheduledAt !== undefined
      ? {
          scheduledAt:
            typeof body.scheduledAt === "string" && body.scheduledAt
              ? new Date(body.scheduledAt)
              : null,
        }
      : {}),
    ...(body.reviewNotes !== undefined
      ? {
          reviewNotes:
            typeof body.reviewNotes === "string" ? body.reviewNotes.trim() || null : null,
        }
      : {}),
  });

  if (!updated) {
    return NextResponse.json({ error: "Block nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ block: updated });
}

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
