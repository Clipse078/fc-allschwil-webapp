/**
 * GET /api/website-pages/templates
 *
 * Returns the list of available page templates.
 * Used by PageTemplatesPicker to load template definitions.
 *
 * Permission: WEBSITE_MANAGE
 */

import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getAllPageTemplates } from "@/lib/cms/page-templates";

export async function GET() {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const templates = getAllPageTemplates();
  return NextResponse.json({ templates });
}
