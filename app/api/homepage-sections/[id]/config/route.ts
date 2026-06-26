/**
 * PATCH /api/homepage-sections/[id]/config
 *
 * Updates the label and/or config of a single homepage section.
 *
 * Request body (all fields optional, at least one required):
 *   { label?: string; config?: Record<string, unknown> }
 *
 * Validation:
 *   - label must be 1–200 non-whitespace characters
 *   - config keys must match the allowed set for the section type
 *   - unknown config keys are rejected (validated with .strict() Zod schemas)
 *   - config values are validated per-field (ranges, types, enum members)
 *
 * Permission: WEBSITE_MANAGE
 * Isolation:  tenantId from session — never from request body.
 *             Section ownership verified in query layer (tenant-scoped findFirst).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getHomepageSectionById, updateHomepageSection } from "@/lib/homepage/admin-queries";
import { isValidSectionTypeKey } from "@/lib/homepage/section-types";
import { validateSectionConfig } from "@/lib/homepage/config-schemas";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  // ── At-least-one-field guard ──────────────────────────────────────────────
  const hasLabel = "label" in body;
  const hasConfig = "config" in body;
  if (!hasLabel && !hasConfig) {
    return NextResponse.json(
      { error: "Mindestens eines der Felder 'label' oder 'config' muss angegeben werden." },
      { status: 400 },
    );
  }

  // ── Validate label ────────────────────────────────────────────────────────
  let newLabel: string | undefined;
  if (hasLabel) {
    if (typeof body.label !== "string") {
      return NextResponse.json(
        { error: "label muss eine Zeichenkette sein." },
        { status: 400 },
      );
    }
    newLabel = body.label.trim();
    if (newLabel.length === 0) {
      return NextResponse.json(
        { error: "label darf nicht leer sein." },
        { status: 400 },
      );
    }
    if (newLabel.length > 200) {
      return NextResponse.json(
        { error: "label darf maximal 200 Zeichen lang sein." },
        { status: 400 },
      );
    }
  }

  // ── Resolve section (needed to know type for config validation) ───────────
  const { id } = await params;
  const section = await getHomepageSectionById(tenantId, id);
  if (!section) {
    return NextResponse.json(
      { error: "Sektion nicht gefunden oder kein Zugriff." },
      { status: 404 },
    );
  }

  // ── Validate config ───────────────────────────────────────────────────────
  let newConfig: Record<string, unknown> | undefined;
  if (hasConfig) {
    if (
      body.config === null ||
      typeof body.config !== "object" ||
      Array.isArray(body.config)
    ) {
      return NextResponse.json(
        { error: "config muss ein JSON-Objekt sein." },
        { status: 400 },
      );
    }

    if (!isValidSectionTypeKey(section.type)) {
      return NextResponse.json(
        { error: `Unbekannter Sektionstyp: ${section.type}` },
        { status: 422 },
      );
    }

    const validation = validateSectionConfig(section.type, body.config);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Ungültige Konfiguration.", details: validation.errors },
        { status: 422 },
      );
    }

    newConfig = validation.data;
  }

  // ── Persist ───────────────────────────────────────────────────────────────
  const updated = await updateHomepageSection(tenantId, id, {
    ...(newLabel !== undefined ? { label: newLabel } : {}),
    ...(newConfig !== undefined ? { config: newConfig } : {}),
  });

  if (!updated) {
    return NextResponse.json(
      { error: "Sektion nicht gefunden oder kein Zugriff." },
      { status: 404 },
    );
  }

  return NextResponse.json({ section: updated });
}
