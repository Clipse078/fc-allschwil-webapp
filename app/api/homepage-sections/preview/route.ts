/**
 * GET /api/homepage-sections/preview
 *
 * Admin preview endpoint — returns ALL homepage sections for the tenant
 * regardless of publishStatus or isEnabled, so admins can preview draft
 * and disabled sections before publishing.
 *
 * Each section includes:
 *   - All public-safe fields (id, type, label, sortOrder, config, block)
 *   - isDraft: true if section is not yet published and has no active schedule
 *   - isDisabled: true if isEnabled = false
 *   - scheduledPublishAt: the scheduled publish time if any
 *
 * Safety guarantee:
 *   This endpoint is ONLY accessible to authenticated admins with WEBSITE_MANAGE
 *   permission. It is NOT publicly accessible. Draft sections are never exposed
 *   through the public homepage API (GET /api/public/[tenant]/website/homepage).
 *
 * Permission: WEBSITE_MANAGE
 * Isolation:  tenantId from session — never from query params or body.
 */

import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getPreviewHomepageSections } from "@/lib/homepage/public-homepage-feed";

export async function GET() {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const sections = await getPreviewHomepageSections(tenantId);

  return NextResponse.json({
    sections,
    meta: {
      total: sections.length,
      published: sections.filter((s) => !s.isDraft && !s.isDisabled).length,
      draft: sections.filter((s) => s.isDraft).length,
      disabled: sections.filter((s) => s.isDisabled).length,
    },
  });
}
