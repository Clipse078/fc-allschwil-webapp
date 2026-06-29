/**
 * GET  /api/website-redirects  — list all redirects for the tenant.
 * POST /api/website-redirects  — create a new redirect.
 *
 * Permission: WEBSITE_MANAGE
 * Isolation:  tenantId from session — never from request body.
 *
 * Introduced: CMS V4.2 — Website Platform UX Unification
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { listWebsiteRedirects, createWebsiteRedirect } from "@/lib/website-redirects/queries";

// ── GET /api/website-redirects ────────────────────────────────────────────────

export async function GET() {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const redirects = await listWebsiteRedirects(tenantId);
  return NextResponse.json({ redirects });
}

// ── POST /api/website-redirects ───────────────────────────────────────────────

export async function POST(request: NextRequest) {
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

  const fromPath = typeof body.fromPath === "string" ? body.fromPath.trim() : "";
  const toPath = typeof body.toPath === "string" ? body.toPath.trim() : "";

  if (!fromPath || !toPath) {
    return NextResponse.json(
      { error: "fromPath und toPath sind erforderlich." },
      { status: 400 },
    );
  }

  // fromPath must start with /
  if (!fromPath.startsWith("/")) {
    return NextResponse.json(
      { error: "fromPath muss mit / beginnen." },
      { status: 400 },
    );
  }

  try {
    const redirect = await createWebsiteRedirect(tenantId, {
      fromPath,
      toPath,
      isPermanent: typeof body.isPermanent === "boolean" ? body.isPermanent : true,
      isActive: typeof body.isActive === "boolean" ? body.isActive : true,
    });
    return NextResponse.json({ redirect }, { status: 201 });
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Ein Redirect für diesen Pfad existiert bereits." },
        { status: 409 },
      );
    }
    throw err;
  }
}
