/**
 * GET /api/homepage-sections/review-queue
 *
 * Returns the editorial review queue for the tenant: sections that are
 * IN_REVIEW, CHANGES_REQUESTED, or DRAFT (awaiting review request).
 * Also returns recently approved sections for context.
 *
 * Response shape:
 *   {
 *     queue: HomepageSectionAdminItem[]   — sections needing attention
 *     recentlyApproved: HomepageSectionAdminItem[]  — recently approved (max 10)
 *     meta: {
 *       inReview: number
 *       changesRequested: number
 *       draft: number
 *       recentlyApproved: number
 *     }
 *   }
 *
 * Permission: WEBSITE_MANAGE
 * Isolation:  tenantId from session — never from query params or body.
 */

import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  listSectionsForReview,
  listRecentlyApprovedSections,
  APPROVAL_STATUS,
} from "@/lib/homepage/admin-queries";

export async function GET() {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const [queue, recentlyApproved] = await Promise.all([
    listSectionsForReview(tenantId),
    listRecentlyApprovedSections(tenantId, 10),
  ]);

  return NextResponse.json({
    queue,
    recentlyApproved,
    meta: {
      inReview: queue.filter(
        (s) => s.approvalStatus === APPROVAL_STATUS.IN_REVIEW,
      ).length,
      changesRequested: queue.filter(
        (s) => s.approvalStatus === APPROVAL_STATUS.CHANGES_REQUESTED,
      ).length,
      draft: queue.filter(
        (s) => s.approvalStatus === APPROVAL_STATUS.DRAFT,
      ).length,
      recentlyApproved: recentlyApproved.length,
    },
  });
}
