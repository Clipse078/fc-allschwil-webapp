/**
 * GET    /api/website-redirects     — list redirects for tenant.
 * POST   /api/website-redirects     — create a redirect.
 *
 * Permission: WEBSITE_MANAGE
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  listWebsiteRedirects,
  createWebsiteRedirect,
} from "@/lib/website-config/admin-queries";

export async function GET() {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Kein Mandant." }, { status: 401 });

  const redirects = await listWebsiteRedirects(tenantId);
  return NextResponse.json({ redirects });
}

export async function POST(req: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Kein Mandant." }, { status: 401 });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;

  if (typeof body.fromPath !== "string" || !body.fromPath.trim()) {
    return NextResponse.json({ error: "fromPath ist erforderlich." }, { status: 400 });
  }
  if (typeof body.toPath !== "string" || !body.toPath.trim()) {
    return NextResponse.json({ error: "toPath ist erforderlich." }, { status: 400 });
  }

  const result = await createWebsiteRedirect(tenantId, {
    fromPath: (body.fromPath as string).trim(),
    toPath: (body.toPath as string).trim(),
    statusCode: typeof body.statusCode === "number" ? body.statusCode : 301,
    isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
    note: typeof body.note === "string" ? body.note.trim() || null : null,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json({ redirect: result }, { status: 201 });
}
