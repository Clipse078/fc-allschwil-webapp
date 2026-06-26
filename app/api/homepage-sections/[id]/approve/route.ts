/**
 * PATCH /api/homepage-sections/[id]/approve
 *
 * Approves a homepage section for publication.
 *
 * Transitions approvalStatus from IN_REVIEW to APPROVED.
 * Blocked if section is not currently IN_REVIEW (returns 409 Conflict).
 *
 * Optional request body:
 *   { "note"?: string | null }
 *   note: reviewer's approval note stored in approvalNote.
 *
 * After approval, the section may be published or scheduled without restriction.
 *
 * Audit trail: written to AuditLog (moduleKey="homepage").
 *
 * Permission: WEBSITE_MANAGE
 * Isolation:  tenantId from session — never from request body.
 *             Section ownership verified via tenant-scoped lookup.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { approveHomepageSection } from "@/lib/homepage/admin-queries";

type RouteParams = { params: Promise<{ id: string }> };

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
  if (!actorUserId) {
    return NextResponse.json({ error: "Benutzer-ID fehlt in der Sitzung." }, { status: 401 });
  }

  // ── Parse optional body ───────────────────────────────────────────────────
  let note: string | null | undefined = undefined;

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
    }

    if ("note" in body) {
      const raw = body.note;
      if (raw !== null && typeof raw !== "string") {
        return NextResponse.json(
          { error: "note muss eine Zeichenkette oder null sein." },
          { status: 400 },
        );
      }
      note = raw ? (raw as string).trim() || null : null;
    }
  }

  // ── Persist ───────────────────────────────────────────────────────────────
  const { id } = await params;

  const result = await approveHomepageSection(tenantId, id, actorUserId, note);

  if (result === null) {
    return NextResponse.json(
      { error: "Sektion nicht gefunden oder kein Zugriff." },
      { status: 404 },
    );
  }

  if (result === "not_in_review") {
    return NextResponse.json(
      {
        error:
          "Sektion befindet sich nicht in Überprüfung. Nur Sektionen mit Status «In Überprüfung» können freigegeben werden.",
      },
      { status: 409 },
    );
  }

  return NextResponse.json({ section: result });
}
