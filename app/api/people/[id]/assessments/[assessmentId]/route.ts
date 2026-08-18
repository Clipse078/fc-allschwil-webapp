/**
 * PERSON-UX-05: Individual assessment management API.
 *
 * GET   /api/people/[id]/assessments/[assessmentId]  — fetch one assessment
 * PATCH /api/people/[id]/assessments/[assessmentId]  — update an assessment
 *
 * Authorization:
 *   VIEW:   requires people.assessments.view
 *   UPDATE: requires people.assessments.manage
 *
 * Audit: assessment_updated logged on PATCH.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiActiveTenantId } from "@/lib/tenants/active-tenant";
import { logAction } from "@/lib/audit/log-action";
import {
  resolveTenantPerson,
  resolveTenantAssessment,
  resolveTenantCriterion,
  isValidScore,
  updateAssessment,
  type RatingInput,
} from "@/lib/people/assessment-service";

type RouteContext = { params: Promise<{ id: string; assessmentId: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.PEOPLE_ASSESSMENTS_VIEW);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantResult = await requireApiActiveTenantId();
  if (!tenantResult.ok) {
    return NextResponse.json({ error: tenantResult.error }, { status: tenantResult.status });
  }

  const { id, assessmentId } = await params;
  const person = await resolveTenantPerson(id, tenantResult.tenantId);
  if (!person) {
    return NextResponse.json({ error: "Person nicht gefunden." }, { status: 404 });
  }

  const assessment = await resolveTenantAssessment(assessmentId, id, tenantResult.tenantId);
  if (!assessment) {
    return NextResponse.json({ error: "Bewertung nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ assessment });
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

  const { id: personId, assessmentId } = await params;
  const person = await resolveTenantPerson(personId, tenantId);
  if (!person) {
    return NextResponse.json({ error: "Person nicht gefunden." }, { status: 404 });
  }

  const existing = await resolveTenantAssessment(assessmentId, personId, tenantId);
  if (!existing) {
    return NextResponse.json({ error: "Bewertung nicht gefunden." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;

  let assessedAt: Date | undefined;
  if (body.assessedAt !== undefined) {
    const raw = String(body.assessedAt ?? "").trim();
    if (!raw) {
      return NextResponse.json({ error: "Bewertungsdatum darf nicht leer sein." }, { status: 400 });
    }
    const parsed = new Date(raw);
    if (isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "Bewertungsdatum ist ungültig." }, { status: 400 });
    }
    assessedAt = parsed;
  }

  const notes = body.notes !== undefined ? (String(body.notes ?? "").trim() || null) : undefined;

  let validatedRatings: RatingInput[] | undefined;
  const criterionMap = new Map<string, { name: string; category: string | null }>();

  if (Array.isArray(body.ratings)) {
    validatedRatings = [];
    const ratingsRaw = body.ratings;
    if (ratingsRaw.length === 0) {
      return NextResponse.json({ error: "Mindestens eine Bewertung ist erforderlich." }, { status: 400 });
    }
    for (const r of ratingsRaw) {
      if (!r || typeof r !== "object") {
        return NextResponse.json({ error: "Ungültiges Bewertungsformat." }, { status: 400 });
      }
      const rr = r as Record<string, unknown>;
      const criterionId = String(rr.criterionId ?? "").trim();
      if (!criterionId) {
        return NextResponse.json({ error: "Kriterium-ID fehlt." }, { status: 400 });
      }
      if (criterionMap.has(criterionId)) {
        return NextResponse.json(
          { error: `Kriterium ${criterionId} erscheint mehrfach.` },
          { status: 400 },
        );
      }
      const score = Number(rr.normalizedScore);
      if (!isValidScore(score)) {
        return NextResponse.json(
          { error: "Score muss eine ganze Zahl zwischen 0 und 100 sein." },
          { status: 400 },
        );
      }
      const criterion = await resolveTenantCriterion(criterionId, tenantId);
      if (!criterion) {
        return NextResponse.json(
          { error: "Kriterium nicht gefunden oder gehört nicht zu diesem Mandanten." },
          { status: 400 },
        );
      }
      criterionMap.set(criterionId, { name: criterion.name, category: criterion.category ?? null });
      validatedRatings.push({
        criterionId,
        normalizedScore: score,
        comment: String(rr.comment ?? "").trim() || null,
      });
    }
  }

  const actorUserId = access.session?.user?.id ?? null;

  const updated = await updateAssessment(
    assessmentId,
    { assessedAt, notes, ratings: validatedRatings },
    validatedRatings !== undefined ? criterionMap : undefined,
  );

  await logAction({
    actorUserId,
    moduleKey: "people",
    entityType: "DevelopmentAssessment",
    entityId: assessmentId,
    action: "assessment_updated",
    beforeJson: {
      assessedAt: existing.assessedAt,
      notes: existing.notes,
    },
    afterJson: {
      assessedAt: updated.assessedAt,
      notes: updated.notes,
      ratingCount: validatedRatings?.length ?? null,
    },
    metadataJson: { tenantId, personId },
  });

  return NextResponse.json({ assessment: updated });
}
