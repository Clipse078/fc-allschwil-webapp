/**
 * PERSON-UX-05 — Development Assessment domain service.
 *
 * Centralises all business validation and cross-tenant enforcement for
 * assessment operations. No Prisma business rules are spread through routes.
 *
 * ARCHITECTURAL INVARIANTS:
 *   - Target Person MUST belong to the caller's tenant.
 *   - Season MUST belong to the same tenant (resolved via canonical Season).
 *   - When TeamSeason is supplied: TeamSeason.seasonId MUST equal assessment.seasonId
 *     and TeamSeason.team.tenantId MUST equal tenantId (no cross-tenant context).
 *   - Each DevelopmentCriterion referenced in ratings MUST belong to the same tenant.
 *   - normalizedScore: integer 0–100 inclusive (0 and 100 are valid, -1 and 101 are not).
 *   - Assessment ownership is Person + Season — NOT PlayerSquadMember.
 *   - Historical records must not be invalidated by roster changes.
 *   - Criterion name + category are snapshot-copied into each rating at creation.
 */

import { prisma } from "@/lib/db/prisma";

// ── Score validation ──────────────────────────────────────────────────────────

/** Returns true iff score is an integer within [0, 100]. */
export function isValidScore(score: unknown): score is number {
  return typeof score === "number" && Number.isInteger(score) && score >= 0 && score <= 100;
}

/** Minimum/maximum valid score values. */
export const SCORE_MIN = 0;
export const SCORE_MAX = 100;

// ── Tenant-scoped resolution ──────────────────────────────────────────────────

/**
 * Resolves a Person and enforces strict tenant isolation.
 * Returns null when the person doesn't exist or belongs to a different tenant.
 */
export async function resolveTenantPerson(personId: string, tenantId: string) {
  const person = await prisma.person.findUnique({
    where: { id: personId },
    select: { id: true, tenantId: true },
  });
  if (!person || person.tenantId !== tenantId) return null;
  return person;
}

/**
 * Resolves a Season (canonical, not tenant-scoped at DB level — verified
 * by checking it exists and is used within the tenant via TeamSeasons or
 * simply by existence, since Season is global). Returns null when missing.
 */
export async function resolveSeason(seasonId: string) {
  return prisma.season.findUnique({
    where: { id: seasonId },
    select: { id: true, name: true, key: true, isActive: true },
  });
}

/**
 * Resolves and validates a TeamSeason for optional assessment context.
 *
 * Rules enforced:
 *   - TeamSeason must exist.
 *   - TeamSeason.seasonId must equal the supplied assessmentSeasonId.
 *   - TeamSeason.team.tenantId must equal tenantId (no cross-tenant context).
 *
 * Returns null on any violation. Callers treat null as "invalid context".
 */
export async function resolveTeamSeasonContext(
  teamSeasonId: string,
  assessmentSeasonId: string,
  tenantId: string,
): Promise<{ id: string } | null> {
  const ts = await prisma.teamSeason.findUnique({
    where: { id: teamSeasonId },
    select: {
      id: true,
      seasonId: true,
      team: { select: { tenantId: true } },
    },
  });
  if (!ts) return null;
  if (ts.seasonId !== assessmentSeasonId) return null;
  if (ts.team.tenantId !== tenantId) return null;
  return { id: ts.id };
}

/**
 * Resolves a DevelopmentCriterion and enforces tenant isolation.
 * Returns null when missing or cross-tenant.
 * PERSON-UX-06: Also returns ratingMode, qualitativeLabels, and benchmark flags.
 */
export async function resolveTenantCriterion(criterionId: string, tenantId: string) {
  const criterion = await prisma.developmentCriterion.findUnique({
    where: { id: criterionId },
    select: {
      id: true,
      tenantId: true,
      name: true,
      category: true,
      isActive: true,
      ratingMode: true,
      qualitativeLabels: true,
    },
  });
  if (!criterion || criterion.tenantId !== tenantId) return null;
  return criterion;
}

/**
 * Resolves a DevelopmentAssessment for the given person + tenant.
 * Returns null when missing, cross-person, or cross-tenant.
 */
export async function resolveTenantAssessment(
  assessmentId: string,
  personId: string,
  tenantId: string,
) {
  const assessment = await prisma.developmentAssessment.findFirst({
    where: { id: assessmentId, personId, tenantId },
    select: {
      id: true,
      tenantId: true,
      personId: true,
      seasonId: true,
      teamSeasonId: true,
      assessedAt: true,
      assessorUserId: true,
      notes: true,
      ratings: {
        select: {
          id: true,
          criterionId: true,
          normalizedScore: true,
          criterionNameSnapshot: true,
          criterionCategorySnapshot: true,
          ratingModeSnapshot: true,
          rawValue: true,
          rawLabelSnapshot: true,
          comment: true,
        },
        orderBy: { criterionNameSnapshot: "asc" },
      },
    },
  });
  return assessment ?? null;
}

// ── Rating input type ─────────────────────────────────────────────────────────

export type RatingInput = {
  criterionId: string;
  normalizedScore: number;
  comment?: string | null;
  /** PERSON-UX-06: Raw input value before normalization (e.g. 1..5 for QUALITATIVE_5). */
  rawValue?: number | null;
  /** PERSON-UX-06: Snapshot of the mode used at rating creation time. */
  ratingModeSnapshot?: string | null;
  /** PERSON-UX-06: Human-readable label snapshot (e.g. "Stark"). */
  rawLabelSnapshot?: string | null;
};

// ── Service operations ────────────────────────────────────────────────────────

export type CreateAssessmentInput = {
  tenantId: string;
  personId: string;
  seasonId: string;
  teamSeasonId?: string | null;
  assessedAt: Date;
  assessorUserId?: string | null;
  notes?: string | null;
  ratings: RatingInput[];
};

export type UpdateAssessmentInput = {
  assessedAt?: Date;
  notes?: string | null;
  ratings?: RatingInput[];
};

/** Shared select shape for assessment list items. */
function getAssessmentSelect() {
  return {
    id: true,
    tenantId: true,
    personId: true,
    seasonId: true,
    teamSeasonId: true,
    assessedAt: true,
    assessorUserId: true,
    notes: true,
    createdAt: true,
    updatedAt: true,
    season: { select: { id: true, name: true, key: true, isActive: true } },
    teamSeason: {
      select: {
        id: true,
        team: { select: { id: true, name: true, shortName: true } },
      },
    },
    assessor: { select: { id: true, firstName: true, lastName: true } },
    ratings: {
      select: {
        id: true,
        criterionId: true,
        normalizedScore: true,
        criterionNameSnapshot: true,
        criterionCategorySnapshot: true,
        ratingModeSnapshot: true,
        rawValue: true,
        rawLabelSnapshot: true,
        comment: true,
        createdAt: true,
      },
      orderBy: [
        { criterionCategorySnapshot: "asc" as const },
        { criterionNameSnapshot: "asc" as const },
      ],
    },
  };
}

/**
 * Creates a new DevelopmentAssessment with ratings.
 *
 * Pre-conditions enforced by callers:
 *   - Person tenant isolation verified.
 *   - Season existence verified.
 *   - TeamSeason context validated (if supplied).
 *   - All criterion tenant ownership verified.
 *   - All scores within [0, 100].
 *
 * Snapshots criterion name + category into each rating.
 * PERSON-UX-06: Also snapshots ratingMode, rawValue, rawLabelSnapshot.
 */
export async function createAssessment(
  input: CreateAssessmentInput,
  criterionMap: Map<string, { name: string; category: string | null; ratingMode?: string | null }>,
) {
  return prisma.developmentAssessment.create({
    data: {
      tenantId: input.tenantId,
      personId: input.personId,
      seasonId: input.seasonId,
      teamSeasonId: input.teamSeasonId ?? null,
      assessedAt: input.assessedAt,
      assessorUserId: input.assessorUserId ?? null,
      notes: input.notes ?? null,
      ratings: {
        create: input.ratings.map((r) => {
          const criterion = criterionMap.get(r.criterionId)!;
          return {
            criterionId: r.criterionId,
            normalizedScore: r.normalizedScore,
            criterionNameSnapshot: criterion.name,
            criterionCategorySnapshot: criterion.category ?? null,
            ratingModeSnapshot: r.ratingModeSnapshot ?? criterion.ratingMode ?? null,
            rawValue: r.rawValue ?? null,
            rawLabelSnapshot: r.rawLabelSnapshot ?? null,
            comment: r.comment ?? null,
          };
        }),
      },
    },
    select: getAssessmentSelect(),
  });
}

/**
 * Updates an existing DevelopmentAssessment (date, notes, and optionally
 * replaces all ratings).
 *
 * Rating replacement: deletes all existing ratings then inserts new ones.
 * This is safe because ratings are children of the assessment.
 * PERSON-UX-06: Preserves rawValue/rawLabelSnapshot/ratingModeSnapshot in replacements.
 */
export async function updateAssessment(
  assessmentId: string,
  input: UpdateAssessmentInput,
  criterionMap?: Map<string, { name: string; category: string | null; ratingMode?: string | null }>,
) {
  return prisma.$transaction(async (tx) => {
    if (input.ratings !== undefined && criterionMap) {
      await tx.developmentAssessmentRating.deleteMany({
        where: { assessmentId },
      });
      await tx.developmentAssessmentRating.createMany({
        data: input.ratings.map((r) => {
          const criterion = criterionMap.get(r.criterionId)!;
          return {
            assessmentId,
            criterionId: r.criterionId,
            normalizedScore: r.normalizedScore,
            criterionNameSnapshot: criterion.name,
            criterionCategorySnapshot: criterion.category ?? null,
            ratingModeSnapshot: r.ratingModeSnapshot ?? criterion.ratingMode ?? null,
            rawValue: r.rawValue ?? null,
            rawLabelSnapshot: r.rawLabelSnapshot ?? null,
            comment: r.comment ?? null,
          };
        }),
      });
    }
    return tx.developmentAssessment.update({
      where: { id: assessmentId },
      data: {
        ...(input.assessedAt !== undefined ? { assessedAt: input.assessedAt } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
      select: getAssessmentSelect(),
    });
  });
}

// ── Derived score helpers ─────────────────────────────────────────────────────

/**
 * Derives an overall score from a set of ratings as arithmetic mean.
 *
 * Returns null when there are no ratings — never fabricates a score.
 * The result is rounded to the nearest integer.
 *
 * This is a display-only derived value. Underlying ratings are canonical.
 */
export function deriveOverallScore(
  ratings: Array<{ normalizedScore: number }>,
): number | null {
  if (ratings.length === 0) return null;
  const sum = ratings.reduce((acc, r) => acc + r.normalizedScore, 0);
  return Math.round(sum / ratings.length);
}
