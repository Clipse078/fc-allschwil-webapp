/**
 * PERSON-UX-05/06: Development assessment management API.
 *
 * GET  /api/people/[id]/assessments  — list assessments for a person (newest first)
 * POST /api/people/[id]/assessments  — create a new DevelopmentAssessment
 *
 * Authorization:
 *   VIEW:   requires people.assessments.view
 *   CREATE: requires people.assessments.manage
 *
 * PERSON-UX-06: Supports configurable rating modes (SCORE_0_100, QUALITATIVE_5,
 * SCORE_1_10, PERCENTAGE). Callers may supply rawValue; the server normalizes
 * to canonical 0–100 and snapshots ratingModeSnapshot, rawValue, rawLabelSnapshot.
 * Existing normalizedScore-only payloads remain supported for backward compatibility.
 *
 * Assessment data is sensitive/internal. Never exposed via public APIs.
 * Server-side authorization is authoritative. Fail closed.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiActiveTenantId } from "@/lib/tenants/active-tenant";
import { logAction } from "@/lib/audit/log-action";
import { getPersonAssessments } from "@/lib/people/queries";
import {
  resolveTenantPerson,
  resolveSeason,
  resolveTeamSeasonContext,
  resolveTenantCriterion,
  isValidScore,
  createAssessment,
  type RatingInput,
} from "@/lib/people/assessment-service";
import {
  RATING_MODES,
  validateRawInput,
  normalizeRating,
  getRawLabel,
  isValidRatingMode,
} from "@/lib/people/rating-modes";

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
  const person = await resolveTenantPerson(id, tenantResult.tenantId);
  if (!person) {
    return NextResponse.json({ error: "Person nicht gefunden." }, { status: 404 });
  }

  const assessments = await getPersonAssessments(id, tenantResult.tenantId);
  return NextResponse.json({ assessments });
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.PEOPLE_ASSESSMENTS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantResult = await requireApiActiveTenantId();
  if (!tenantResult.ok) {
    return NextResponse.json({ error: tenantResult.error }, { status: tenantResult.status });
  }
  const { tenantId } = tenantResult;

  const { id: personId } = await params;
  const person = await resolveTenantPerson(personId, tenantId);
  if (!person) {
    return NextResponse.json({ error: "Person nicht gefunden." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;

  // ── Season ──────────────────────────────────────────────────────────────────
  const seasonIdRaw = String(body.seasonId ?? "").trim();
  if (!seasonIdRaw) {
    return NextResponse.json({ error: "Saison ist erforderlich." }, { status: 400 });
  }
  const season = await resolveSeason(seasonIdRaw);
  if (!season) {
    return NextResponse.json({ error: "Saison nicht gefunden." }, { status: 400 });
  }

  // ── TeamSeason (optional) ────────────────────────────────────────────────────
  let teamSeasonId: string | null = null;
  const teamSeasonIdRaw = String(body.teamSeasonId ?? "").trim() || null;
  if (teamSeasonIdRaw) {
    const ts = await resolveTeamSeasonContext(teamSeasonIdRaw, season.id, tenantId);
    if (!ts) {
      return NextResponse.json(
        { error: "TeamSeason ungültig oder gehört nicht zu dieser Saison/diesem Mandanten." },
        { status: 400 },
      );
    }
    teamSeasonId = ts.id;
  }

  // ── assessedAt ───────────────────────────────────────────────────────────────
  const assessedAtRaw = String(body.assessedAt ?? "").trim();
  if (!assessedAtRaw) {
    return NextResponse.json({ error: "Bewertungsdatum ist erforderlich." }, { status: 400 });
  }
  const assessedAt = new Date(assessedAtRaw);
  if (isNaN(assessedAt.getTime())) {
    return NextResponse.json({ error: "Bewertungsdatum ist ungültig." }, { status: 400 });
  }

  const notes = String(body.notes ?? "").trim() || null;

  // ── Ratings ──────────────────────────────────────────────────────────────────
  const ratingsRaw = Array.isArray(body.ratings) ? body.ratings : [];
  if (ratingsRaw.length === 0) {
    return NextResponse.json({ error: "Mindestens eine Bewertung ist erforderlich." }, { status: 400 });
  }

  const criterionMap = new Map<string, { name: string; category: string | null; ratingMode: string | null }>();
  const validatedRatings: RatingInput[] = [];

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

    const criterion = await resolveTenantCriterion(criterionId, tenantId);
    if (!criterion) {
      return NextResponse.json(
        { error: "Kriterium nicht gefunden oder gehört nicht zu diesem Mandanten." },
        { status: 400 },
      );
    }

    // ── Rating mode resolution ──────────────────────────────────────────────
    // The criterion's current ratingMode is used for validation + normalization.
    // The mode is also snapshotted so future changes don't reinterpret history.
    const criterionRatingMode = isValidRatingMode(criterion.ratingMode)
      ? criterion.ratingMode
      : RATING_MODES.SCORE_0_100;

    let normalizedScore: number;
    let rawValue: number | null = null;
    let rawLabelSnapshot: string | null = null;

    if (rr.rawValue !== undefined && rr.rawValue !== null) {
      // Caller supplied a rawValue — validate and normalize per criterion mode
      const rv = Number(rr.rawValue);
      if (!validateRawInput(criterionRatingMode, rv)) {
        return NextResponse.json(
          {
            error: `rawValue ${rv} ist für Modus ${criterionRatingMode} ungültig.`,
          },
          { status: 400 },
        );
      }
      normalizedScore = normalizeRating(criterionRatingMode, rv);
      rawValue = rv;
      rawLabelSnapshot = getRawLabel(criterionRatingMode, rv, criterion.qualitativeLabels);
    } else {
      // Legacy path: caller supplied normalizedScore directly (SCORE_0_100 semantics)
      const score = Number(rr.normalizedScore);
      if (!isValidScore(score)) {
        return NextResponse.json(
          { error: `Score muss eine ganze Zahl zwischen 0 und 100 sein.` },
          { status: 400 },
        );
      }
      normalizedScore = score;
    }

    criterionMap.set(criterionId, {
      name: criterion.name,
      category: criterion.category ?? null,
      ratingMode: criterionRatingMode,
    });
    validatedRatings.push({
      criterionId,
      normalizedScore,
      rawValue,
      rawLabelSnapshot,
      ratingModeSnapshot: criterionRatingMode,
      comment: String(rr.comment ?? "").trim() || null,
    });
  }

  const assessorUserId = access.session?.user?.id ?? null;

  const assessment = await createAssessment(
    {
      tenantId,
      personId,
      seasonId: season.id,
      teamSeasonId,
      assessedAt,
      assessorUserId,
      notes,
      ratings: validatedRatings,
    },
    criterionMap,
  );

  await logAction({
    actorUserId: assessorUserId,
    moduleKey: "people",
    entityType: "DevelopmentAssessment",
    entityId: assessment.id,
    action: "assessment_created",
    afterJson: {
      personId,
      seasonId: season.id,
      teamSeasonId,
      assessedAt: assessedAt.toISOString(),
      ratingCount: validatedRatings.length,
    },
    metadataJson: { tenantId },
  });

  return NextResponse.json({ assessment }, { status: 201 });
}
