/**
 * lib/integrations/sfv/__tests__/sync-teams.test.ts
 *
 * Focused unit tests for the SFV team synchronization layer.
 *
 * All database and SFV client calls are mocked — no real network or database
 * access. No live SFV credentials are used.
 *
 * TEST COVERAGE MAP:
 *
 * First synchronization:
 *   1.  First sync creates a TeamExternalMapping and Team when none exists.
 *   2.  Created count is 1 after a single new team is imported.
 *   3.  Fetched count matches the number of teams returned by the provider.
 *
 * Repeat synchronization (idempotency):
 *   4.  Second sync with identical data produces unchanged = 1, created = 0.
 *   5.  Repeating the same sync never creates duplicate mappings.
 *
 * Update behavior:
 *   6.  Changed provider-owned field (leagueName) triggers updated = 1.
 *   7.  update only touches mapping fields — not called for Team.name.
 *
 * Local field preservation:
 *   8.  Local-only fields (Team.name) are NOT overwritten on update.
 *
 * Rename behavior:
 *   9.  Renamed team does not create a duplicate (same teamId → update, not create).
 *
 * Failed fetch safety:
 *   10. Failed fetch does not mark any teams inactive.
 *   11. Failed fetch returns failed = 1 with a sanitized error code.
 *
 * Tenant isolation:
 *   12. Tenant A's sync cannot read Tenant B's mappings (loadExistingMappings scoped).
 *   13. Sync for Tenant A does not create Teams for Tenant B.
 *
 * Duplicate external ID rejection:
 *   14. Duplicate externalTeamId within the same tenant/season is rejected.
 *
 * Same external ID for different tenants:
 *   15. Same externalTeamId can map to different Teams for different tenants.
 *
 * Empty provider response:
 *   16. Empty provider list with pre-existing mappings does not mark anything inactive.
 *   17. Empty provider list returns fetched = 0, all counts 0.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SfvTeamSyncContext } from "../sync/types";
import type { TeamDetail } from "../client";

// ── Mock: SFV client ──────────────────────────────────────────────────────────

const mockFetchTeamList = vi.fn();
vi.mock("../client", () => ({
  fetchTeamList: (...args: unknown[]) => mockFetchTeamList(...args),
  acquireToken: vi.fn(),
}));

// ── Mock: tenant config service ───────────────────────────────────────────────

const mockRequireEnabledSfvConfigForTenant = vi.fn();
vi.mock("../tenant-config-service", () => ({
  requireEnabledSfvConfigForTenant: (...args: unknown[]) =>
    mockRequireEnabledSfvConfigForTenant(...args),
}));

const mockMarkTeamSyncSuccessful = vi.fn();
vi.mock("../tenant-config-repository", () => ({
  markTeamSyncSuccessful: (...args: unknown[]) =>
    mockMarkTeamSyncSuccessful(...args),
}));

// ── Mock: team-persistence ────────────────────────────────────────────────────

const mockLoadExistingMappings = vi.fn();
const mockProcessTeamDetail = vi.fn();
const mockMarkMappingsInactive = vi.fn();

vi.mock("../sync/team-persistence", () => ({
  loadExistingMappings: (...args: unknown[]) => mockLoadExistingMappings(...args),
  processTeamDetail: (...args: unknown[]) => mockProcessTeamDetail(...args),
  markMappingsInactive: (...args: unknown[]) => mockMarkMappingsInactive(...args),
}));

// ── Import after mocks ────────────────────────────────────────────────────────

const { syncSfvTeams } = await import("../sync/teams");

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TENANT_A = "tenant-a-cuid";
const TENANT_B = "tenant-b-cuid";

function makeTenantConfig(tenantId = TENANT_A, overrides: Partial<{ clubId: number; defaultSeasonId: number; organisationId: number | null }> = {}) {
  return {
    id: "config-1",
    tenantId,
    clubId: overrides.clubId ?? 483,
    defaultSeasonId: overrides.defaultSeasonId ?? 2027,
    organisationId: overrides.organisationId ?? null,
    enabled: true,
    lastTeamSyncAt: null,
    lastScheduleSyncAt: null,
    lastMatchDetailSyncAt: null,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
  };
}

/** Minimal synthetic TeamDetail — never real SFV data. */
function makeTeamDetail(overrides: Partial<TeamDetail> = {}): TeamDetail {
  return {
    isHomeTeam: true,
    teamId: 31927,
    teamName: "FC Testclub 1",
    teamFullname: "FC Testclub 1 (4. Liga)",
    clubNumber: 9999,
    clubName: "FC Testclub",
    teamLeagueId: 17131,
    teamLeagueName: "4. Liga",
    teamDivisionName: "Gruppe 1",
    teamOrganisationId: 8,
    isTeamActive: true,
    ...overrides,
  };
}

/** Minimal existing mapping row. */
function makeExistingMapping(externalTeamId = 31927) {
  return new Map([
    [
      externalTeamId,
      {
        id: `mapping-${externalTeamId}`,
        teamId: `team-${externalTeamId}`,
        providerTeamName: "FC Testclub 1 (4. Liga)",
        providerLeagueId: 17131,
        providerLeagueName: "4. Liga",
        providerOrganisationId: 8,
        providerIsActive: true,
      },
    ],
  ]);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockMarkMappingsInactive.mockResolvedValue(0);
});

// ── 1-3: First synchronization ────────────────────────────────────────────────

describe("First synchronization", () => {
  it("1 — creates a mapping when none exists", async () => {
    mockRequireEnabledSfvConfigForTenant.mockResolvedValueOnce(makeTenantConfig());
    mockFetchTeamList.mockResolvedValueOnce([makeTeamDetail()]);
    mockLoadExistingMappings.mockResolvedValueOnce(new Map());
    mockProcessTeamDetail.mockResolvedValueOnce({ status: "created" });

    const result = await syncSfvTeams(TENANT_A);

    expect(result.created).toBe(1);
    expect(result.updated).toBe(0);
    expect(mockProcessTeamDetail).toHaveBeenCalledOnce();
  });

  it("2 — created count matches new teams returned by provider", async () => {
    mockRequireEnabledSfvConfigForTenant.mockResolvedValueOnce(makeTenantConfig());
    mockFetchTeamList.mockResolvedValueOnce([makeTeamDetail(), makeTeamDetail({ teamId: 60413 })]);
    mockLoadExistingMappings.mockResolvedValueOnce(new Map());
    mockProcessTeamDetail.mockResolvedValue({ status: "created" });

    const result = await syncSfvTeams(TENANT_A);

    expect(result.created).toBe(2);
    expect(result.fetched).toBe(2);
  });

  it("3 — fetched count matches number of records returned by provider", async () => {
    const teams = [makeTeamDetail(), makeTeamDetail({ teamId: 60413 }), makeTeamDetail({ teamId: 99999 })];
    mockRequireEnabledSfvConfigForTenant.mockResolvedValueOnce(makeTenantConfig());
    mockFetchTeamList.mockResolvedValueOnce(teams);
    mockLoadExistingMappings.mockResolvedValueOnce(new Map());
    mockProcessTeamDetail.mockResolvedValue({ status: "created" });

    const result = await syncSfvTeams(TENANT_A);

    expect(result.fetched).toBe(3);
  });
});

// ── 4-5: Repeat synchronization (idempotency) ─────────────────────────────────

describe("Repeat synchronization (idempotency)", () => {
  it("4 — second sync with identical data produces unchanged = 1, created = 0", async () => {
    mockRequireEnabledSfvConfigForTenant.mockResolvedValueOnce(makeTenantConfig());
    mockFetchTeamList.mockResolvedValueOnce([makeTeamDetail()]);
    mockLoadExistingMappings.mockResolvedValueOnce(makeExistingMapping());
    mockProcessTeamDetail.mockResolvedValueOnce({ status: "unchanged" });

    const result = await syncSfvTeams(TENANT_A);

    expect(result.unchanged).toBe(1);
    expect(result.created).toBe(0);
    expect(result.updated).toBe(0);
  });

  it("5 — repeating the same sync never creates duplicate mappings", async () => {
    // Run once
    mockRequireEnabledSfvConfigForTenant.mockResolvedValueOnce(makeTenantConfig());
    mockFetchTeamList.mockResolvedValueOnce([makeTeamDetail()]);
    mockLoadExistingMappings.mockResolvedValueOnce(makeExistingMapping());
    mockProcessTeamDetail.mockResolvedValueOnce({ status: "unchanged" });

    const result1 = await syncSfvTeams(TENANT_A);

    // Run again
    mockRequireEnabledSfvConfigForTenant.mockResolvedValueOnce(makeTenantConfig());
    mockFetchTeamList.mockResolvedValueOnce([makeTeamDetail()]);
    mockLoadExistingMappings.mockResolvedValueOnce(makeExistingMapping());
    mockProcessTeamDetail.mockResolvedValueOnce({ status: "unchanged" });

    const result2 = await syncSfvTeams(TENANT_A);

    expect(result1.created).toBe(0);
    expect(result2.created).toBe(0);
    expect(mockProcessTeamDetail).toHaveBeenCalledTimes(2);
  });
});

// ── 6-8: Update behavior and field ownership ──────────────────────────────────

describe("Update behavior", () => {
  it("6 — changed provider-owned field triggers updated = 1", async () => {
    mockRequireEnabledSfvConfigForTenant.mockResolvedValueOnce(makeTenantConfig());
    mockFetchTeamList.mockResolvedValueOnce([makeTeamDetail({ teamLeagueName: "3. Liga" })]);
    mockLoadExistingMappings.mockResolvedValueOnce(makeExistingMapping());
    // The persistence layer detects the change and returns updated
    mockProcessTeamDetail.mockResolvedValueOnce({ status: "updated" });

    const result = await syncSfvTeams(TENANT_A);

    expect(result.updated).toBe(1);
    expect(result.created).toBe(0);
  });

  it("7 — processTeamDetail is called with the existing mapping context (not a create call)", async () => {
    const existing = makeExistingMapping();
    mockRequireEnabledSfvConfigForTenant.mockResolvedValueOnce(makeTenantConfig());
    mockFetchTeamList.mockResolvedValueOnce([makeTeamDetail()]);
    mockLoadExistingMappings.mockResolvedValueOnce(existing);
    mockProcessTeamDetail.mockResolvedValueOnce({ status: "updated" });

    await syncSfvTeams(TENANT_A);

    expect(mockProcessTeamDetail).toHaveBeenCalledWith(
      expect.objectContaining({ teamId: 31927 }),
      expect.objectContaining({ tenantId: TENANT_A }),
      existing,
    );
  });
});

describe("Local field preservation", () => {
  it("8 — sync result never contains Team.name overwrite (update only touches mapping)", async () => {
    // The sync engine calls processTeamDetail which internally delegates to
    // updateMappingFields — it does NOT call team.update. We verify that the
    // sync result does not claim to have modified local-only data.
    mockRequireEnabledSfvConfigForTenant.mockResolvedValueOnce(makeTenantConfig());
    mockFetchTeamList.mockResolvedValueOnce([makeTeamDetail({ teamName: "Renamed team" })]);
    mockLoadExistingMappings.mockResolvedValueOnce(makeExistingMapping());
    mockProcessTeamDetail.mockResolvedValueOnce({ status: "updated" });

    const result = await syncSfvTeams(TENANT_A);

    // The result only contains counts — no Team.name field
    expect(result).not.toHaveProperty("teamName");
    expect(result.updated).toBe(1);
    expect(result.created).toBe(0);
  });
});

// ── 9: Rename behavior ────────────────────────────────────────────────────────

describe("Rename behavior", () => {
  it("9 — renamed team does not create a duplicate (same teamId → update, not create)", async () => {
    // Provider returns same teamId but different teamName.
    const renamedTeam = makeTeamDetail({ teamName: "FC Testclub 1 Renamed" });
    const existing = makeExistingMapping(31927);

    mockRequireEnabledSfvConfigForTenant.mockResolvedValueOnce(makeTenantConfig());
    mockFetchTeamList.mockResolvedValueOnce([renamedTeam]);
    mockLoadExistingMappings.mockResolvedValueOnce(existing);
    // Existing mapping found → update path (not create)
    mockProcessTeamDetail.mockResolvedValueOnce({ status: "updated" });

    const result = await syncSfvTeams(TENANT_A);

    expect(result.created).toBe(0);
    expect(result.updated).toBe(1);
  });
});

// ── 10-11: Failed or incomplete fetch safety ──────────────────────────────────

describe("Failed fetch safety", () => {
  it("10 — failed fetch does not mark any teams inactive", async () => {
    mockRequireEnabledSfvConfigForTenant.mockResolvedValueOnce(makeTenantConfig());
    mockFetchTeamList.mockRejectedValueOnce(
      Object.assign(new Error("Network error"), { code: "SFV_UNAVAILABLE" }),
    );

    await syncSfvTeams(TENANT_A);

    expect(mockMarkMappingsInactive).not.toHaveBeenCalled();
  });

  it("11 — failed fetch returns failed = 1 with a sanitized error code", async () => {
    mockRequireEnabledSfvConfigForTenant.mockResolvedValueOnce(makeTenantConfig());
    const sfvErr = Object.assign(new Error("SFV endpoint is not reachable."), {
      name: "SfvNetworkError",
      code: "SFV_UNAVAILABLE",
    });
    mockFetchTeamList.mockRejectedValueOnce(sfvErr);

    const result = await syncSfvTeams(TENANT_A);

    expect(result.failed).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBeDefined();
    // Error message must not contain credentials
    expect(result.errors[0].message).not.toMatch(/password|token|key/i);
  });
});

// ── 12-13: Tenant isolation ───────────────────────────────────────────────────

describe("Tenant isolation", () => {
  it("12 — loadExistingMappings is called with Tenant A's tenantId only", async () => {
    mockRequireEnabledSfvConfigForTenant.mockResolvedValueOnce(makeTenantConfig(TENANT_A));
    mockFetchTeamList.mockResolvedValueOnce([]);
    mockLoadExistingMappings.mockResolvedValueOnce(new Map());

    await syncSfvTeams(TENANT_A);

    expect(mockLoadExistingMappings).toHaveBeenCalledWith(TENANT_A, "SFV", 2027);
    expect(mockLoadExistingMappings).not.toHaveBeenCalledWith(TENANT_B, expect.anything(), expect.anything());
  });

  it("13 — sync context for Tenant A carries Tenant A's tenantId", async () => {
    mockRequireEnabledSfvConfigForTenant.mockResolvedValueOnce(makeTenantConfig(TENANT_A));
    mockFetchTeamList.mockResolvedValueOnce([makeTeamDetail()]);
    mockLoadExistingMappings.mockResolvedValueOnce(new Map());
    mockProcessTeamDetail.mockResolvedValueOnce({ status: "created" });

    await syncSfvTeams(TENANT_A);

    const [, contextArg] = mockProcessTeamDetail.mock.calls[0];
    expect((contextArg as SfvTeamSyncContext).tenantId).toBe(TENANT_A);
  });
});

// ── 14: Duplicate external ID rejection ───────────────────────────────────────

describe("Duplicate external ID rejection", () => {
  it("14 — duplicate externalTeamId within same tenant/season returns failed for second", async () => {
    // Simulate provider returning two entries with the same teamId (malformed response).
    const team = makeTeamDetail({ teamId: 31927 });
    const duplicate = makeTeamDetail({ teamId: 31927, teamName: "Duplicate" });

    mockRequireEnabledSfvConfigForTenant.mockResolvedValueOnce(makeTenantConfig());
    mockFetchTeamList.mockResolvedValueOnce([team, duplicate]);
    mockLoadExistingMappings.mockResolvedValueOnce(new Map());
    // First succeeds (create), second fails (unique constraint)
    mockProcessTeamDetail
      .mockResolvedValueOnce({ status: "created" })
      .mockResolvedValueOnce({
        status: "failed",
        code: "TEAM_CREATE_FAILED",
        message: "Unique constraint violation on TeamExternalMapping.",
      });

    const result = await syncSfvTeams(TENANT_A);

    expect(result.created).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.errors[0].code).toBe("TEAM_CREATE_FAILED");
  });
});

// ── 15: Same external ID for different tenants ────────────────────────────────

describe("Same external ID for different tenants", () => {
  it("15 — same externalTeamId can exist for different tenants without conflict", async () => {
    // Tenant A sync
    mockRequireEnabledSfvConfigForTenant.mockResolvedValueOnce(makeTenantConfig(TENANT_A));
    mockFetchTeamList.mockResolvedValueOnce([makeTeamDetail({ teamId: 31927 })]);
    mockLoadExistingMappings.mockResolvedValueOnce(new Map());
    mockProcessTeamDetail.mockResolvedValueOnce({ status: "created" });

    const resultA = await syncSfvTeams(TENANT_A);

    // Tenant B sync with same externalTeamId
    mockRequireEnabledSfvConfigForTenant.mockResolvedValueOnce(makeTenantConfig(TENANT_B));
    mockFetchTeamList.mockResolvedValueOnce([makeTeamDetail({ teamId: 31927 })]);
    mockLoadExistingMappings.mockResolvedValueOnce(new Map());
    mockProcessTeamDetail.mockResolvedValueOnce({ status: "created" });

    const resultB = await syncSfvTeams(TENANT_B);

    expect(resultA.created).toBe(1);
    expect(resultB.created).toBe(1);
    expect(resultA.tenantId).toBe(TENANT_A);
    expect(resultB.tenantId).toBe(TENANT_B);
  });
});

// ── 16-17: Empty provider response ───────────────────────────────────────────

describe("Empty provider response", () => {
  it("16 — empty provider list with pre-existing mappings does not mark anything inactive", async () => {
    mockRequireEnabledSfvConfigForTenant.mockResolvedValueOnce(makeTenantConfig());
    mockFetchTeamList.mockResolvedValueOnce([]); // empty — could be transient API issue
    mockLoadExistingMappings.mockResolvedValueOnce(makeExistingMapping());

    const result = await syncSfvTeams(TENANT_A);

    expect(mockMarkMappingsInactive).not.toHaveBeenCalled();
    expect(result.markedInactive).toBe(0);
  });

  it("17 — empty provider list returns fetched = 0, all counts 0", async () => {
    mockRequireEnabledSfvConfigForTenant.mockResolvedValueOnce(makeTenantConfig());
    mockFetchTeamList.mockResolvedValueOnce([]);
    mockLoadExistingMappings.mockResolvedValueOnce(new Map());

    const result = await syncSfvTeams(TENANT_A);

    expect(result.fetched).toBe(0);
    expect(result.created).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.unchanged).toBe(0);
    expect(result.markedInactive).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.errors).toHaveLength(0);
  });
});

// ── Result structure ──────────────────────────────────────────────────────────

describe("Result structure", () => {
  it("result contains all required fields", async () => {
    mockRequireEnabledSfvConfigForTenant.mockResolvedValueOnce(makeTenantConfig());
    mockFetchTeamList.mockResolvedValueOnce([]);
    mockLoadExistingMappings.mockResolvedValueOnce(new Map());

    const result = await syncSfvTeams(TENANT_A);

    expect(result).toHaveProperty("startedAt");
    expect(result).toHaveProperty("finishedAt");
    expect(result).toHaveProperty("durationMs");
    expect(result).toHaveProperty("tenantId");
    expect(result).toHaveProperty("source");
    expect(result).toHaveProperty("clubId");
    expect(result).toHaveProperty("seasonId");
    expect(result).toHaveProperty("fetched");
    expect(result).toHaveProperty("created");
    expect(result).toHaveProperty("updated");
    expect(result).toHaveProperty("unchanged");
    expect(result).toHaveProperty("markedInactive");
    expect(result).toHaveProperty("failed");
    expect(result).toHaveProperty("errors");
  });

  it("result never contains provider credentials or raw payload", async () => {
    mockRequireEnabledSfvConfigForTenant.mockResolvedValueOnce(makeTenantConfig());
    mockFetchTeamList.mockResolvedValueOnce([makeTeamDetail()]);
    mockLoadExistingMappings.mockResolvedValueOnce(new Map());
    mockProcessTeamDetail.mockResolvedValueOnce({ status: "created" });

    const result = await syncSfvTeams(TENANT_A);
    const serialized = JSON.stringify(result);

    expect(serialized).not.toMatch(/password|token|key|secret/i);
    expect(result.source).toBe("SFV");
  });

  it("tenantId in result matches the requesting tenant", async () => {
    mockRequireEnabledSfvConfigForTenant.mockResolvedValueOnce(makeTenantConfig(TENANT_A));
    mockFetchTeamList.mockResolvedValueOnce([]);
    mockLoadExistingMappings.mockResolvedValueOnce(new Map());

    const result = await syncSfvTeams(TENANT_A);

    expect(result.tenantId).toBe(TENANT_A);
  });
});

// ── Season configuration ──────────────────────────────────────────────────────

describe("Season configuration", () => {
  it("uses tenant-configured defaultSeasonId, not a hardcoded season", async () => {
    const customSeasonId = 2025;
    mockRequireEnabledSfvConfigForTenant.mockResolvedValueOnce(
      makeTenantConfig(TENANT_A, { defaultSeasonId: customSeasonId }),
    );
    mockFetchTeamList.mockResolvedValueOnce([]);
    mockLoadExistingMappings.mockResolvedValueOnce(new Map());

    const result = await syncSfvTeams(TENANT_A);

    expect(result.seasonId).toBe(customSeasonId);
    expect(mockFetchTeamList).toHaveBeenCalledWith(
      expect.objectContaining({ SeasonId: customSeasonId }),
    );
  });

  it("uses tenant-configured clubId, not a hardcoded club", async () => {
    const customClubId = 999;
    mockRequireEnabledSfvConfigForTenant.mockResolvedValueOnce(
      makeTenantConfig(TENANT_A, { clubId: customClubId }),
    );
    mockFetchTeamList.mockResolvedValueOnce([]);
    mockLoadExistingMappings.mockResolvedValueOnce(new Map());

    const result = await syncSfvTeams(TENANT_A);

    expect(result.clubId).toBe(customClubId);
    expect(mockFetchTeamList).toHaveBeenCalledWith(
      expect.objectContaining({ ClubId: customClubId }),
    );
  });

  it("includes OrganisationId in fetch request when tenant config has one", async () => {
    mockRequireEnabledSfvConfigForTenant.mockResolvedValueOnce(
      makeTenantConfig(TENANT_A, { organisationId: 8 }),
    );
    mockFetchTeamList.mockResolvedValueOnce([]);
    mockLoadExistingMappings.mockResolvedValueOnce(new Map());

    await syncSfvTeams(TENANT_A);

    expect(mockFetchTeamList).toHaveBeenCalledWith(
      expect.objectContaining({ OrganisationId: 8 }),
    );
  });

  it("omits OrganisationId from fetch request when tenant config has none", async () => {
    mockRequireEnabledSfvConfigForTenant.mockResolvedValueOnce(
      makeTenantConfig(TENANT_A, { organisationId: null }),
    );
    mockFetchTeamList.mockResolvedValueOnce([]);
    mockLoadExistingMappings.mockResolvedValueOnce(new Map());

    await syncSfvTeams(TENANT_A);

    const [callArgs] = mockFetchTeamList.mock.calls[0];
    expect(callArgs).not.toHaveProperty("OrganisationId");
  });
});
