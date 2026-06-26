/**
 * PATCH /api/homepage-sections/[id]/publish
 *
 * Publishes a homepage section by setting publishStatus = "PUBLISHED".
 * Records publishedAt and lastPublishedAt timestamps.
 * Clears any pending scheduledPublishAt (section is immediately live).
 *
 * A section must also be enabled (isEnabled=true) to appear in the public API.
 * Publish/unpublish and enable/disable are independent operations.
 *
 * Approval gate (CMS V2 Slice 6):
 *   Only sections with approvalStatus APPROVED or NOT_REQUIRED may be published.
 *   DRAFT, IN_REVIEW, and CHANGES_REQUESTED sections are blocked.
 *   Returns HTTP 422 with a descriptive error if the gate is not satisfied.
 *   Existing published sections with approvalStatus NOT_REQUIRED are unaffected.
 *
 * Permission: WEBSITE_MANAGE
 * Isolation:  tenantId from session — never from request body.
 *             Section ownership verified via tenant-scoped lookup.
 */

import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  publishHomepageSection,
  APPROVAL_STATUS_LABELS,
} from "@/lib/homepage/admin-queries";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(_request: Request, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const { id } = await params;

  const result = await publishHomepageSection(tenantId, id);

  if (result === null) {
    return NextResponse.json(
      { error: "Sektion nicht gefunden oder kein Zugriff." },
      { status: 404 },
    );
  }

  if ("blocked" in result) {
    const label = APPROVAL_STATUS_LABELS[result.approvalStatus];
    return NextResponse.json(
      {
        error: `Veröffentlichung blockiert: Freigabestatus ist «${label}». Nur freigegebene oder freigabefreie Sektionen können veröffentlicht werden.`,
        approvalStatus: result.approvalStatus,
      },
      { status: 422 },
    );
  }

  return NextResponse.json({ section: result });
}
