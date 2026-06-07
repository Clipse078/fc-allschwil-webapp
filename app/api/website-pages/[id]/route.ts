/**
 * GET    /api/website-pages/[id]  — fetch one page (admin, any status).
 * PATCH  /api/website-pages/[id]  — update page fields.
 * DELETE /api/website-pages/[id]  — hard-delete the page.
 *
 * Permission: WEBSITE_MANAGE
 * Isolation:  tenantId from session.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  getWebsitePageAdminById,
  updateWebsitePage,
  deleteWebsitePage,
  isPageSlugAvailable,
} from "@/lib/pages/admin-queries";

type RouteParams = { params: Promise<{ id: string }> };

// ── GET /api/website-pages/[id] ───────────────────────────────────────────────

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
  const page = await getWebsitePageAdminById(tenantId, id);
  if (!page) {
    return NextResponse.json({ error: "Seite nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ page });
}

// ── PATCH /api/website-pages/[id] ─────────────────────────────────────────────

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

  // Slug collision check (only if slug is being changed)
  if (typeof body.slug === "string" && body.slug.trim()) {
    const slugOk = await isPageSlugAvailable(tenantId, body.slug.trim(), id);
    if (!slugOk) {
      return NextResponse.json({ error: "Slug wird bereits verwendet." }, { status: 409 });
    }
  }

  const updated = await updateWebsitePage(tenantId, id, {
    ...(typeof body.title === "string" ? { title: body.title.trim() } : {}),
    ...(typeof body.slug === "string" ? { slug: body.slug.trim() } : {}),
    ...(typeof body.body === "string" ? { body: body.body } : {}),
    ...(body.seoTitle !== undefined
      ? { seoTitle: typeof body.seoTitle === "string" ? body.seoTitle.trim() || null : null }
      : {}),
    ...(body.seoDescription !== undefined
      ? {
          seoDescription:
            typeof body.seoDescription === "string" ? body.seoDescription.trim() || null : null,
        }
      : {}),
    ...(body.scheduledAt !== undefined
      ? {
          scheduledAt:
            typeof body.scheduledAt === "string" && body.scheduledAt
              ? new Date(body.scheduledAt)
              : null,
        }
      : {}),
    ...(body.authorPersonId !== undefined
      ? {
          authorPersonId:
            typeof body.authorPersonId === "string" ? body.authorPersonId || null : null,
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
    return NextResponse.json({ error: "Seite nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ page: updated });
}

// ── DELETE /api/website-pages/[id] ────────────────────────────────────────────

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
  const ok = await deleteWebsitePage(tenantId, id);
  if (!ok) {
    return NextResponse.json({ error: "Seite nicht gefunden." }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
