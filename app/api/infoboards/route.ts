/**
 * app/api/infoboards/route.ts
 *
 * Infoboard V2 management API — list and create.
 *
 * GET  /api/infoboards  — list all Infoboards for the authenticated tenant
 * POST /api/infoboards  — create a new Infoboard
 *
 * Permission: INFOBOARD_MANAGE
 * Tenant isolation: from session.user.activeTenantId only.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  listInfoboards,
  createInfoboard,
} from "@/lib/infoboard/queries";
import { generateInfoboardSlug } from "@/lib/infoboard/slug";

const REQUIRED_PERMISSIONS = [PERMISSIONS.INFOBOARD_MANAGE];

export async function GET() {
  const access = await requireApiAnyPermission(REQUIRED_PERMISSIONS);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const boards = await listInfoboards(tenantId);
  return NextResponse.json({ boards });
}

export async function POST(req: NextRequest) {
  const access = await requireApiAnyPermission(REQUIRED_PERMISSIONS);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültige JSON-Anfrage." }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as Record<string, unknown>).name !== "string"
  ) {
    return NextResponse.json(
      { error: "Pflichtfeld 'name' fehlt oder ist kein String." },
      { status: 422 },
    );
  }

  const { name, templateType } = body as Record<string, unknown>;

  const trimmedName = (name as string).trim();
  if (trimmedName.length === 0) {
    return NextResponse.json({ error: "Name darf nicht leer sein." }, { status: 422 });
  }
  if (trimmedName.length > 120) {
    return NextResponse.json({ error: "Name ist zu lang (max. 120 Zeichen)." }, { status: 422 });
  }

  const slug = generateInfoboardSlug(trimmedName);

  const board = await createInfoboard({
    tenantId,
    name: trimmedName,
    slug,
    templateType: typeof templateType === "string" ? templateType : undefined,
  });

  return NextResponse.json({ board }, { status: 201 });
}
