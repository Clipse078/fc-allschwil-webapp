/**
 * POST /api/website-pages/[id]/apply-template
 *
 * Applies a page template to an existing page by creating starter sections.
 * Existing sections are NOT deleted — template sections are appended.
 *
 * Body: { templateId: string }
 * Permission: WEBSITE_MANAGE
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  getPageForTenant,
  createPageSection,
} from "@/lib/page-sections/admin-queries";
import { getPageTemplate } from "@/lib/cms/page-templates";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const { id: pageId } = await params;

  const page = await getPageForTenant(tenantId, pageId);
  if (!page) {
    return NextResponse.json({ error: "Seite nicht gefunden." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const templateId = typeof body?.templateId === "string" ? body.templateId : null;
  if (!templateId) {
    return NextResponse.json({ error: "templateId fehlt." }, { status: 400 });
  }

  const template = getPageTemplate(templateId);
  if (!template) {
    return NextResponse.json({ error: `Vorlage '${templateId}' nicht gefunden.` }, { status: 404 });
  }

  const actorUserId = access.session.user?.id ?? null;
  const created = [];

  for (const seed of template.sections) {
    const section = await createPageSection({
      tenantId,
      pageId,
      type: seed.type,
      label: seed.label,
      config: seed.config,
      actorUserId,
    });
    created.push(section);
  }

  return NextResponse.json({
    sections: created,
    meta: { templateId, sectionCount: created.length },
  });
}
