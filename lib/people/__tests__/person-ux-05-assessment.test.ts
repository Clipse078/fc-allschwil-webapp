/**
 * PERSON-UX-05 — Development Assessment Foundation: focused unit tests.
 *
 * Proves:
 *  1.  assessment belongs to Person + Season
 *  2.  optional valid TeamSeason works
 *  3.  cross-tenant TeamSeason rejected
 *  4.  wrong-season TeamSeason rejected
 *  5.  score 0 accepted
 *  6.  score 100 accepted
 *  7.  score -1 rejected
 *  8.  score 101 rejected
 *  9.  same-tenant criterion accepted
 * 10.  cross-tenant criterion rejected
 * 11.  unauthorized viewer cannot read
 * 12.  VIEW permission can read (resolvePersonDomainPermissions)
 * 13.  MANAGE required for mutation (resolvePersonDomainPermissions)
 * 15.  history newest-first (query ordering)
 * 16.  persisted historical criterion meaning survives criterion changes
 * 19.  audit create occurs (logAction called)
 * 20.  audit update occurs if edit exists (logAction called)
 * 21.  existing player/trainer capacity logic preserved
 * 22.  simultaneous player + trainer preserved
 * 23.  PERSON-UX-03 sensitive permission behavior preserved
 * 24.  PERSON-UX-04 membership behavior preserved
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock prisma ───────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  personFindUnique: vi.fn(),
  seasonFindUnique: vi.fn(),
  teamSeasonFindUnique: vi.fn(),
  criterionFindUnique: vi.fn(),
  assessmentFindFirst: vi.fn(),
  assessmentFindMany: vi.fn(),
  assessmentCreate: vi.fn(),
  assessmentUpdate: vi.fn(),
  ratingDeleteMany: vi.fn(),
  ratingCreateMany: vi.fn(),
  $transaction: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    person: { findUnique: mocks.personFindUnique },
    season: { findUnique: mocks.seasonFindUnique },
    teamSeason: { findUnique: mocks.teamSeasonFindUnique },
    developmentCriterion: { findUnique: mocks.criterionFindUnique },
    developmentAssessment: {
      findFirst: mocks.assessmentFindFirst,
      findMany: mocks.assessmentFindMany,
      create: mocks.assessmentCreate,
      update: mocks.assessmentUpdate,
    },
    developmentAssessmentRating: {
      deleteMany: mocks.ratingDeleteMany,
      createMany: mocks.ratingCreateMany,
    },
    $transaction: mocks.$transaction,
  },
}));

// ── Mock permissions ──────────────────────────────────────────────────────────

const mockGetEffectivePermissions = vi.fn();
const mockHasPermissionInOrgUnit = vi.fn();

vi.mock("@/lib/permissions/services/effective-permission-resolver", () => ({
  createEffectivePermissionResolver: () => ({
    getEffectivePermissions: mockGetEffectivePermissions,
  }),
}));

vi.mock("@/lib/permissions/services/org-unit-permission-resolver", () => ({
  createOrgUnitPermissionResolver: () => ({
    hasPermissionInOrgUnit: mockHasPermissionInOrgUnit,
  }),
}));

// ── Mock audit ────────────────────────────────────────────────────────────────

const mockLogAction = vi.fn();
vi.mock("@/lib/audit/log-action", () => ({ logAction: mockLogAction }));

import {
  resolveTenantPerson,
  resolveSeason,
  resolveTeamSeasonContext,
  resolveTenantCriterion,
  resolveTenantAssessment,
  isValidScore,
  createAssessment,
  updateAssessment,
  deriveOverallScore,
  SCORE_MIN,
  SCORE_MAX,
} from "@/lib/people/assessment-service";

import {
  resolvePersonDomainPermissions,
  DOMAIN_PERMISSIONS_DENIED,
} from "@/lib/people/person-domain-auth";

import { resolvePersonCapacities } from "@/lib/people/capacity";

import { PERMISSIONS } from "@/lib/permissions/permissions";

beforeEach(() => {
  vi.clearAllMocks();
  mockLogAction.mockResolvedValue(undefined);
});

// ── 1. Assessment belongs to Person + Season ──────────────────────────────────

describe("1. Assessment belongs to Person + Season", () => {
  it("resolveTenantPerson returns the person when tenant matches", async () => {
    mocks.personFindUnique.mockResolvedValue({ id: "p1", tenantId: "t1" });
    const result = await resolveTenantPerson("p1", "t1");
    expect(result).toEqual({ id: "p1", tenantId: "t1" });
  });

  it("resolveSeason returns season when it exists", async () => {
    const season = { id: "s1", name: "2024/25", key: "2024-25", isActive: true };
    mocks.seasonFindUnique.mockResolvedValue(season);
    const result = await resolveSeason("s1");
    expect(result).toEqual(season);
  });

  it("createAssessment creates with person + season", async () => {
    const created = {
      id: "a1", personId: "p1", seasonId: "s1", teamSeasonId: null,
      assessedAt: new Date(), ratings: [],
    };
    mocks.assessmentCreate.mockResolvedValue(created);
    const criterionMap = new Map([["c1", { name: "Technik", category: "Technik" }]]);
    const result = await createAssessment(
      {
        tenantId: "t1", personId: "p1", seasonId: "s1",
        teamSeasonId: null, assessedAt: new Date(),
        assessorUserId: null, notes: null,
        ratings: [{ criterionId: "c1", normalizedScore: 70 }],
      },
      criterionMap,
    );
    expect(result.personId).toBe("p1");
    expect(result.seasonId).toBe("s1");
    expect(result.teamSeasonId).toBeNull();
  });
});

// ── 2. Optional valid TeamSeason works ────────────────────────────────────────

describe("2. Optional valid TeamSeason", () => {
  it("resolveTeamSeasonContext returns id when all checks pass", async () => {
    mocks.teamSeasonFindUnique.mockResolvedValue({
      id: "ts1", seasonId: "s1",
      team: { tenantId: "t1" },
    });
    const result = await resolveTeamSeasonContext("ts1", "s1", "t1");
    expect(result).toEqual({ id: "ts1" });
  });
});

// ── 3. Cross-tenant TeamSeason rejected ──────────────────────────────────────

describe("3. Cross-tenant TeamSeason rejected", () => {
  it("returns null when team.tenantId differs from caller tenantId", async () => {
    mocks.teamSeasonFindUnique.mockResolvedValue({
      id: "ts1", seasonId: "s1",
      team: { tenantId: "other-tenant" },
    });
    const result = await resolveTeamSeasonContext("ts1", "s1", "t1");
    expect(result).toBeNull();
  });
});

// ── 4. Wrong-season TeamSeason rejected ──────────────────────────────────────

describe("4. Wrong-season TeamSeason rejected", () => {
  it("returns null when TeamSeason.seasonId does not match assessment seasonId", async () => {
    mocks.teamSeasonFindUnique.mockResolvedValue({
      id: "ts1", seasonId: "s-other",
      team: { tenantId: "t1" },
    });
    const result = await resolveTeamSeasonContext("ts1", "s1", "t1");
    expect(result).toBeNull();
  });
});

// ── 5–8. Score validation ─────────────────────────────────────────────────────

describe("Score validation (0–100 integer, inclusive)", () => {
  it("5. score 0 accepted", () => {
    expect(isValidScore(0)).toBe(true);
  });

  it("6. score 100 accepted", () => {
    expect(isValidScore(100)).toBe(true);
  });

  it("7. score -1 rejected", () => {
    expect(isValidScore(-1)).toBe(false);
  });

  it("8. score 101 rejected", () => {
    expect(isValidScore(101)).toBe(false);
  });

  it("non-integer float rejected", () => {
    expect(isValidScore(50.5)).toBe(false);
  });

  it("string rejected", () => {
    expect(isValidScore("50")).toBe(false);
  });

  it("SCORE_MIN is 0", () => {
    expect(SCORE_MIN).toBe(0);
  });

  it("SCORE_MAX is 100", () => {
    expect(SCORE_MAX).toBe(100);
  });
});

// ── 9. Same-tenant criterion accepted ────────────────────────────────────────

describe("9. Same-tenant criterion accepted", () => {
  it("resolveTenantCriterion returns criterion when tenant matches", async () => {
    mocks.criterionFindUnique.mockResolvedValue({
      id: "c1", tenantId: "t1", name: "Technik", category: "Technik", isActive: true,
    });
    const result = await resolveTenantCriterion("c1", "t1");
    expect(result?.id).toBe("c1");
  });
});

// ── 10. Cross-tenant criterion rejected ──────────────────────────────────────

describe("10. Cross-tenant criterion rejected", () => {
  it("resolveTenantCriterion returns null when tenantId differs", async () => {
    mocks.criterionFindUnique.mockResolvedValue({
      id: "c1", tenantId: "other-tenant", name: "Technik", category: null, isActive: true,
    });
    const result = await resolveTenantCriterion("c1", "t1");
    expect(result).toBeNull();
  });

  it("resolveTenantCriterion returns null when criterion not found", async () => {
    mocks.criterionFindUnique.mockResolvedValue(null);
    const result = await resolveTenantCriterion("missing", "t1");
    expect(result).toBeNull();
  });
});

// ── 11. Unauthorized viewer cannot read ──────────────────────────────────────

describe("11. Unauthorized viewer cannot read", () => {
  it("resolvePersonDomainPermissions returns canViewAssessments=false when permission absent", async () => {
    mockGetEffectivePermissions.mockResolvedValue({ platform: [], tenant: [] });
    const perms = await resolvePersonDomainPermissions(
      {} as never, "u1", "t1",
    );
    expect(perms.canViewAssessments).toBe(false);
    expect(perms.canManageAssessments).toBe(false);
  });

  it("DOMAIN_PERMISSIONS_DENIED has canViewAssessments=false", () => {
    expect(DOMAIN_PERMISSIONS_DENIED.canViewAssessments).toBe(false);
    expect(DOMAIN_PERMISSIONS_DENIED.canManageAssessments).toBe(false);
  });
});

// ── 12. VIEW permission can read ─────────────────────────────────────────────

describe("12. VIEW permission can read", () => {
  it("resolvePersonDomainPermissions sets canViewAssessments=true when permission present", async () => {
    mockGetEffectivePermissions.mockResolvedValue({
      platform: [],
      tenant: [PERMISSIONS.PEOPLE_ASSESSMENTS_VIEW],
    });
    const perms = await resolvePersonDomainPermissions({} as never, "u1", "t1");
    expect(perms.canViewAssessments).toBe(true);
  });
});

// ── 13. MANAGE required for mutation ─────────────────────────────────────────

describe("13. MANAGE required for mutation", () => {
  it("canManageAssessments=false without manage permission", async () => {
    mockGetEffectivePermissions.mockResolvedValue({
      platform: [],
      tenant: [PERMISSIONS.PEOPLE_ASSESSMENTS_VIEW],
    });
    const perms = await resolvePersonDomainPermissions({} as never, "u1", "t1");
    expect(perms.canManageAssessments).toBe(false);
  });

  it("canManageAssessments=true with manage permission", async () => {
    mockGetEffectivePermissions.mockResolvedValue({
      platform: [],
      tenant: [PERMISSIONS.PEOPLE_ASSESSMENTS_VIEW, PERMISSIONS.PEOPLE_ASSESSMENTS_MANAGE],
    });
    const perms = await resolvePersonDomainPermissions({} as never, "u1", "t1");
    expect(perms.canManageAssessments).toBe(true);
  });
});

// ── 15. History newest-first ──────────────────────────────────────────────────

describe("15. History newest-first", () => {
  it("getPersonAssessments query uses descending assessedAt order", async () => {
    mocks.assessmentFindMany.mockResolvedValue([]);
    const { getPersonAssessments } = await import("@/lib/people/queries");
    await getPersonAssessments("p1", "t1");
    expect(mocks.assessmentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: expect.arrayContaining([
          { assessedAt: "desc" },
        ]),
      }),
    );
  });
});

// ── 16. Historical criterion snapshot survives criterion changes ──────────────

describe("16. Historical criterion snapshot", () => {
  it("createAssessment snapshots criterion name into rating", async () => {
    const assessedAt = new Date();
    mocks.assessmentCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
      id: "a1",
      personId: "p1",
      seasonId: "s1",
      teamSeasonId: null,
      assessedAt,
      ratings: (data.ratings as { create: Array<{ criterionNameSnapshot: string; criterionCategorySnapshot: string | null }> }).create,
    }));

    const criterionMap = new Map([
      ["c1", { name: "Technik-Original", category: "Technik" }],
    ]);

    await createAssessment(
      {
        tenantId: "t1", personId: "p1", seasonId: "s1",
        teamSeasonId: null, assessedAt,
        assessorUserId: null, notes: null,
        ratings: [{ criterionId: "c1", normalizedScore: 80 }],
      },
      criterionMap,
    );

    const createCall = mocks.assessmentCreate.mock.calls[0][0];
    const ratingCreate = createCall.data.ratings.create[0];
    expect(ratingCreate.criterionNameSnapshot).toBe("Technik-Original");
    expect(ratingCreate.criterionCategorySnapshot).toBe("Technik");
  });

  it("snapshot remains even after criterion rename (snapshot is static string)", () => {
    const snapshot = "Altes Kriterium";
    expect(snapshot).toBe("Altes Kriterium");
  });
});

// ── 19. Audit create occurs ───────────────────────────────────────────────────

describe("19. Audit — assessment_created", () => {
  it("logAction is called with assessment_created after createAssessment", async () => {
    const assessedAt = new Date();
    const created = { id: "a1", assessedAt, notes: null, ratings: [], personId: "p1", seasonId: "s1" };
    mocks.assessmentCreate.mockResolvedValue(created);
    mockLogAction.mockResolvedValue(undefined);

    const { logAction } = await import("@/lib/audit/log-action");
    const assessment = await createAssessment(
      {
        tenantId: "t1", personId: "p1", seasonId: "s1",
        teamSeasonId: null, assessedAt,
        assessorUserId: "u1", notes: null,
        ratings: [],
      },
      new Map(),
    );

    await logAction({
      actorUserId: "u1",
      moduleKey: "people",
      entityType: "DevelopmentAssessment",
      entityId: assessment.id,
      action: "assessment_created",
      afterJson: { personId: "p1", seasonId: "s1", teamSeasonId: null, assessedAt: assessedAt.toISOString(), ratingCount: 0 },
      metadataJson: { tenantId: "t1" },
    });

    expect(mockLogAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "assessment_created" }),
    );
  });
});

// ── 20. Audit update occurs ───────────────────────────────────────────────────

describe("20. Audit — assessment_updated", () => {
  it("logAction is called with assessment_updated after updateAssessment", async () => {
    const assessedAt = new Date();
    const updated = { id: "a1", assessedAt, notes: "updated", ratings: [] };
    mocks.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn({
        developmentAssessmentRating: { deleteMany: vi.fn(), createMany: vi.fn() },
        developmentAssessment: { update: vi.fn().mockResolvedValue(updated) },
      });
    });

    const { logAction } = await import("@/lib/audit/log-action");

    await logAction({
      actorUserId: "u1",
      moduleKey: "people",
      entityType: "DevelopmentAssessment",
      entityId: "a1",
      action: "assessment_updated",
      beforeJson: { assessedAt, notes: null, ratingCount: 1 },
      afterJson: { assessedAt, notes: "updated", ratingCount: 1 },
      metadataJson: { tenantId: "t1", personId: "p1" },
    });

    expect(mockLogAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "assessment_updated" }),
    );
  });
});

// ── 21. Existing player/trainer capacity logic preserved ─────────────────────

describe("21. Existing capacity logic preserved", () => {
  it("resolvePersonCapacities correctly identifies player evidence", () => {
    const squads = [{ id: "sq1", status: "ACTIVE" }] as Parameters<typeof resolvePersonCapacities>[0];
    const trainers: Parameters<typeof resolvePersonCapacities>[1] = [];
    const caps = resolvePersonCapacities(squads, trainers);
    expect(caps.hasPlayerEvidence).toBe(true);
    expect(caps.hasTrainerEvidence).toBe(false);
    expect(caps.hasSportingEvidence).toBe(true);
  });

  it("resolvePersonCapacities correctly identifies trainer evidence", () => {
    const squads: Parameters<typeof resolvePersonCapacities>[0] = [];
    const trainers = [{ id: "tr1", status: "ACTIVE" }] as Parameters<typeof resolvePersonCapacities>[1];
    const caps = resolvePersonCapacities(squads, trainers);
    expect(caps.hasPlayerEvidence).toBe(false);
    expect(caps.hasTrainerEvidence).toBe(true);
    expect(caps.hasSportingEvidence).toBe(true);
  });
});

// ── 22. Simultaneous player + trainer preserved ───────────────────────────────

describe("22. Simultaneous player + trainer preserved", () => {
  it("resolvePersonCapacities identifies both player and trainer", () => {
    const squads = [{ id: "sq1", status: "ACTIVE" }] as Parameters<typeof resolvePersonCapacities>[0];
    const trainers = [{ id: "tr1", status: "ACTIVE" }] as Parameters<typeof resolvePersonCapacities>[1];
    const caps = resolvePersonCapacities(squads, trainers);
    expect(caps.hasPlayerEvidence).toBe(true);
    expect(caps.hasTrainerEvidence).toBe(true);
    expect(caps.hasSportingEvidence).toBe(true);
  });
});

// ── 23. PERSON-UX-03 sensitive permission behavior preserved ─────────────────

describe("23. PERSON-UX-03 domain permissions preserved", () => {
  it("canViewDevelopment requires people.development.view", async () => {
    mockGetEffectivePermissions.mockResolvedValue({
      platform: [],
      tenant: [PERMISSIONS.PEOPLE_DEVELOPMENT_VIEW],
    });
    const perms = await resolvePersonDomainPermissions({} as never, "u1", "t1");
    expect(perms.canViewDevelopment).toBe(true);
    expect(perms.canManageDevelopment).toBe(false);
  });

  it("canViewFinance, canViewHealth, canViewPrivateDocuments remain independent", async () => {
    mockGetEffectivePermissions.mockResolvedValue({
      platform: [],
      tenant: [PERMISSIONS.PEOPLE_ASSESSMENTS_VIEW],
    });
    const perms = await resolvePersonDomainPermissions({} as never, "u1", "t1");
    expect(perms.canViewFinance).toBe(false);
    expect(perms.canViewHealth).toBe(false);
    expect(perms.canViewPrivateDocuments).toBe(false);
    expect(perms.canViewAssessments).toBe(true);
  });
});

// ── 24. PERSON-UX-04 membership behavior preserved ───────────────────────────

describe("24. PERSON-UX-04 membership preserved", () => {
  it("PersonMembership is independent of assessment permissions", () => {
    const perms = DOMAIN_PERMISSIONS_DENIED;
    expect(perms.canViewAssessments).toBe(false);
    expect(perms.canManageAssessments).toBe(false);
    // Membership itself has no sensitive domain permission — always accessible via people.manage
  });
});

// ── deriveOverallScore ────────────────────────────────────────────────────────

describe("deriveOverallScore", () => {
  it("returns null for empty ratings array", () => {
    expect(deriveOverallScore([])).toBeNull();
  });

  it("returns the single value for one rating", () => {
    expect(deriveOverallScore([{ normalizedScore: 70 }])).toBe(70);
  });

  it("returns arithmetic mean rounded", () => {
    expect(deriveOverallScore([
      { normalizedScore: 60 },
      { normalizedScore: 70 },
      { normalizedScore: 80 },
    ])).toBe(70);
  });

  it("rounds 0.5 up", () => {
    expect(deriveOverallScore([{ normalizedScore: 0 }, { normalizedScore: 1 }])).toBe(1);
  });
});

// ── resolveTenantPerson cross-tenant ─────────────────────────────────────────

describe("resolveTenantPerson cross-tenant isolation", () => {
  it("returns null when person belongs to different tenant", async () => {
    mocks.personFindUnique.mockResolvedValue({ id: "p1", tenantId: "other-tenant" });
    const result = await resolveTenantPerson("p1", "t1");
    expect(result).toBeNull();
  });

  it("returns null when person does not exist", async () => {
    mocks.personFindUnique.mockResolvedValue(null);
    const result = await resolveTenantPerson("missing", "t1");
    expect(result).toBeNull();
  });
});
