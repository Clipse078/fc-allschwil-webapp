/**
 * GET /api/website-pages/[id]/preview
 *
 * Returns all sections for a page regardless of publishStatus.
 * For admin preview only — never cache, never expose publicly.
 *
 * Returns: { page, sections } — same shape as the public layout API
 * but with admin metadata (publishStatus, approvalStatus).
 *
 * Permission: WEBSITE_MANAGE
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getWebsitePageAdminById } from "@/lib/pages/admin-queries";
import { getPageSectionsForPreview } from "@/lib/page-sections/admin-queries";
import {
  getPublicBlockMeta,
  projectBlockPublicConfig,
} from "@/lib/homepage/block-registry";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const { id: pageId } = await params;

  const page = await getWebsitePageAdminById(tenantId, pageId);
  if (!page) {
    return NextResponse.json({ error: "Seite nicht gefunden." }, { status: 404 });
  }

  const rawSections = await getPageSectionsForPreview(tenantId, pageId);

  const sections = rawSections.map((s) => ({
    id: s.id,
    type: s.type,
    label: s.label,
    sortOrder: s.sortOrder,
    isEnabled: s.isEnabled,
    publishStatus: s.publishStatus,
    approvalStatus: s.approvalStatus,
    config: projectBlockPublicConfig(s.type, s.config),
    block: getPublicBlockMeta(s.type),
  }));

  return NextResponse.json(
    {
      page: {
        id: page.id,
        slug: page.slug,
        title: page.title,
        status: page.status,
        seoTitle: page.seoTitle,
        seoDescription: page.seoDescription,
        publishedAt: page.publishedAt,
      },
      sections,
      previewMode: true,
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-Preview-Mode": "admin",
      },
    },
  );
}
