/**
 * PERSON-UX-06: Benchmark data for an assessment.
 *
 * GET /api/people/[id]/assessments/[assessmentId]/benchmarks
 *
 * Returns Team and/or Jahrgang benchmark aggregates for each criterion
 * in the assessment that has benchmarks enabled.
 *
 * Authorization:
 *   Requires people.assessments.view.
 *
 * Response shape:
 * {
 *   benchmarks: {
 *     [criterionId]: {
 *       team?: { average: number; cohortSize: number } | null,
 *       jahrgang?: { average: number; cohortSize: number; birthYear: number } | null,
 *     }
 *   }
 * }
 *
 * Privacy:
 *   Cohorts below BENCHMARK_MIN_COHORT_SIZE (5) return null.
 *   Individual peer scores are never exposed.
 *   No rankings, no identifiers.
 *
 * Non-goals:
 *   Does not expose who is in the benchmark cohort.
 *   Does not return leaderboard data.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiActiveTenantId } from "@/lib/tenants/active-tenant";
import {
  resolveTenantPerson,
  resolveTenantAssessment,
} from "@/lib/people/assessment-service";
import { getTeamBenchmark, getJahrgangBenchmark } from "@/lib/people/benchmark-service";
import { prisma } from "@/lib/db/prisma";

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
  const { tenantId } = tenantResult;

  const { id: personId, assessmentId } = await params;

  const person = await resolveTenantPerson(personId, tenantId);
  if (!person) {
    return NextResponse.json({ error: "Person nicht gefunden." }, { status: 404 });
  }

  const assessment = await resolveTenantAssessment(assessmentId, personId, tenantId);
  if (!assessment) {
    return NextResponse.json({ error: "Bewertung nicht gefunden." }, { status: 404 });
  }

  // Resolve criteria for this assessment to check benchmark settings
  const criterionIds = assessment.ratings.map((r) => r.criterionId);
  const criteria = await prisma.developmentCriterion.findMany({
    where: { id: { in: criterionIds }, tenantId },
    select: {
      id: true,
      showTeamBenchmark: true,
      showJahrgangBenchmark: true,
    },
  });

  const criterionSettings = new Map(criteria.map((c) => [c.id, c]));

  // Compute benchmarks per criterion (only where enabled)
  const benchmarks: Record<
    string,
    {
      team?: { average: number; cohortSize: number } | null;
      jahrgang?: { average: number; cohortSize: number; birthYear: number } | null;
    }
  > = {};

  await Promise.all(
    assessment.ratings.map(async (r) => {
      const settings = criterionSettings.get(r.criterionId);
      if (!settings) return;

      const entry: (typeof benchmarks)[string] = {};
      let includeEntry = false;

      if (settings.showTeamBenchmark && assessment.teamSeasonId) {
        includeEntry = true;
        entry.team = await getTeamBenchmark(tenantId, assessment.teamSeasonId, r.criterionId);
      }

      if (settings.showJahrgangBenchmark) {
        includeEntry = true;
        entry.jahrgang = await getJahrgangBenchmark(tenantId, personId, r.criterionId);
      }

      if (includeEntry) {
        benchmarks[r.criterionId] = entry;
      }
    }),
  );

  return NextResponse.json({ benchmarks });
}
