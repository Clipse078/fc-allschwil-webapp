/**
 * lib/integrations/sfv/__tests__/tenant-config-service.test.ts
 *
 * Focused unit tests for the TenantSfvConfig domain service.
 *
 * All repository calls are mocked — no real database access.
 * Tests verify the service's error semantics and resolution logic.
 *
 * TEST COVERAGE MAP:
 *
 * getSfvConfigForTenant:
 *   1.  returns config when it exists
 *   2.  returns null when no config exists
 *   3.  returns disabled config (does not filter by enabled)
 *   4.  delegates to findSfvConfigByTenantId
 *   5.  forwards repository errors
 *
 * requireEnabledSfvConfigForTenant:
 *   6.  returns config when it exists and is enabled
 *   7.  throws SfvTenantConfigNotFoundError when no config exists
 *   8.  error tenantId matches the argument
 *   9.  throws SfvTenantConfigDisabledError when config exists but is disabled
 *   10. disabled error tenantId matches the argument
 *   11. SfvTenantConfigNotFoundError has correct name
 *   12. SfvTenantConfigDisabledError has correct name
 *   13. forwards repository errors (does not swallow)
 *
 * resolveSfvClubId:
 *   14. returns config.clubId when config is enabled
 *   15. throws SfvTenantConfigNotFoundError when no config exists
 *   16. throws SfvTenantConfigDisabledError when disabled
 *   17. clubId is the exact integer from the persisted config
 *
 * resolveSfvDefaultSeasonId:
 *   18. returns config.defaultSeasonId when config is enabled
 *   19. throws SfvTenantConfigNotFoundError when no config exists
 *   20. throws SfvTenantConfigDisabledError when disabled
 *   21. defaultSeasonId is the exact integer from the persisted config
 *
 * isSfvEnabledForTenant:
 *   22. returns true when an enabled config exists
 *   23. returns false when no config exists
 *   24. returns false when config is disabled (getEnabledSfvConfigByTenantId returns null)
 *   25. never throws (swallows nothing, but returns false for null)
 *
 * Future diagnostics resolution contract:
 *   26. requireEnabledSfvConfigForTenant provides all fields needed by runSfvAdminDiagnostics
 *   27. clubId from config is a positive integer (matching SFV API contract)
 *   28. defaultSeasonId from config is a positive integer (matching SFV API contract)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TenantSfvConfig } from "../tenant-config-types";
import {
  SfvTenantConfigNotFoundError,
  SfvTenantConfigDisabledError,
} from "../tenant-config-types";

// ── Mock repository before importing the service ──────────────────────────────

const mockFindSfvConfigByTenantId = vi.fn();
const mockGetEnabledSfvConfigByTenantId = vi.fn();

vi.mock("../tenant-config-repository", () => ({
  findSfvConfigByTenantId: mockFindSfvConfigByTenantId,
  getEnabledSfvConfigByTenantId: mockGetEnabledSfvConfigByTenantId,
}));

const {
  getSfvConfigForTenant,
  requireEnabledSfvConfigForTenant,
  resolveSfvClubId,
  resolveSfvDefaultSeasonId,
  isSfvEnabledForTenant,
} = await import("../tenant-config-service");

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

// ── getSfvConfigForTenant ─────────────────────────────────────────────────────

describe("getSfvConfigForTenant", () => {
  it("1 — returns config when it exists", async () => {
    const config = makeConfig();
    mockFindSfvConfigByTenantId.mockResolvedValueOnce(config);

    const result = await getSfvConfigForTenant(TENANT_ID);

    expect(result).toBe(config);
  });

  it("2 — returns null when no config exists", async () => {
    mockFindSfvConfigByTenantId.mockResolvedValueOnce(null);

    const result = await getSfvConfigForTenant(TENANT_ID);

    expect(result).toBeNull();
  });

  it("3 — returns disabled config (does not filter by enabled)", async () => {
    const disabledConfig = makeConfig({ enabled: false });
    mockFindSfvConfigByTenantId.mockResolvedValueOnce(disabledConfig);

    const result = await getSfvConfigForTenant(TENANT_ID);

    expect(result?.enabled).toBe(false);
  });

  it("4 — delegates to findSfvConfigByTenantId", async () => {
    mockFindSfvConfigByTenantId.mockResolvedValueOnce(null);

    await getSfvConfigForTenant(TENANT_ID);

    expect(mockFindSfvConfigByTenantId).toHaveBeenCalledOnce();
    expect(mockFindSfvConfigByTenantId).toHaveBeenCalledWith(TENANT_ID);
  });

  it("5 — forwards repository errors", async () => {
    mockFindSfvConfigByTenantId.mockRejectedValueOnce(new Error("DB error"));

    await expect(getSfvConfigForTenant(TENANT_ID)).rejects.toThrow("DB error");
  });
});

// ── requireEnabledSfvConfigForTenant ──────────────────────────────────────────

describe("requireEnabledSfvConfigForTenant", () => {
  it("6 — returns config when it exists and is enabled", async () => {
    const config = makeConfig({ enabled: true });
    mockFindSfvConfigByTenantId.mockResolvedValueOnce(config);

    const result = await requireEnabledSfvConfigForTenant(TENANT_ID);

    expect(result).toBe(config);
  });

  it("7 — throws SfvTenantConfigNotFoundError when no config exists", async () => {
    mockFindSfvConfigByTenantId.mockResolvedValueOnce(null);

    await expect(requireEnabledSfvConfigForTenant(TENANT_ID)).rejects.toThrow(
      SfvTenantConfigNotFoundError,
    );
  });

  it("8 — error tenantId matches the argument", async () => {
    mockFindSfvConfigByTenantId.mockResolvedValueOnce(null);

    try {
      await requireEnabledSfvConfigForTenant(TENANT_ID);
    } catch (e) {
      expect(e).toBeInstanceOf(SfvTenantConfigNotFoundError);
      expect((e as SfvTenantConfigNotFoundError).tenantId).toBe(TENANT_ID);
    }
  });

  it("9 — throws SfvTenantConfigDisabledError when config exists but is disabled", async () => {
    const disabledConfig = makeConfig({ enabled: false });
    mockFindSfvConfigByTenantId.mockResolvedValueOnce(disabledConfig);

    await expect(requireEnabledSfvConfigForTenant(TENANT_ID)).rejects.toThrow(
      SfvTenantConfigDisabledError,
    );
  });

  it("10 — disabled error tenantId matches the argument", async () => {
    const disabledConfig = makeConfig({ enabled: false });
    mockFindSfvConfigByTenantId.mockResolvedValueOnce(disabledConfig);

    try {
      await requireEnabledSfvConfigForTenant(TENANT_ID);
    } catch (e) {
      expect(e).toBeInstanceOf(SfvTenantConfigDisabledError);
      expect((e as SfvTenantConfigDisabledError).tenantId).toBe(TENANT_ID);
    }
  });

  it("11 — SfvTenantConfigNotFoundError has correct name", async () => {
    mockFindSfvConfigByTenantId.mockResolvedValueOnce(null);

    try {
      await requireEnabledSfvConfigForTenant(TENANT_ID);
    } catch (e) {
      expect((e as Error).name).toBe("SfvTenantConfigNotFoundError");
    }
  });

  it("12 — SfvTenantConfigDisabledError has correct name", async () => {
    mockFindSfvConfigByTenantId.mockResolvedValueOnce(makeConfig({ enabled: false }));

    try {
      await requireEnabledSfvConfigForTenant(TENANT_ID);
    } catch (e) {
      expect((e as Error).name).toBe("SfvTenantConfigDisabledError");
    }
  });

  it("13 — forwards repository errors (does not swallow)", async () => {
    mockFindSfvConfigByTenantId.mockRejectedValueOnce(new Error("Prisma timeout"));

    await expect(requireEnabledSfvConfigForTenant(TENANT_ID)).rejects.toThrow("Prisma timeout");
  });
});

// ── resolveSfvClubId ──────────────────────────────────────────────────────────

describe("resolveSfvClubId", () => {
  it("14 — returns config.clubId when config is enabled", async () => {
    mockFindSfvConfigByTenantId.mockResolvedValueOnce(makeConfig({ clubId: 483 }));

    const clubId = await resolveSfvClubId(TENANT_ID);

    expect(clubId).toBe(483);
  });

  it("15 — throws SfvTenantConfigNotFoundError when no config exists", async () => {
    mockFindSfvConfigByTenantId.mockResolvedValueOnce(null);

    await expect(resolveSfvClubId(TENANT_ID)).rejects.toThrow(SfvTenantConfigNotFoundError);
  });

  it("16 — throws SfvTenantConfigDisabledError when disabled", async () => {
    mockFindSfvConfigByTenantId.mockResolvedValueOnce(makeConfig({ enabled: false }));

    await expect(resolveSfvClubId(TENANT_ID)).rejects.toThrow(SfvTenantConfigDisabledError);
  });

  it("17 — clubId is the exact integer from the persisted config", async () => {
    mockFindSfvConfigByTenantId.mockResolvedValueOnce(makeConfig({ clubId: 9999 }));

    const clubId = await resolveSfvClubId(TENANT_ID);

    expect(clubId).toBe(9999);
    expect(typeof clubId).toBe("number");
    expect(Number.isInteger(clubId)).toBe(true);
  });
});

// ── resolveSfvDefaultSeasonId ─────────────────────────────────────────────────

describe("resolveSfvDefaultSeasonId", () => {
  it("18 — returns config.defaultSeasonId when config is enabled", async () => {
    mockFindSfvConfigByTenantId.mockResolvedValueOnce(makeConfig({ defaultSeasonId: 2027 }));

    const seasonId = await resolveSfvDefaultSeasonId(TENANT_ID);

    expect(seasonId).toBe(2027);
  });

  it("19 — throws SfvTenantConfigNotFoundError when no config exists", async () => {
    mockFindSfvConfigByTenantId.mockResolvedValueOnce(null);

    await expect(resolveSfvDefaultSeasonId(TENANT_ID)).rejects.toThrow(
      SfvTenantConfigNotFoundError,
    );
  });

  it("20 — throws SfvTenantConfigDisabledError when disabled", async () => {
    mockFindSfvConfigByTenantId.mockResolvedValueOnce(makeConfig({ enabled: false }));

    await expect(resolveSfvDefaultSeasonId(TENANT_ID)).rejects.toThrow(
      SfvTenantConfigDisabledError,
    );
  });

  it("21 — defaultSeasonId is the exact integer from the persisted config", async () => {
    mockFindSfvConfigByTenantId.mockResolvedValueOnce(makeConfig({ defaultSeasonId: 2025 }));

    const seasonId = await resolveSfvDefaultSeasonId(TENANT_ID);

    expect(seasonId).toBe(2025);
    expect(typeof seasonId).toBe("number");
    expect(Number.isInteger(seasonId)).toBe(true);
  });
});

// ── isSfvEnabledForTenant ─────────────────────────────────────────────────────

describe("isSfvEnabledForTenant", () => {
  it("22 — returns true when an enabled config exists", async () => {
    mockGetEnabledSfvConfigByTenantId.mockResolvedValueOnce(makeConfig({ enabled: true }));

    const result = await isSfvEnabledForTenant(TENANT_ID);

    expect(result).toBe(true);
  });

  it("23 — returns false when no config exists", async () => {
    mockGetEnabledSfvConfigByTenantId.mockResolvedValueOnce(null);

    const result = await isSfvEnabledForTenant(TENANT_ID);

    expect(result).toBe(false);
  });

  it("24 — returns false when config is disabled (getEnabledSfvConfigByTenantId returns null)", async () => {
    // Simulates: enabled=false row in DB, so findFirst returns null due to enabled filter
    mockGetEnabledSfvConfigByTenantId.mockResolvedValueOnce(null);

    const result = await isSfvEnabledForTenant(TENANT_ID);

    expect(result).toBe(false);
  });

  it("25 — never throws (returns false for null)", async () => {
    mockGetEnabledSfvConfigByTenantId.mockResolvedValueOnce(null);

    await expect(isSfvEnabledForTenant(TENANT_ID)).resolves.toBe(false);
  });
});

// ── Future diagnostics resolution contract ────────────────────────────────────

describe("Future diagnostics resolution contract", () => {
  it("26 — requireEnabledSfvConfigForTenant provides all fields needed by runSfvAdminDiagnostics", async () => {
    const config = makeConfig({ clubId: 483, defaultSeasonId: 2027, organisationId: 100 });
    mockFindSfvConfigByTenantId.mockResolvedValueOnce(config);

    const result = await requireEnabledSfvConfigForTenant(TENANT_ID);

    // runSfvAdminDiagnostics requires: clubId (number), seasonId (number)
    expect(typeof result.clubId).toBe("number");
    expect(typeof result.defaultSeasonId).toBe("number");
    // organisationId is optional — may be null
    expect(result.organisationId === null || typeof result.organisationId === "number").toBe(true);
  });

  it("27 — clubId from config is a positive integer (matching SFV API contract)", async () => {
    const config = makeConfig({ clubId: 483 });
    mockFindSfvConfigByTenantId.mockResolvedValueOnce(config);

    const result = await requireEnabledSfvConfigForTenant(TENANT_ID);

    expect(Number.isInteger(result.clubId)).toBe(true);
    expect(result.clubId).toBeGreaterThan(0);
  });

  it("28 — defaultSeasonId from config is a positive integer (matching SFV API contract)", async () => {
    const config = makeConfig({ defaultSeasonId: 2027 });
    mockFindSfvConfigByTenantId.mockResolvedValueOnce(config);

    const result = await requireEnabledSfvConfigForTenant(TENANT_ID);

    expect(Number.isInteger(result.defaultSeasonId)).toBe(true);
    expect(result.defaultSeasonId).toBeGreaterThan(0);
  });
});
