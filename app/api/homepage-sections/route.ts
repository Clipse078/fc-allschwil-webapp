/**
 * GET  /api/homepage-sections     — list all sections (admin).
 * POST /api/homepage-sections     — bootstrap default sections.
 *
 * Permission: WEBSITE_MANAGE
 * Isolation:  tenantId from session — never from request body.
 */

import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  listHomepageSections,
  countHomepageSections,
  bootstrapDefaultSections,
} from "@/lib/homepage/admin-queries";

// ── GET /api/homepage-sections ────────────────────────────────────────────────

export async function GET() {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const sections = await listHomepageSections(tenantId);

  return NextResponse.json({
    sections,
    meta: { total: sections.length },
  });
}

// ── POST /api/homepage-sections ───────────────────────────────────────────────
// Bootstraps the default section set for the tenant.
// Safe to call only when tenant has no sections; returns 409 otherwise.

export async function POST() {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const existing = await countHomepageSections(tenantId);
  if (existing > 0) {
    return NextResponse.json(
      {
        error:
          "Standard-Sektionen können nicht erstellt werden — dieser Mandant hat bereits Sektionen.",
        existing,
      },
      { status: 409 },
    );
  }

  const created = await bootstrapDefaultSections(tenantId);

  return NextResponse.json({ created }, { status: 201 });
}
