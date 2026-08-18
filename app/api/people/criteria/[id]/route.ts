/**
 * PERSON-UX-06: Single criterion management API.
 *
 * GET   /api/people/criteria/[id]  — get a criterion
 * PATCH /api/people/criteria/[id]  — update fields (name, description, category,
 *                                    sortOrder, ratingMode, qualitativeLabels,
 *                                    showTeamBenchmark, showJahrgangBenchmark,
 *                                    isActive)
 *
 * Authorization:
 *   GET:   requires people.assessments.view
 *   PATCH: requires people.assessments.manage
 *
 * Tenant isolation is enforced at the service layer.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiActiveTenantId } from "@/lib/tenants/active-tenant";
import { prisma } from "@/lib/db/prisma";
import { updateCriterion, setCriterionActive, reorderCriteria } from "@/lib/people/criterion-service";
import { isValidRatingMode } from "@/lib/people/rating-modes";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.PEOPLE_ASSESSMENTS_VIEW);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const tenantResult = await requireApiActiveTenantId();
  if (!tenantResult.ok) {
    return NextResponse.json({ error: tenantResult.error }, { status: tenantResult.status });
  }
  const { id } = await params;

  const criterion = await prisma.developmentCriterion.findUnique({
    where: { id },
  });
  if (!criterion || criterion.tenantId !== tenantResult.tenantId) {
    return NextResponse.json({ error: "Kriterium nicht gefunden." }, { status: 404 });
  }
  return NextResponse.json({ criterion });
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.PEOPLE_ASSESSMENTS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const tenantResult = await requireApiActiveTenantId();
  if (!tenantResult.ok) {
    return NextResponse.json({ error: tenantResult.error }, { status: tenantResult.status });
  }
  const { tenantId } = tenantResult;
  const { id } = await params;
  const actorUserId = access.session?.user?.id ?? null;

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;

  // Handle isActive toggle separately for clean audit actions
  if (Object.prototype.hasOwnProperty.call(body, "isActive") && Object.keys(body).length === 1) {
    const isActive = body.isActive === true;
    const updated = await setCriterionActive(id, tenantId, isActive, actorUserId);
    if (!updated) {
      return NextResponse.json({ error: "Kriterium nicht gefunden." }, { status: 404 });
    }
    return NextResponse.json({ criterion: updated });
  }

  // Handle reorder-only request
  if (Object.prototype.hasOwnProperty.call(body, "reorder") && Array.isArray(body.reorder)) {
    const entries = (body.reorder as Array<{ id: string; sortOrder: number }>).filter(
      (e) => typeof e.id === "string" && typeof e.sortOrder === "number",
    );
    await reorderCriteria({ tenantId, entries, actorUserId });
    return NextResponse.json({ ok: true });
  }

  // General update
  const ratingModeRaw = body.ratingMode !== undefined ? String(body.ratingMode) : undefined;
  if (ratingModeRaw !== undefined && !isValidRatingMode(ratingModeRaw)) {
    return NextResponse.json(
      { error: `Ungültiger Bewertungsmodus: ${ratingModeRaw}` },
      { status: 400 },
    );
  }

  const qualitativeLabels = Object.prototype.hasOwnProperty.call(body, "qualitativeLabels")
    ? body.qualitativeLabels
    : undefined;

  if (qualitativeLabels !== undefined && qualitativeLabels !== null) {
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
    const updated = await updateCriterion({
      tenantId,
      criterionId: id,
      ...(body.name !== undefined ? { name: String(body.name) } : {}),
      ...(Object.prototype.hasOwnProperty.call(body, "description")
        ? { description: typeof body.description === "string" ? body.description : null }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(body, "category")
        ? { category: typeof body.category === "string" ? body.category : null }
        : {}),
      ...(body.sortOrder !== undefined ? { sortOrder: Number(body.sortOrder) } : {}),
      ...(ratingModeRaw !== undefined ? { ratingMode: ratingModeRaw as import("@/lib/people/rating-modes").RatingMode } : {}),
      ...(qualitativeLabels !== undefined
        ? { qualitativeLabels: qualitativeLabels as string[] | null }
        : {}),
      ...(body.showTeamBenchmark !== undefined
        ? { showTeamBenchmark: body.showTeamBenchmark === true }
        : {}),
      ...(body.showJahrgangBenchmark !== undefined
        ? { showJahrgangBenchmark: body.showJahrgangBenchmark === true }
        : {}),
      actorUserId,
    });
    if (!updated) {
      return NextResponse.json({ error: "Kriterium nicht gefunden." }, { status: 404 });
    }
    // Handle isActive when combined with other fields
    if (Object.prototype.hasOwnProperty.call(body, "isActive")) {
      const isActive = body.isActive === true;
      await setCriterionActive(id, tenantId, isActive, actorUserId);
    }
    return NextResponse.json({ criterion: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
