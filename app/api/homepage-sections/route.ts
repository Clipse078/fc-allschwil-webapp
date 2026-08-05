/**
 * GET  /api/homepage-sections     — list all sections (admin).
 * POST /api/homepage-sections     — bootstrap default sections OR create single section.
 *   Bootstrap: empty body or body without `type` field.
 *   Create:    body with { type, label?, config? } — inserts as local copy (DRAFT, disabled).
 *
 * Permission: WEBSITE_MANAGE
 * Isolation:  tenantId from session — never from request body.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  listHomepageSections,
  countHomepageSections,
  bootstrapDefaultSections,
  createHomepageSection,
} from "@/lib/homepage/admin-queries";
import { getBlockDefinition } from "@/lib/homepage/block-registry";
import { validateSectionConfig } from "@/lib/homepage/config-schemas";

// ── GET /api/homepage-sections ────────────────────────────────────────────────

export async function GET() {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.activeTenantId;
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
// Two modes depending on the request body:
//   1. Bootstrap (no body / no `type`): creates all default sections for the tenant.
//   2. Insert (body with `type`): creates a single section at the end of the list.
//      Used by Homepage Builder when inserting a reusable block as a local copy.

export async function POST(request: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  // Parse body — tolerate empty bodies for the bootstrap path
  let body: Record<string, unknown> = {};
  try {
    const text = await request.text();
    if (text.trim()) body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const actorUserId = access.session.user?.id ?? null;

  // ── Insert single section (library copy-on-insert) ────────────────────────
  if (typeof body.type === "string" && body.type.trim()) {
    const type = body.type.trim();
    const blockDef = getBlockDefinition(type);
    if (!blockDef) {
      return NextResponse.json(
        { error: `Unbekannter Blocktyp: "${type}".` },
        { status: 400 },
      );
    }

    const label =
      typeof body.label === "string" && body.label.trim()
        ? body.label.trim()
        : blockDef.displayName;

    const rawConfig =
      body.config !== undefined &&
      body.config !== null &&
      typeof body.config === "object" &&
      !Array.isArray(body.config)
        ? (body.config as Record<string, unknown>)
        : blockDef.defaultConfig;

    const configResult = validateSectionConfig(type, rawConfig);
    if (!configResult.success) {
      return NextResponse.json(
        { error: "Ungültige Konfiguration.", details: configResult.errors },
        { status: 400 },
      );
    }

    const section = await createHomepageSection(tenantId, {
      type,
      label,
      config: configResult.data,
      actorUserId,
    });

    return NextResponse.json({ section }, { status: 201 });
  }

  // ── Bootstrap default sections ────────────────────────────────────────────
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
