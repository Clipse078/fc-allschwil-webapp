/**
 * PATCH /api/homepage-sections/[id]/request-review
 *
 * Requests editorial review for a homepage section.
 *
 * Transitions approvalStatus to IN_REVIEW.
 * Allowed from: NOT_REQUIRED, DRAFT, APPROVED, CHANGES_REQUESTED.
 * Blocked if already IN_REVIEW (returns 409 Conflict).
 *
 * Optional request body:
 *   { "reviewerUserId"?: string | null }
 *   reviewerUserId: assigns a specific reviewer (must belong to same tenant).
 *   Omitting reviewerUserId leaves the current reviewer assignment unchanged.
 *   Setting to null explicitly clears the reviewer assignment.
 *
 * Audit trail: written to AuditLog (moduleKey="homepage").
 *
 * Permission: WEBSITE_MANAGE
 * Isolation:  tenantId from session — never from request body.
 *             Section ownership verified via tenant-scoped lookup.
 *             Reviewer user verified to belong to same tenant.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requestReviewHomepageSection } from "@/lib/homepage/admin-queries";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const actorUserId = access.session.user?.id;
  if (!actorUserId) {
    return NextResponse.json({ error: "Benutzer-ID fehlt in der Sitzung." }, { status: 401 });
  }

  // ── Parse optional body ───────────────────────────────────────────────────
  let reviewerUserId: string | null | undefined = undefined;

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
    }

    if ("reviewerUserId" in body) {
      const raw = body.reviewerUserId;
      if (raw !== null && typeof raw !== "string") {
        return NextResponse.json(
          { error: "reviewerUserId muss eine Zeichenkette oder null sein." },
          { status: 400 },
        );
      }
      reviewerUserId = raw as string | null;
    }
  }

  // ── Persist ───────────────────────────────────────────────────────────────
  const { id } = await params;

  const result = await requestReviewHomepageSection(
    tenantId,
    id,
    actorUserId,
    reviewerUserId,
  );

  if (result === null) {
    return NextResponse.json(
      { error: "Sektion nicht gefunden oder kein Zugriff." },
      { status: 404 },
    );
  }

  if (result === "already_in_review") {
    return NextResponse.json(
      { error: "Sektion befindet sich bereits in Überprüfung." },
      { status: 409 },
    );
  }

  return NextResponse.json({ section: result });
}
