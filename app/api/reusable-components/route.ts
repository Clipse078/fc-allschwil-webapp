/**
 * GET  /api/reusable-components  — list components (admin, with filters)
 * POST /api/reusable-components  — create a new reusable component
 *
 * Permission: WEBSITE_MANAGE
 * Isolation:  tenantId from session — never from request body.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  listReusableComponents,
  createReusableComponent,
} from "@/lib/reusable-components/queries";
import { REUSABLE_COMPONENT_TYPE } from "@/lib/reusable-components/component-types";

// ── GET /api/reusable-components ─────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const type = searchParams.get("type") ?? undefined;
  const publishStatus = searchParams.get("publishStatus") ?? undefined;
  const includeArchived = searchParams.get("includeArchived") === "true";
  const search = searchParams.get("search") ?? undefined;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "200", 10), 500);
  const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10), 0);

  const components = await listReusableComponents(tenantId, {
    type,
    publishStatus,
    includeArchived,
    search,
    limit,
    offset,
  });

  return NextResponse.json({ components, meta: { total: components.length } });
}

// ── POST /api/reusable-components ────────────────────────────────────────────

export async function POST(request: NextRequest) {
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

  const type = typeof body.type === "string" ? body.type.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() || null : null;
  const slug = typeof body.slug === "string" ? body.slug.trim() : undefined;
  const config =
    body.config !== null && typeof body.config === "object" && !Array.isArray(body.config)
      ? (body.config as Record<string, unknown>)
      : undefined;

  if (!type || !Object.values(REUSABLE_COMPONENT_TYPE).includes(type as never)) {
    return NextResponse.json(
      { error: `Unbekannter Komponenten-Typ: ${type}` },
      { status: 400 },
    );
  }
  if (!title) {
    return NextResponse.json(
      { error: "Titel ist erforderlich." },
      { status: 400 },
    );
  }

  const component = await createReusableComponent(tenantId, {
    type,
    title,
    slug,
    description: description ?? undefined,
    config,
    createdByUserId: actorUserId,
  });

  return NextResponse.json({ component }, { status: 201 });
}
