/**
 * POST /api/website-pages/[id]/sections/[sectionId]/workflow?action=<action>
 *
 * Editorial workflow actions for a page section.
 *
 * Actions:
 *   publish          — publish immediately (approval gate applies)
 *   unpublish        — revert to DRAFT
 *   schedule         — schedule future publish (body: { scheduledAt, publishUntil? })
 *   request-review   — submit for review (body: { reviewerUserId? })
 *   approve          — approve (body: { note? })
 *   reject           — reject / request changes (body: { note? })
 *   archive          — disable + unpublish
 *
 * Permission: WEBSITE_MANAGE
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getPageForTenant } from "@/lib/page-sections/admin-queries";
import {
  publishPageSection,
  unpublishPageSection,
  schedulePageSectionPublish,
  requestReviewPageSection,
  approvePageSection,
  rejectPageSection,
  archivePageSection,
} from "@/lib/page-sections/admin-queries";
import { isApprovalGateError } from "@/lib/cms/section-publishing";

type RouteParams = { params: Promise<{ id: string; sectionId: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const actorUserId = access.session.user?.id ?? null;
  const { id: pageId, sectionId } = await params;

  const page = await getPageForTenant(tenantId, pageId);
  if (!page) {
    return NextResponse.json({ error: "Seite nicht gefunden." }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") ?? "";

  let body: Record<string, unknown> = {};
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    // body is optional
  }

  switch (action) {
    case "publish": {
      const result = await publishPageSection(tenantId, pageId, sectionId, actorUserId);
      if (result === null) {
        return NextResponse.json({ error: "Sektion nicht gefunden." }, { status: 404 });
      }
      if (isApprovalGateError(result)) {
        return NextResponse.json(
          { error: "Freigabe erforderlich vor Veröffentlichung.", approvalStatus: result.approvalStatus },
          { status: 422 },
        );
      }
      return NextResponse.json({ section: result });
    }

    case "unpublish": {
      const result = await unpublishPageSection(tenantId, pageId, sectionId, actorUserId);
      if (!result) {
        return NextResponse.json({ error: "Sektion nicht gefunden." }, { status: 404 });
      }
      return NextResponse.json({ section: result });
    }

    case "schedule": {
      const rawAt = body.scheduledAt;
      if (!rawAt || typeof rawAt !== "string") {
        return NextResponse.json({ error: "scheduledAt ist erforderlich." }, { status: 400 });
      }
      const scheduledAt = new Date(rawAt);
      if (isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
        return NextResponse.json({ error: "scheduledAt muss in der Zukunft liegen." }, { status: 400 });
      }
      const publishUntil =
        body.publishUntil && typeof body.publishUntil === "string"
          ? new Date(body.publishUntil)
          : null;

      const result = await schedulePageSectionPublish(
        tenantId, pageId, sectionId, scheduledAt, publishUntil, actorUserId,
      );
      if (result === null) {
        return NextResponse.json({ error: "Sektion nicht gefunden." }, { status: 404 });
      }
      if (isApprovalGateError(result)) {
        return NextResponse.json(
          { error: "Freigabe erforderlich vor Planung.", approvalStatus: result.approvalStatus },
          { status: 422 },
        );
      }
      return NextResponse.json({ section: result });
    }

    case "request-review": {
      const reviewerUserId =
        typeof body.reviewerUserId === "string" ? body.reviewerUserId : null;
      if (!actorUserId) {
        return NextResponse.json({ error: "Benutzer nicht identifizierbar." }, { status: 401 });
      }
      const result = await requestReviewPageSection(
        tenantId, pageId, sectionId, actorUserId, reviewerUserId,
      );
      if (result === null) {
        return NextResponse.json({ error: "Sektion nicht gefunden." }, { status: 404 });
      }
      if (result === "already_in_review") {
        return NextResponse.json({ error: "Sektion befindet sich bereits in Überprüfung." }, { status: 409 });
      }
      return NextResponse.json({ section: result });
    }

    case "approve": {
      const note = typeof body.note === "string" ? body.note.trim() || null : null;
      if (!actorUserId) {
        return NextResponse.json({ error: "Benutzer nicht identifizierbar." }, { status: 401 });
      }
      const result = await approvePageSection(tenantId, pageId, sectionId, actorUserId, note);
      if (result === null) {
        return NextResponse.json({ error: "Sektion nicht gefunden." }, { status: 404 });
      }
      if (result === "not_in_review") {
        return NextResponse.json({ error: "Sektion befindet sich nicht in Überprüfung." }, { status: 409 });
      }
      return NextResponse.json({ section: result });
    }

    case "reject": {
      const note = typeof body.note === "string" ? body.note.trim() || null : null;
      if (!actorUserId) {
        return NextResponse.json({ error: "Benutzer nicht identifizierbar." }, { status: 401 });
      }
      const result = await rejectPageSection(tenantId, pageId, sectionId, actorUserId, note);
      if (result === null) {
        return NextResponse.json({ error: "Sektion nicht gefunden." }, { status: 404 });
      }
      if (result === "not_in_review") {
        return NextResponse.json({ error: "Sektion befindet sich nicht in Überprüfung." }, { status: 409 });
      }
      return NextResponse.json({ section: result });
    }

    case "archive": {
      const result = await archivePageSection(tenantId, pageId, sectionId, actorUserId);
      if (!result) {
        return NextResponse.json({ error: "Sektion nicht gefunden." }, { status: 404 });
      }
      return NextResponse.json({ section: result });
    }

    default:
      return NextResponse.json({ error: `Unbekannte Aktion: ${action}` }, { status: 400 });
  }
}
