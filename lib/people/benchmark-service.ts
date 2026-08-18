/**
 * PERSON-UX-06 — Team and Jahrgang benchmark computation.
 *
 * Benchmarks are DERIVED — never persisted into assessment rows.
 * Every call reads current canonical assessment data and returns the
 * live aggregate. This avoids stale benchmark data as new assessments arrive.
 *
 * ── Team benchmark ─────────────────────────────────────────────────────────
 * Compares a person's normalized score for a criterion against the average of
 * other persons in the same TeamSeason.
 *
 * Rules:
 *   - Same tenant only (strict).
 *   - Same TeamSeason (teamSeasonId).
 *   - Same criterion (criterionId).
 *   - Latest valid assessment per Person (one assessment per person).
 *   - Each Person counts at most once.
 *   - Subject person's OLDER assessments excluded; only latest matters.
 *   - Requires minimum BENCHMARK_MIN_COHORT_SIZE distinct persons.
 *   - Result: { average: number; cohortSize: number } | null.
 *
 * ── Jahrgang benchmark ─────────────────────────────────────────────────────
 * Compares a person's score against same-birth-year cohort within the tenant.
 *
 * Rules:
 *   - Same tenant only.
 *   - Birth year derived from Person.dateOfBirth (year component).
 *   - Missing dateOfBirth → no Jahrgang benchmark.
 *   - Latest valid assessment per Person.
 *   - Each Person counts at most once.
 *   - Requires minimum BENCHMARK_MIN_COHORT_SIZE distinct persons.
 *   - Result: { average: number; cohortSize: number; birthYear: number } | null.
 *
 * ── Privacy threshold ──────────────────────────────────────────────────────
 * BENCHMARK_MIN_COHORT_SIZE = 5 (privacy-first default).
 * When fewer than 5 distinct persons contribute, the benchmark is absent.
 * The response never reveals individual scores, identities, or rankings.
 *
 * ── Non-exposure guarantee ─────────────────────────────────────────────────
 * Functions return only aggregate (average + cohortSize).
 * Individual peer scores are never surfaced.
 */

import { prisma } from "@/lib/db/prisma";

/** Minimum number of distinct persons required before a benchmark is shown. */
export const BENCHMARK_MIN_COHORT_SIZE = 5;

// ── Internal helper ───────────────────────────────────────────────────────

/**
 * Given a set of (personId, normalizedScore) rows — already ordered by
 * assessedAt DESC — picks the LATEST score per distinct personId,
 * then computes the cohort average.
 *
 * Returns null when fewer than minCohort distinct persons are found.
 */
function aggregateLatestPerPerson(
  rows: Array<{ personId: string; normalizedScore: number }>,
  minCohort: number,
): { average: number; cohortSize: number } | null {
  const seenPersons = new Map<string, number>(); // personId → normalizedScore (first = latest)
  for (const row of rows) {
    if (!seenPersons.has(row.personId)) {
      seenPersons.set(row.personId, row.normalizedScore);
    }
  }
  if (seenPersons.size < minCohort) return null;
  const scores = Array.from(seenPersons.values());
  const average = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  return { average, cohortSize: seenPersons.size };
}

// ── Team benchmark ────────────────────────────────────────────────────────

export type TeamBenchmarkResult = {
  average: number;
  cohortSize: number;
} | null;

/**
 * Computes the Team benchmark for a criterion within a TeamSeason.
 *
 * @param tenantId    Caller's tenant — enforces strict isolation.
 * @param teamSeasonId The TeamSeason context of the assessment.
 * @param criterionId  The criterion to benchmark.
 * @param minCohort   Minimum persons required (default: BENCHMARK_MIN_COHORT_SIZE).
 */
export async function getTeamBenchmark(
  tenantId: string,
  teamSeasonId: string,
  criterionId: string,
  minCohort = BENCHMARK_MIN_COHORT_SIZE,
): Promise<TeamBenchmarkResult> {
  // Verify TeamSeason belongs to this tenant
  const teamSeason = await prisma.teamSeason.findUnique({
    where: { id: teamSeasonId },
    select: { team: { select: { tenantId: true } } },
  });
  if (!teamSeason || teamSeason.team.tenantId !== tenantId) return null;

  // Fetch all ratings for this criterion + teamSeason, newest first
  const rows = await prisma.developmentAssessmentRating.findMany({
    where: {
      criterionId,
      assessment: {
        tenantId,
        teamSeasonId,
      },
    },
    select: {
      normalizedScore: true,
      assessment: { select: { personId: true, assessedAt: true } },
    },
    orderBy: { assessment: { assessedAt: "desc" } },
  });

  const flat = rows.map((r) => ({
    personId: r.assessment.personId,
    normalizedScore: r.normalizedScore,
  }));

  return aggregateLatestPerPerson(flat, minCohort);
}

// ── Jahrgang benchmark ────────────────────────────────────────────────────

export type JahrgangBenchmarkResult = {
  average: number;
  cohortSize: number;
  birthYear: number;
} | null;

/**
 * Computes the Jahrgang (birth-year cohort) benchmark for a criterion.
 *
 * @param tenantId   Caller's tenant — strict isolation, never cross-tenant.
 * @param personId   Subject person — used to resolve birth year.
 * @param criterionId Criterion to benchmark.
 * @param minCohort  Minimum persons required (default: BENCHMARK_MIN_COHORT_SIZE).
 */
export async function getJahrgangBenchmark(
  tenantId: string,
  personId: string,
  criterionId: string,
  minCohort = BENCHMARK_MIN_COHORT_SIZE,
): Promise<JahrgangBenchmarkResult> {
  // Resolve subject person and birth year
  const person = await prisma.person.findUnique({
    where: { id: personId },
    select: { tenantId: true, dateOfBirth: true },
  });
  if (!person || person.tenantId !== tenantId) return null;
  if (!person.dateOfBirth) return null; // missing birth date → no Jahrgang benchmark

  const birthYear = new Date(person.dateOfBirth).getFullYear();

  // Fetch all ratings in this tenant for this criterion, where the person
  // has a known birth year matching the subject's birth year.
  // Join: assessment → person (filtered by tenantId + birth year range).
  const startOfYear = new Date(birthYear, 0, 1);
  const endOfYear = new Date(birthYear + 1, 0, 1);

  const rows = await prisma.developmentAssessmentRating.findMany({
    where: {
      criterionId,
      assessment: {
        tenantId,
        person: {
          dateOfBirth: {
            gte: startOfYear,
            lt: endOfYear,
          },
        },
      },
    },
    select: {
      normalizedScore: true,
      assessment: { select: { personId: true, assessedAt: true } },
    },
    orderBy: { assessment: { assessedAt: "desc" } },
  });

  const flat = rows.map((r) => ({
    personId: r.assessment.personId,
    normalizedScore: r.normalizedScore,
  }));

  const agg = aggregateLatestPerPerson(flat, minCohort);
  if (!agg) return null;

  return { ...agg, birthYear };
}
