/**
 * GET   /api/reusable-components/[id]   — get single component
 * PATCH /api/reusable-components/[id]   — update component fields
 * DELETE /api/reusable-components/[id]  — archive component
 *
 * Permission: WEBSITE_MANAGE
 * Isolation:  tenantId from session — never from request body.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  getReusableComponent,
  updateReusableComponent,
  archiveReusableComponent,
} from "@/lib/reusable-components/queries";

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
  const component = await getReusableComponent(tenantId, id);

  if (!component) {
    return NextResponse.json(
      { error: "Komponente nicht gefunden." },
      { status: 404 },
    );
  }

  return NextResponse.json({ component });
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

  const actorUserId = access.session.user?.id;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const input: Record<string, unknown> = {};
  if (typeof body.title === "string") input.title = body.title.trim();
  if (typeof body.slug === "string") input.slug = body.slug.trim();
  if (typeof body.description === "string") input.description = body.description.trim() || null;
  if (body.config !== undefined && typeof body.config === "object" && !Array.isArray(body.config)) {
    input.config = body.config;
  }

  const { id } = await params;
  const component = await updateReusableComponent(tenantId, id, input, actorUserId);

  if (!component) {
    return NextResponse.json(
      { error: "Komponente nicht gefunden oder kein Zugriff." },
      { status: 404 },
    );
  }

  return NextResponse.json({ component });
}

// ── DELETE (archive) ──────────────────────────────────────────────────────────

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const actorUserId = access.session.user?.id;
  const { id } = await params;

  const component = await archiveReusableComponent(tenantId, id, actorUserId);

  if (!component) {
    return NextResponse.json(
      { error: "Komponente nicht gefunden oder kein Zugriff." },
      { status: 404 },
    );
  }

  return NextResponse.json({ component });
}
