/**
 * GET /api/tenants/[tenantSlug]/communications/mention-candidates?q=...
 *
 * COMM-01B: Tenant-scoped @mention candidate search.
 */

import { NextRequest, NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { requireApiTenantContextForSlug } from "@/lib/tenants/active-tenant";
import { listMentionCandidatesForTenant } from "@/lib/communication/mention-candidates";

type Context = { params: Promise<{ tenantSlug: string }> };

export async function GET(request: NextRequest, context: Context) {
  const { tenantSlug } = await context.params;

  const tenantResult = await requireApiTenantContextForSlug(tenantSlug);
  if (!tenantResult.ok) {
    return NextResponse.json({ error: tenantResult.error }, { status: tenantResult.status });
  }

  const access = await requireApiAnyPermission(
    [PERMISSIONS.REGISTRATIONS_VIEW, PERMISSIONS.REGISTRATIONS_EDIT],
    tenantResult.tenantId,
  );
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";

  try {
    const candidates = await listMentionCandidatesForTenant(tenantSlug, query);
    return NextResponse.json({ candidates });
  } catch (error) {
    console.error("Mention candidate search failed:", error);
    return NextResponse.json(
      { error: "Erwähnungskandidaten konnten nicht geladen werden." },
      { status: 500 },
    );
  }
}
