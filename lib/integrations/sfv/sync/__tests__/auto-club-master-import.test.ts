/**
 * lib/integrations/sfv/sync/__tests__/auto-club-master-import.test.ts
 *
 * Unit tests for the automatic (cron) SFV club master import orchestrator.
 * CLUB-DIRECTORY-05-C1.
 *
 * All dependencies (tenant discovery, runSfvClubMasterImport) are mocked —
 * no real database or SFV network access.
 *
 * TEST COVERAGE MAP:
 *   1.  Imports every tenant returned by listEnabledSfvConfigTenantIds.
 *   2.  Calls the canonical runSfvClubMasterImport() — no second implementation.
 *   3.  One tenant's failure does not prevent other tenants from importing.
 *   4.  Failure is recorded with a safe code + message (no raw error object leak).
 *   5.  Empty tenant list produces an all-zero summary.
 *   6.  Summary counts (synced/failed) match the per-tenant outcomes.
 *   7.  Tenants are processed sequentially (not concurrently) — call order.
 *   8.  Does not crash when a non-Error value is thrown.
 *   9.  Runs exactly once per tenant per invocation (never twice).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SfvClubMasterImportResult } from "../club-master-import";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockListEnabledSfvConfigTenantIds = vi.fn();
const mockRunSfvClubMasterImport = vi.fn();

vi.mock("../../tenant-config-repository", () => ({
  listEnabledSfvConfigTenantIds: mockListEnabledSfvConfigTenantIds,
}));

vi.mock("../club-master-import", () => ({
  runSfvClubMasterImport: mockRunSfvClubMasterImport,
}));

const { runAutomaticSfvClubMasterImport } = await import("../auto-club-master-import");

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeClubMasterImportResult(
  tenantId: string,
  overrides: Partial<SfvClubMasterImportResult> = {},
): SfvClubMasterImportResult {
  return {
    startedAt: "2026-08-08T02:00:00.000Z",
    finishedAt: "2026-08-08T02:00:01.000Z",
    durationMs: 1000,
    tenantId,
    source: "SFV",
    clubId: 483,
    seasonId: 2027,
    rankingRowsFetched: 20,
    candidateClubs: 5,
    created: 2,
    updated: 3,
    failed: 0,
    errors: [],
    coverageDescription: "Quelle: SFV-Rangliste (GET /api/club/ranking).",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Basic orchestration ───────────────────────────────────────────────────────

describe("runAutomaticSfvClubMasterImport — basic orchestration", () => {
  it("1 — imports every tenant returned by listEnabledSfvConfigTenantIds", async () => {
    mockListEnabledSfvConfigTenantIds.mockResolvedValue(["tenant-A", "tenant-B"]);
    mockRunSfvClubMasterImport.mockImplementation((tenantId: string) =>
      Promise.resolve(makeClubMasterImportResult(tenantId)),
    );

    const summary = await runAutomaticSfvClubMasterImport();

    expect(mockRunSfvClubMasterImport).toHaveBeenCalledTimes(2);
    expect(mockRunSfvClubMasterImport).toHaveBeenCalledWith("tenant-A");
    expect(mockRunSfvClubMasterImport).toHaveBeenCalledWith("tenant-B");
    expect(summary.tenantsDiscovered).toBe(2);
    expect(summary.tenantsSynced).toBe(2);
  });

  it("2 — calls the canonical runSfvClubMasterImport() (no second import implementation)", async () => {
    mockListEnabledSfvConfigTenantIds.mockResolvedValue(["tenant-A"]);
    mockRunSfvClubMasterImport.mockResolvedValue(makeClubMasterImportResult("tenant-A"));

    await runAutomaticSfvClubMasterImport();

    expect(mockRunSfvClubMasterImport).toHaveBeenCalledOnce();
  });

  it("5 — empty tenant list produces an all-zero summary", async () => {
    mockListEnabledSfvConfigTenantIds.mockResolvedValue([]);

    const summary = await runAutomaticSfvClubMasterImport();

    expect(summary.tenantsDiscovered).toBe(0);
    expect(summary.tenantsSynced).toBe(0);
    expect(summary.tenantsFailed).toBe(0);
    expect(summary.tenants).toEqual([]);
    expect(mockRunSfvClubMasterImport).not.toHaveBeenCalled();
  });

  it("9 — runs exactly once per tenant per invocation", async () => {
    mockListEnabledSfvConfigTenantIds.mockResolvedValue(["tenant-A"]);
    mockRunSfvClubMasterImport.mockResolvedValue(makeClubMasterImportResult("tenant-A"));

    await runAutomaticSfvClubMasterImport();

    expect(mockRunSfvClubMasterImport).toHaveBeenCalledTimes(1);
  });
});

// ── Failure isolation ─────────────────────────────────────────────────────────

describe("runAutomaticSfvClubMasterImport — failure isolation", () => {
  it("3 — one tenant's failure does not prevent other tenants from importing", async () => {
    mockListEnabledSfvConfigTenantIds.mockResolvedValue(["tenant-A", "tenant-B"]);
    mockRunSfvClubMasterImport
      .mockRejectedValueOnce(new Error("SFV_UNAVAILABLE"))
      .mockResolvedValueOnce(makeClubMasterImportResult("tenant-B"));

    const summary = await runAutomaticSfvClubMasterImport();

    expect(summary.tenantsFailed).toBe(1);
    expect(summary.tenantsSynced).toBe(1);
    expect(mockRunSfvClubMasterImport).toHaveBeenCalledTimes(2);
  });

  it("4 — failure is recorded with a safe code + message", async () => {
    mockListEnabledSfvConfigTenantIds.mockResolvedValue(["tenant-A"]);
    const err = new Error("SFV token request rejected: 401 Unauthorized.");
    err.name = "SfvAuthError";
    mockRunSfvClubMasterImport.mockRejectedValueOnce(err);

    const summary = await runAutomaticSfvClubMasterImport();

    expect(summary.tenants).toEqual([
      {
        tenantId: "tenant-A",
        outcome: "failed",
        code: "SfvAuthError",
        message: "SFV token request rejected: 401 Unauthorized.",
      },
    ]);
  });

  it("8 — does not crash when a non-Error value is thrown", async () => {
    mockListEnabledSfvConfigTenantIds.mockResolvedValue(["tenant-A"]);
    mockRunSfvClubMasterImport.mockRejectedValueOnce("plain string failure");

    const summary = await runAutomaticSfvClubMasterImport();

    expect(summary.tenantsFailed).toBe(1);
    expect(summary.tenants[0]).toMatchObject({ outcome: "failed" });
  });
});

// ── Summary shape + ordering ──────────────────────────────────────────────────

describe("runAutomaticSfvClubMasterImport — summary shape and ordering", () => {
  it("6 — summary counts match the per-tenant outcomes", async () => {
    mockListEnabledSfvConfigTenantIds.mockResolvedValue(["tenant-A", "tenant-B", "tenant-C"]);
    mockRunSfvClubMasterImport
      .mockResolvedValueOnce(makeClubMasterImportResult("tenant-A"))
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(makeClubMasterImportResult("tenant-C"));

    const summary = await runAutomaticSfvClubMasterImport();

    expect(summary.tenantsSynced).toBe(2);
    expect(summary.tenantsFailed).toBe(1);
    expect(summary.tenants.map((t) => t.outcome)).toEqual(["synced", "failed", "synced"]);
  });

  it("7 — tenants are processed sequentially, not concurrently", async () => {
    mockListEnabledSfvConfigTenantIds.mockResolvedValue(["tenant-A", "tenant-B"]);
    const callOrder: string[] = [];
    mockRunSfvClubMasterImport.mockImplementation(async (tenantId: string) => {
      callOrder.push(`start:${tenantId}`);
      await new Promise((resolve) => setTimeout(resolve, 5));
      callOrder.push(`end:${tenantId}`);
      return makeClubMasterImportResult(tenantId);
    });

    await runAutomaticSfvClubMasterImport();

    // If tenants ran concurrently, both "start" entries would appear before
    // either "end" entry. Sequential processing guarantees A fully finishes
    // before B starts.
    expect(callOrder).toEqual([
      "start:tenant-A",
      "end:tenant-A",
      "start:tenant-B",
      "end:tenant-B",
    ]);
  });
});
