/**
 * lib/integrations/sfv/sync/__tests__/auto-sync.test.ts
 *
 * Unit tests for the automatic (cron) SFV sync orchestrator.
 * SFV-MATCH-SYNC-HOTFIX-01 — Phase B.
 *
 * All dependencies (repository lock functions, syncSfvSchedule) are mocked —
 * no real database or SFV network access.
 *
 * TEST COVERAGE MAP:
 *   1.  Syncs every tenant returned by listEnabledSfvConfigTenantIds.
 *   2.  Calls the canonical syncSfvSchedule() — no second implementation.
 *   3.  Skips a tenant when the lock cannot be claimed (already running).
 *   4.  A skipped tenant does not call syncSfvSchedule.
 *   5.  Releases the lock after a successful sync.
 *   6.  Releases the lock after a failed sync (isolation — must not stay locked).
 *   7.  One tenant's failure does not prevent other tenants from syncing.
 *   8.  A tenant that is never locked (skipped) never has its lock released.
 *   9.  Failure is recorded with a safe code + message (no raw error object leak beyond message).
 *   10. Empty tenant list produces an all-zero summary.
 *   11. Summary counts (synced/skipped/failed) match the per-tenant outcomes.
 *   12. Tenants are processed sequentially (not concurrently) — call order.
 *   13. Custom staleAfterMs is forwarded to claimSfvScheduleSyncLock.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SfvScheduleSyncResult } from "../schedule-types";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockListEnabledSfvConfigTenantIds = vi.fn();
const mockClaimSfvScheduleSyncLock = vi.fn();
const mockReleaseSfvScheduleSyncLock = vi.fn();
const mockSyncSfvSchedule = vi.fn();

vi.mock("../../tenant-config-repository", () => ({
  listEnabledSfvConfigTenantIds: mockListEnabledSfvConfigTenantIds,
  claimSfvScheduleSyncLock: mockClaimSfvScheduleSyncLock,
  releaseSfvScheduleSyncLock: mockReleaseSfvScheduleSyncLock,
}));

vi.mock("../schedule", () => ({
  syncSfvSchedule: mockSyncSfvSchedule,
}));

const { runAutomaticSfvScheduleSync } = await import("../auto-sync");

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeScheduleResult(tenantId: string, overrides: Partial<SfvScheduleSyncResult> = {}): SfvScheduleSyncResult {
  return {
    startedAt: "2026-08-07T10:00:00.000Z",
    finishedAt: "2026-08-07T10:00:01.000Z",
    durationMs: 1000,
    tenantId,
    source: "SFV",
    clubId: 483,
    seasonId: 2027,
    dateFrom: "2026-07-08",
    dateTo: "2026-11-05",
    fetched: 1,
    created: 0,
    updated: 1,
    unchanged: 0,
    failed: 0,
    scoresUpdated: 0,
    kickoffChanges: 1,
    statusChanges: 0,
    unresolvedLocalTeamRefs: 0,
    externalOpponents: 1,
    errors: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockClaimSfvScheduleSyncLock.mockResolvedValue(true);
  mockReleaseSfvScheduleSyncLock.mockResolvedValue(undefined);
});

// ── Basic orchestration ───────────────────────────────────────────────────────

describe("runAutomaticSfvScheduleSync — basic orchestration", () => {
  it("1 — syncs every tenant returned by listEnabledSfvConfigTenantIds", async () => {
    mockListEnabledSfvConfigTenantIds.mockResolvedValue(["tenant-A", "tenant-B"]);
    mockSyncSfvSchedule.mockImplementation((tenantId: string) =>
      Promise.resolve(makeScheduleResult(tenantId)),
    );

    const summary = await runAutomaticSfvScheduleSync();

    expect(mockSyncSfvSchedule).toHaveBeenCalledTimes(2);
    expect(mockSyncSfvSchedule).toHaveBeenCalledWith("tenant-A");
    expect(mockSyncSfvSchedule).toHaveBeenCalledWith("tenant-B");
    expect(summary.tenantsDiscovered).toBe(2);
    expect(summary.tenantsSynced).toBe(2);
  });

  it("2 — calls the canonical syncSfvSchedule() (no second sync implementation)", async () => {
    mockListEnabledSfvConfigTenantIds.mockResolvedValue(["tenant-A"]);
    mockSyncSfvSchedule.mockResolvedValue(makeScheduleResult("tenant-A"));

    await runAutomaticSfvScheduleSync();

    expect(mockSyncSfvSchedule).toHaveBeenCalledOnce();
  });

  it("10 — empty tenant list produces an all-zero summary", async () => {
    mockListEnabledSfvConfigTenantIds.mockResolvedValue([]);

    const summary = await runAutomaticSfvScheduleSync();

    expect(summary.tenantsDiscovered).toBe(0);
    expect(summary.tenantsSynced).toBe(0);
    expect(summary.tenantsSkippedLocked).toBe(0);
    expect(summary.tenantsFailed).toBe(0);
    expect(summary.tenants).toEqual([]);
    expect(mockSyncSfvSchedule).not.toHaveBeenCalled();
  });
});

// ── Overlap protection ────────────────────────────────────────────────────────

describe("runAutomaticSfvScheduleSync — overlap protection", () => {
  it("3 — skips a tenant when the lock cannot be claimed", async () => {
    mockListEnabledSfvConfigTenantIds.mockResolvedValue(["tenant-A"]);
    mockClaimSfvScheduleSyncLock.mockResolvedValueOnce(false);

    const summary = await runAutomaticSfvScheduleSync();

    expect(summary.tenantsSkippedLocked).toBe(1);
    expect(summary.tenants).toEqual([{ tenantId: "tenant-A", outcome: "skipped_locked" }]);
  });

  it("4 — a skipped tenant does not call syncSfvSchedule", async () => {
    mockListEnabledSfvConfigTenantIds.mockResolvedValue(["tenant-A"]);
    mockClaimSfvScheduleSyncLock.mockResolvedValueOnce(false);

    await runAutomaticSfvScheduleSync();

    expect(mockSyncSfvSchedule).not.toHaveBeenCalled();
  });

  it("8 — a tenant that is skipped (lock not claimed) never has its lock released", async () => {
    mockListEnabledSfvConfigTenantIds.mockResolvedValue(["tenant-A"]);
    mockClaimSfvScheduleSyncLock.mockResolvedValueOnce(false);

    await runAutomaticSfvScheduleSync();

    expect(mockReleaseSfvScheduleSyncLock).not.toHaveBeenCalled();
  });

  it("13 — custom staleAfterMs is forwarded to claimSfvScheduleSyncLock", async () => {
    mockListEnabledSfvConfigTenantIds.mockResolvedValue(["tenant-A"]);
    mockSyncSfvSchedule.mockResolvedValue(makeScheduleResult("tenant-A"));

    await runAutomaticSfvScheduleSync(5 * 60 * 1000);

    const [, , staleAfterMsArg] = mockClaimSfvScheduleSyncLock.mock.calls[0];
    expect(staleAfterMsArg).toBe(5 * 60 * 1000);
  });
});

// ── Lock release + failure isolation ─────────────────────────────────────────

describe("runAutomaticSfvScheduleSync — lock release and failure isolation", () => {
  it("5 — releases the lock after a successful sync", async () => {
    mockListEnabledSfvConfigTenantIds.mockResolvedValue(["tenant-A"]);
    mockSyncSfvSchedule.mockResolvedValue(makeScheduleResult("tenant-A"));

    await runAutomaticSfvScheduleSync();

    expect(mockReleaseSfvScheduleSyncLock).toHaveBeenCalledWith("tenant-A");
  });

  it("6 — releases the lock even after a failed sync (must not stay locked)", async () => {
    mockListEnabledSfvConfigTenantIds.mockResolvedValue(["tenant-A"]);
    mockSyncSfvSchedule.mockRejectedValueOnce(new Error("SFV_UNAVAILABLE"));

    await runAutomaticSfvScheduleSync();

    expect(mockReleaseSfvScheduleSyncLock).toHaveBeenCalledWith("tenant-A");
  });

  it("7 — one tenant's failure does not prevent other tenants from syncing", async () => {
    mockListEnabledSfvConfigTenantIds.mockResolvedValue(["tenant-A", "tenant-B"]);
    mockSyncSfvSchedule
      .mockRejectedValueOnce(new Error("SFV_UNAVAILABLE"))
      .mockResolvedValueOnce(makeScheduleResult("tenant-B"));

    const summary = await runAutomaticSfvScheduleSync();

    expect(summary.tenantsFailed).toBe(1);
    expect(summary.tenantsSynced).toBe(1);
    expect(mockSyncSfvSchedule).toHaveBeenCalledTimes(2);
  });

  it("9 — failure is recorded with a safe code + message", async () => {
    mockListEnabledSfvConfigTenantIds.mockResolvedValue(["tenant-A"]);
    const err = new Error("SFV token request rejected: 401 Unauthorized.");
    err.name = "SfvAuthError";
    mockSyncSfvSchedule.mockRejectedValueOnce(err);

    const summary = await runAutomaticSfvScheduleSync();

    expect(summary.tenants).toEqual([
      {
        tenantId: "tenant-A",
        outcome: "failed",
        code: "SfvAuthError",
        message: "SFV token request rejected: 401 Unauthorized.",
      },
    ]);
  });

  it("does not crash when a non-Error value is thrown", async () => {
    mockListEnabledSfvConfigTenantIds.mockResolvedValue(["tenant-A"]);
    mockSyncSfvSchedule.mockRejectedValueOnce("plain string failure");

    const summary = await runAutomaticSfvScheduleSync();

    expect(summary.tenantsFailed).toBe(1);
    expect(summary.tenants[0]).toMatchObject({ outcome: "failed" });
  });

  it("still releases the lock when releaseSfvScheduleSyncLock itself rejects (best-effort)", async () => {
    mockListEnabledSfvConfigTenantIds.mockResolvedValue(["tenant-A"]);
    mockSyncSfvSchedule.mockResolvedValue(makeScheduleResult("tenant-A"));
    mockReleaseSfvScheduleSyncLock.mockRejectedValueOnce(new Error("DB unavailable"));

    await expect(runAutomaticSfvScheduleSync()).resolves.toBeDefined();
  });
});

// ── Summary shape + ordering ──────────────────────────────────────────────────

describe("runAutomaticSfvScheduleSync — summary shape and ordering", () => {
  it("11 — summary counts match the per-tenant outcomes", async () => {
    mockListEnabledSfvConfigTenantIds.mockResolvedValue(["tenant-A", "tenant-B", "tenant-C"]);
    mockClaimSfvScheduleSyncLock
      .mockResolvedValueOnce(true) // A: claimed
      .mockResolvedValueOnce(false) // B: skipped (locked)
      .mockResolvedValueOnce(true); // C: claimed
    mockSyncSfvSchedule
      .mockResolvedValueOnce(makeScheduleResult("tenant-A"))
      .mockRejectedValueOnce(new Error("boom"));

    const summary = await runAutomaticSfvScheduleSync();

    expect(summary.tenantsSynced).toBe(1);
    expect(summary.tenantsSkippedLocked).toBe(1);
    expect(summary.tenantsFailed).toBe(1);
    expect(summary.tenants.map((t) => t.outcome)).toEqual(["synced", "skipped_locked", "failed"]);
  });

  it("12 — tenants are processed sequentially, not concurrently", async () => {
    mockListEnabledSfvConfigTenantIds.mockResolvedValue(["tenant-A", "tenant-B"]);
    const callOrder: string[] = [];
    mockSyncSfvSchedule.mockImplementation(async (tenantId: string) => {
      callOrder.push(`start:${tenantId}`);
      await new Promise((resolve) => setTimeout(resolve, 5));
      callOrder.push(`end:${tenantId}`);
      return makeScheduleResult(tenantId);
    });

    await runAutomaticSfvScheduleSync();

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
