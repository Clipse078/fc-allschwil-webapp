/**
 * PERSON-UX-06: Development criterion management API.
 *
 * GET  /api/people/criteria  — list all criteria for the tenant (active + inactive)
 * POST /api/people/criteria  — create a new DevelopmentCriterion
 *
 * Authorization:
 *   GET:  requires people.assessments.view (criteria names are non-sensitive)
 *   POST: requires people.assessments.manage
 *
 * Criteria are tenant-scoped. Cross-tenant access is structurally impossible.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiActiveTenantId } from "@/lib/tenants/active-tenant";
import { getTenantAllCriteria } from "@/lib/people/queries";
import { createCriterion } from "@/lib/people/criterion-service";
import { isValidRatingMode } from "@/lib/people/rating-modes";

export async function GET() {
  const access = await requireApiPermission(PERMISSIONS.PEOPLE_ASSESSMENTS_VIEW);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const tenantResult = await requireApiActiveTenantId();
  if (!tenantResult.ok) {
    return NextResponse.json({ error: tenantResult.error }, { status: tenantResult.status });
  }

  const criteria = await getTenantAllCriteria(tenantResult.tenantId);
  return NextResponse.json({ criteria });
}

export async function POST(request: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.PEOPLE_ASSESSMENTS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const tenantResult = await requireApiActiveTenantId();
  if (!tenantResult.ok) {
    return NextResponse.json({ error: tenantResult.error }, { status: tenantResult.status });
  }
  const { tenantId } = tenantResult;

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;

  const nameRaw = String(body.name ?? "").trim();
  if (!nameRaw) {
    return NextResponse.json({ error: "Name ist erforderlich." }, { status: 400 });
  }

  const ratingModeRaw = String(body.ratingMode ?? "SCORE_0_100");
  if (!isValidRatingMode(ratingModeRaw)) {
    return NextResponse.json(
      { error: `Ungültiger Bewertungsmodus: ${ratingModeRaw}` },
      { status: 400 },
    );
  }

  const qualitativeLabels = body.qualitativeLabels ?? null;
  if (qualitativeLabels !== null) {
    if (
      !Array.isArray(qualitativeLabels) ||
      qualitativeLabels.length !== 5 ||
      !qualitativeLabels.every((l) => typeof l === "string" && l.trim().length > 0)
    ) {
      return NextResponse.json(
        { error: "qualitativeLabels muss ein Array von genau 5 nicht-leeren Zeichenketten sein." },
        { status: 400 },
      );
    }
  }

  try {
    const criterion = await createCriterion({
      tenantId,
      name: nameRaw,
      description: typeof body.description === "string" ? body.description : null,
      category: typeof body.category === "string" ? body.category : null,
      sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : 0,
      ratingMode: ratingModeRaw,
      qualitativeLabels: Array.isArray(qualitativeLabels)
        ? (qualitativeLabels as string[])
        : null,
      showTeamBenchmark: body.showTeamBenchmark === true,
      showJahrgangBenchmark: body.showJahrgangBenchmark === true,
      actorUserId: access.session?.user?.id ?? null,
    });
    return NextResponse.json({ criterion }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
