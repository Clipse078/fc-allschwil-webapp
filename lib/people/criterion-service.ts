/**
 * PERSON-UX-06 — DevelopmentCriterion management service.
 *
 * Centralises all create/update/reorder/activate/deactivate operations for
 * tenant-owned criteria. All mutations emit AuditLog entries.
 *
 * Authorization note:
 *   All public functions MUST be called from routes/actions that have already
 *   verified people.assessments.manage. This service does not re-check
 *   permissions — it trusts the caller.
 *
 * Tenant isolation:
 *   Every mutation verifies that the criterion (when resolved by id) belongs
 *   to the caller's tenantId before operating. Cross-tenant mutations are
 *   silently rejected (returns null / throws CriterionNotFoundError).
 *
 * Historical safety:
 *   Deactivating or updating a criterion never touches historical
 *   DevelopmentAssessmentRating rows. Those rows carry immutable snapshots.
 */

import { prisma } from "@/lib/db/prisma";
import { logAction } from "@/lib/audit/log-action";
import { isValidRatingMode, type RatingMode } from "@/lib/people/rating-modes";

const AUDIT_MODULE = "people";
const ENTITY_TYPE = "DevelopmentCriterion";

// ── Input types ───────────────────────────────────────────────────────────

export type CreateCriterionInput = {
  tenantId: string;
  name: string;
  description?: string | null;
  category?: string | null;
  sortOrder?: number;
  ratingMode?: RatingMode;
  qualitativeLabels?: string[] | null;
  showTeamBenchmark?: boolean;
  showJahrgangBenchmark?: boolean;
  actorUserId?: string | null;
};

export type UpdateCriterionInput = {
  tenantId: string;
  criterionId: string;
  name?: string;
  description?: string | null;
  category?: string | null;
  sortOrder?: number;
  ratingMode?: RatingMode;
  qualitativeLabels?: string[] | null;
  showTeamBenchmark?: boolean;
  showJahrgangBenchmark?: boolean;
  actorUserId?: string | null;
};

export type ReorderEntry = { id: string; sortOrder: number };

export type ReorderCriteriaInput = {
  tenantId: string;
  entries: ReorderEntry[];
  actorUserId?: string | null;
};

// ── Validation helpers ────────────────────────────────────────────────────

/** Returns a trimmed, non-empty name or throws. */
function requireTrimmedName(raw: unknown): string {
  if (typeof raw !== "string") throw new Error("Kriterienname muss eine Zeichenkette sein.");
  const trimmed = raw.trim();
  if (trimmed.length === 0) throw new Error("Kriterienname darf nicht leer sein.");
  return trimmed;
}

/** Validates qualitativeLabels: must be null or an array of 5 non-empty strings. */
function validateQualitativeLabels(labels: unknown): string[] | null {
  if (labels === null || labels === undefined) return null;
  if (
    !Array.isArray(labels) ||
    labels.length !== 5 ||
    !labels.every((l) => typeof l === "string" && l.trim().length > 0)
  ) {
    throw new Error("qualitativeLabels muss entweder null oder ein Array von genau 5 nicht-leeren Zeichenketten sein.");
  }
  return labels.map((l: string) => l.trim());
}

// ── Tenant-scoped resolver ────────────────────────────────────────────────

async function requireTenantCriterion(criterionId: string, tenantId: string) {
  const criterion = await prisma.developmentCriterion.findUnique({
    where: { id: criterionId },
  });
  if (!criterion || criterion.tenantId !== tenantId) return null;
  return criterion;
}

// ── Create ────────────────────────────────────────────────────────────────

export async function createCriterion(input: CreateCriterionInput) {
  const name = requireTrimmedName(input.name);
  const ratingMode = input.ratingMode ?? "SCORE_0_100";
  if (!isValidRatingMode(ratingMode)) {
    throw new Error(`Ungültiger Bewertungsmodus: ${ratingMode}`);
  }
  const qualitativeLabels = validateQualitativeLabels(input.qualitativeLabels ?? null);

  const criterion = await prisma.developmentCriterion.create({
    data: {
      tenantId: input.tenantId,
      name,
      description: input.description?.trim() || null,
      category: input.category?.trim() || null,
      sortOrder: input.sortOrder ?? 0,
      ratingMode,
      qualitativeLabels: qualitativeLabels ?? undefined,
      showTeamBenchmark: input.showTeamBenchmark ?? false,
      showJahrgangBenchmark: input.showJahrgangBenchmark ?? false,
      isActive: true,
    },
  });

  await logAction({
    actorUserId: input.actorUserId ?? null,
    moduleKey: AUDIT_MODULE,
    entityType: ENTITY_TYPE,
    entityId: criterion.id,
    action: "criterion_created",
    afterJson: {
      tenantId: input.tenantId,
      name: criterion.name,
      ratingMode: criterion.ratingMode,
      showTeamBenchmark: criterion.showTeamBenchmark,
      showJahrgangBenchmark: criterion.showJahrgangBenchmark,
    },
  });

  return criterion;
}

// ── Update ────────────────────────────────────────────────────────────────

export async function updateCriterion(input: UpdateCriterionInput) {
  const existing = await requireTenantCriterion(input.criterionId, input.tenantId);
  if (!existing) return null;

  const name = input.name !== undefined ? requireTrimmedName(input.name) : undefined;
  const ratingMode = input.ratingMode;
  if (ratingMode !== undefined && !isValidRatingMode(ratingMode)) {
    throw new Error(`Ungültiger Bewertungsmodus: ${ratingMode}`);
  }

  let qualitativeLabels: string[] | null | undefined = undefined;
  if (Object.prototype.hasOwnProperty.call(input, "qualitativeLabels")) {
    qualitativeLabels = validateQualitativeLabels(input.qualitativeLabels ?? null);
  }

  const before = {
    name: existing.name,
    description: existing.description,
    category: existing.category,
    sortOrder: existing.sortOrder,
    ratingMode: existing.ratingMode,
    showTeamBenchmark: existing.showTeamBenchmark,
    showJahrgangBenchmark: existing.showJahrgangBenchmark,
  };

  const updated = await prisma.developmentCriterion.update({
    where: { id: input.criterionId },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(Object.prototype.hasOwnProperty.call(input, "description")
        ? { description: input.description?.trim() || null }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(input, "category")
        ? { category: input.category?.trim() || null }
        : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(ratingMode !== undefined ? { ratingMode } : {}),
      ...(qualitativeLabels !== undefined
        ? { qualitativeLabels: qualitativeLabels ?? undefined }
        : {}),
      ...(input.showTeamBenchmark !== undefined
        ? { showTeamBenchmark: input.showTeamBenchmark }
        : {}),
      ...(input.showJahrgangBenchmark !== undefined
        ? { showJahrgangBenchmark: input.showJahrgangBenchmark }
        : {}),
    },
  });

  await logAction({
    actorUserId: input.actorUserId ?? null,
    moduleKey: AUDIT_MODULE,
    entityType: ENTITY_TYPE,
    entityId: input.criterionId,
    action: "criterion_updated",
    beforeJson: before,
    afterJson: {
      name: updated.name,
      description: updated.description,
      category: updated.category,
      sortOrder: updated.sortOrder,
      ratingMode: updated.ratingMode,
      showTeamBenchmark: updated.showTeamBenchmark,
      showJahrgangBenchmark: updated.showJahrgangBenchmark,
    },
  });

  return updated;
}

// ── Activate / Deactivate ─────────────────────────────────────────────────

export async function setCriterionActive(
  criterionId: string,
  tenantId: string,
  isActive: boolean,
  actorUserId?: string | null,
) {
  const existing = await requireTenantCriterion(criterionId, tenantId);
  if (!existing) return null;

  if (existing.isActive === isActive) return existing; // idempotent

  const updated = await prisma.developmentCriterion.update({
    where: { id: criterionId },
    data: { isActive },
  });

  await logAction({
    actorUserId: actorUserId ?? null,
    moduleKey: AUDIT_MODULE,
    entityType: ENTITY_TYPE,
    entityId: criterionId,
    action: isActive ? "criterion_activated" : "criterion_deactivated",
    beforeJson: { isActive: existing.isActive },
    afterJson: { isActive },
  });

  return updated;
}

// ── Reorder ───────────────────────────────────────────────────────────────

/**
 * Atomically updates sortOrder for a batch of criteria.
 * All entries must belong to the same tenant (cross-tenant entries silently skipped).
 */
export async function reorderCriteria(input: ReorderCriteriaInput) {
  if (input.entries.length === 0) return;

  // Fetch all targeted criteria and verify tenant
  const ids = input.entries.map((e) => e.id);
  const existing = await prisma.developmentCriterion.findMany({
    where: { id: { in: ids }, tenantId: input.tenantId },
    select: { id: true, sortOrder: true },
  });

  const validIds = new Set(existing.map((c) => c.id));
  const validEntries = input.entries.filter((e) => validIds.has(e.id));

  if (validEntries.length === 0) return;

  await prisma.$transaction(
    validEntries.map((e) =>
      prisma.developmentCriterion.update({
        where: { id: e.id },
        data: { sortOrder: e.sortOrder },
      }),
    ),
  );

  await logAction({
    actorUserId: input.actorUserId ?? null,
    moduleKey: AUDIT_MODULE,
    entityType: ENTITY_TYPE,
    entityId: "batch",
    action: "criterion_reordered",
    afterJson: { tenantId: input.tenantId, count: validEntries.length, entries: validEntries },
  });
}
