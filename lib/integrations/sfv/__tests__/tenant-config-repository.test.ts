/**
 * lib/integrations/sfv/__tests__/tenant-config-repository.test.ts
 *
 * Focused unit tests for the TenantSfvConfig repository.
 *
 * All Prisma calls are mocked — no real database access.
 * Tests verify query shapes, result forwarding, and null handling.
 *
 * TEST COVERAGE MAP:
 *
 * findSfvConfigByTenantId:
 *   1.  calls prisma.tenantSfvConfig.findUnique with correct where clause
 *   2.  returns the result from Prisma as-is when record exists
 *   3.  returns null when Prisma returns null (no record)
 *   4.  selects exactly the expected fields (no extras)
 *   5.  does not filter by enabled
 *   6.  returns config when enabled = false (no enabled filter)
 *   7.  forwards Prisma errors (does not swallow)
 *
 * getEnabledSfvConfigByTenantId:
 *   8.  calls prisma.tenantSfvConfig.findFirst with tenantId AND enabled=true
 *   9.  returns the result from Prisma when record exists and is enabled
 *   10. returns null when Prisma returns null (no enabled record)
 *   11. selects exactly the expected fields (no extras)
 *   12. forwards Prisma errors (does not swallow)
 *
 * Tenant isolation:
 *   13. findSfvConfigByTenantId uses exact tenantId — not a range/prefix scan
 *   14. getEnabledSfvConfigByTenantId uses exact tenantId — not a range/prefix scan
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TenantSfvConfig } from "../tenant-config-types";

// ── Mock prisma before importing the repository ───────────────────────────────

const mockFindUnique = vi.fn();
const mockFindFirst = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    tenantSfvConfig: {
      findUnique: mockFindUnique,
      findFirst: mockFindFirst,
    },
  },
}));

const { findSfvConfigByTenantId, getEnabledSfvConfigByTenantId } = await import(
  "../tenant-config-repository"
);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TENANT_ID = "clx-tenant-abc";

function makeConfig(overrides: Partial<TenantSfvConfig> = {}): TenantSfvConfig {
  return {
    id: "clx-sfv-config-1",
    tenantId: TENANT_ID,
    clubId: 483,
    defaultSeasonId: 2027,
    organisationId: null,
    enabled: true,
    lastTeamSyncAt: null,
    lastScheduleSyncAt: null,
    lastMatchDetailSyncAt: null,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── findSfvConfigByTenantId ───────────────────────────────────────────────────

describe("findSfvConfigByTenantId", () => {
  it("1 — calls prisma.tenantSfvConfig.findUnique with correct where clause", async () => {
    mockFindUnique.mockResolvedValueOnce(makeConfig());

    await findSfvConfigByTenantId(TENANT_ID);

    expect(mockFindUnique).toHaveBeenCalledOnce();
    const args = mockFindUnique.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(args.where).toEqual({ tenantId: TENANT_ID });
  });

  it("2 — returns the result from Prisma as-is when record exists", async () => {
    const config = makeConfig({ organisationId: 99 });
    mockFindUnique.mockResolvedValueOnce(config);

    const result = await findSfvConfigByTenantId(TENANT_ID);

    expect(result).toBe(config);
  });

  it("3 — returns null when Prisma returns null (no record)", async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    const result = await findSfvConfigByTenantId(TENANT_ID);

    expect(result).toBeNull();
  });

  it("4 — selects exactly the expected fields (no extras)", async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    await findSfvConfigByTenantId(TENANT_ID);

    const args = mockFindUnique.mock.calls[0][0] as { select: Record<string, boolean> };
    const selectedFields = Object.keys(args.select).sort();
    expect(selectedFields).toEqual(
      [
        "id",
        "tenantId",
        "clubId",
        "defaultSeasonId",
        "organisationId",
        "enabled",
        "lastTeamSyncAt",
        "lastScheduleSyncAt",
        "lastMatchDetailSyncAt",
        "createdAt",
        "updatedAt",
      ].sort(),
    );
  });

  it("5 — does not filter by enabled (returns all configs regardless of enabled state)", async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    await findSfvConfigByTenantId(TENANT_ID);

    const args = mockFindUnique.mock.calls[0][0] as { where: Record<string, unknown> };
    expect("enabled" in args.where).toBe(false);
  });

  it("6 — returns config when enabled = false (no enabled filter applied)", async () => {
    const disabledConfig = makeConfig({ enabled: false });
    mockFindUnique.mockResolvedValueOnce(disabledConfig);

    const result = await findSfvConfigByTenantId(TENANT_ID);

    expect(result?.enabled).toBe(false);
  });

  it("7 — forwards Prisma errors (does not swallow)", async () => {
    const dbError = new Error("DB connection failed");
    mockFindUnique.mockRejectedValueOnce(dbError);

    await expect(findSfvConfigByTenantId(TENANT_ID)).rejects.toThrow("DB connection failed");
  });
});

// ── getEnabledSfvConfigByTenantId ─────────────────────────────────────────────

describe("getEnabledSfvConfigByTenantId", () => {
  it("8 — calls prisma.tenantSfvConfig.findFirst with tenantId AND enabled=true", async () => {
    mockFindFirst.mockResolvedValueOnce(makeConfig());

    await getEnabledSfvConfigByTenantId(TENANT_ID);

    expect(mockFindFirst).toHaveBeenCalledOnce();
    const args = mockFindFirst.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(args.where).toEqual({ tenantId: TENANT_ID, enabled: true });
  });

  it("9 — returns the result from Prisma when record exists and is enabled", async () => {
    const config = makeConfig({ enabled: true });
    mockFindFirst.mockResolvedValueOnce(config);

    const result = await getEnabledSfvConfigByTenantId(TENANT_ID);

    expect(result).toBe(config);
  });

  it("10 — returns null when Prisma returns null (no enabled record)", async () => {
    mockFindFirst.mockResolvedValueOnce(null);

    const result = await getEnabledSfvConfigByTenantId(TENANT_ID);

    expect(result).toBeNull();
  });

  it("11 — selects exactly the expected fields (no extras)", async () => {
    mockFindFirst.mockResolvedValueOnce(null);

    await getEnabledSfvConfigByTenantId(TENANT_ID);

    const args = mockFindFirst.mock.calls[0][0] as { select: Record<string, boolean> };
    const selectedFields = Object.keys(args.select).sort();
    expect(selectedFields).toEqual(
      [
        "id",
        "tenantId",
        "clubId",
        "defaultSeasonId",
        "organisationId",
        "enabled",
        "lastTeamSyncAt",
        "lastScheduleSyncAt",
        "lastMatchDetailSyncAt",
        "createdAt",
        "updatedAt",
      ].sort(),
    );
  });

  it("12 — forwards Prisma errors (does not swallow)", async () => {
    const dbError = new Error("Prisma timeout");
    mockFindFirst.mockRejectedValueOnce(dbError);

    await expect(getEnabledSfvConfigByTenantId(TENANT_ID)).rejects.toThrow("Prisma timeout");
  });
});

// ── Tenant isolation ──────────────────────────────────────────────────────────

describe("Tenant isolation", () => {
  it("13 — findSfvConfigByTenantId uses exact tenantId — not a range/prefix scan", async () => {
    mockFindUnique.mockResolvedValue(null);

    const tenantA = "tenant-A";
    const tenantB = "tenant-B";

    await findSfvConfigByTenantId(tenantA);
    await findSfvConfigByTenantId(tenantB);

    const callA = mockFindUnique.mock.calls[0][0] as { where: Record<string, unknown> };
    const callB = mockFindUnique.mock.calls[1][0] as { where: Record<string, unknown> };
    expect(callA.where["tenantId"]).toBe(tenantA);
    expect(callB.where["tenantId"]).toBe(tenantB);
    expect(callA.where["tenantId"]).not.toBe(tenantB);
  });

  it("14 — getEnabledSfvConfigByTenantId uses exact tenantId — not a range/prefix scan", async () => {
    mockFindFirst.mockResolvedValue(null);

    const tenantA = "tenant-A";
    const tenantB = "tenant-B";

    await getEnabledSfvConfigByTenantId(tenantA);
    await getEnabledSfvConfigByTenantId(tenantB);

    const callA = mockFindFirst.mock.calls[0][0] as { where: Record<string, unknown> };
    const callB = mockFindFirst.mock.calls[1][0] as { where: Record<string, unknown> };
    expect(callA.where["tenantId"]).toBe(tenantA);
    expect(callB.where["tenantId"]).toBe(tenantB);
    expect(callA.where["tenantId"]).not.toBe(tenantB);
  });
});
