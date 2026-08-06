/**
 * Tests for lib/integrations/sfv/sync/tournament-sync.ts
 *
 * This module is intentionally diagnostic-only: see the module-level comment
 * in tournament-sync.ts for the full SFV-TOURNAMENT-01 investigation summary.
 * There is no reliable structured SFV/FVNW source for tournaments, so this
 * function never performs an HTTP request and never mutates the database.
 *
 * Coverage:
 *   A. Tenant resolution and error propagation (not-found / disabled) —
 *      identical contract to every other SFV sync entry point.
 *   B. Tenant isolation — tenantId always flows from the trusted caller
 *      argument into requireEnabledSfvConfigForTenant, never fabricated.
 *   C. Diagnostic result shape — always blocked, always zero counts, always
 *      a PROVIDER_SOURCE_UNAVAILABLE warning and a recommended action.
 *   D. Idempotency — repeated calls for the same tenant produce identical
 *      diagnostic content (only timestamps differ).
 *   E. Provider failure / data-loss safety — this module never fetches or
 *      writes, so a provider outage can never corrupt or duplicate data.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/integrations/sfv/tenant-config-service", () => ({
  requireEnabledSfvConfigForTenant: vi.fn(),
}));

// This module must never touch Prisma or issue a network request. Mocking
// prisma with throwing stubs turns any accidental DB access into a hard
// test failure rather than a silent pass.
vi.mock("@/lib/db/prisma", () => ({
  prisma: new Proxy(
    {},
    {
      get() {
        throw new Error(
          "tournament-sync.ts must never access Prisma — no reliable provider source exists.",
        );
      },
    },
  ),
}));

import { requireEnabledSfvConfigForTenant } from "@/lib/integrations/sfv/tenant-config-service";
import {
  SfvTenantConfigNotFoundError,
  SfvTenantConfigDisabledError,
} from "@/lib/integrations/sfv/tenant-config-types";
import {
  syncSfvTournaments,
  PROVIDER_SOURCE_UNAVAILABLE_CODE,
} from "../tournament-sync";

const TENANT_ID = "tenant-sfv-tournaments";
const OTHER_TENANT_ID = "tenant-other";

const sfvConfig = {
  id: "config-01",
  tenantId: TENANT_ID,
  clubId: 483,
  defaultSeasonId: 2027,
  organisationId: null,
  enabled: true,
  lastTeamSyncAt: null,
  lastScheduleSyncAt: null,
  lastMatchDetailSyncAt: null,
  lastCompetitionSyncAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireEnabledSfvConfigForTenant).mockResolvedValue(sfvConfig as never);
});

// ── A. Tenant resolution and error propagation ────────────────────────────────

describe("A. Tenant configuration resolution", () => {
  it("resolves clubId/seasonId from the tenant's SFV configuration", async () => {
    const result = await syncSfvTournaments(TENANT_ID);

    expect(result.clubId).toBe(sfvConfig.clubId);
    expect(result.seasonId).toBe(sfvConfig.defaultSeasonId);
  });

  it("propagates SfvTenantConfigNotFoundError when no configuration exists", async () => {
    vi.mocked(requireEnabledSfvConfigForTenant).mockRejectedValue(
      new SfvTenantConfigNotFoundError(TENANT_ID),
    );

    await expect(syncSfvTournaments(TENANT_ID)).rejects.toBeInstanceOf(
      SfvTenantConfigNotFoundError,
    );
  });

  it("propagates SfvTenantConfigDisabledError when the integration is disabled", async () => {
    vi.mocked(requireEnabledSfvConfigForTenant).mockRejectedValue(
      new SfvTenantConfigDisabledError(TENANT_ID),
    );

    await expect(syncSfvTournaments(TENANT_ID)).rejects.toBeInstanceOf(
      SfvTenantConfigDisabledError,
    );
  });
});

// ── B. Tenant isolation ────────────────────────────────────────────────────────

describe("B. Tenant isolation", () => {
  it("uses the tenantId argument, never a fabricated or default value", async () => {
    await syncSfvTournaments(TENANT_ID);

    expect(requireEnabledSfvConfigForTenant).toHaveBeenCalledWith(TENANT_ID);
    expect(requireEnabledSfvConfigForTenant).not.toHaveBeenCalledWith(OTHER_TENANT_ID);
  });

  it("returns tenantId in the result matching the caller-supplied tenantId", async () => {
    const result = await syncSfvTournaments(TENANT_ID);

    expect(result.tenantId).toBe(TENANT_ID);
  });

  it("resolves independently per tenant (config for tenant A never leaks to tenant B)", async () => {
    vi.mocked(requireEnabledSfvConfigForTenant).mockImplementation(async (tenantId: string) => {
      if (tenantId === OTHER_TENANT_ID) {
        return { ...sfvConfig, tenantId: OTHER_TENANT_ID, clubId: 999 } as never;
      }
      return sfvConfig as never;
    });

    const resultA = await syncSfvTournaments(TENANT_ID);
    const resultB = await syncSfvTournaments(OTHER_TENANT_ID);

    expect(resultA.clubId).toBe(483);
    expect(resultB.clubId).toBe(999);
    expect(resultA.tenantId).not.toBe(resultB.tenantId);
  });
});

// ── C. Diagnostic result shape ─────────────────────────────────────────────────

describe("C. Diagnostic result shape", () => {
  it("reports blocked: true (no reliable structured provider source exists)", async () => {
    const result = await syncSfvTournaments(TENANT_ID);

    expect(result.blocked).toBe(true);
  });

  it("reports all counts as zero", async () => {
    const result = await syncSfvTournaments(TENANT_ID);

    expect(result.fetched).toBe(0);
    expect(result.created).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.unchanged).toBe(0);
    expect(result.failed).toBe(0);
  });

  it("includes a PROVIDER_SOURCE_UNAVAILABLE warning", async () => {
    const result = await syncSfvTournaments(TENANT_ID);

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].code).toBe(PROVIDER_SOURCE_UNAVAILABLE_CODE);
    expect(result.warnings[0].message.length).toBeGreaterThan(0);
  });

  it("includes a non-empty recommendedAction pointing to manual tournament creation", async () => {
    const result = await syncSfvTournaments(TENANT_ID);

    expect(result.recommendedAction).toContain("Turnier");
  });

  it("returns an empty errors array (no write attempts, so nothing can fail)", async () => {
    const result = await syncSfvTournaments(TENANT_ID);

    expect(result.errors).toEqual([]);
  });

  it("reports source as SFV", async () => {
    const result = await syncSfvTournaments(TENANT_ID);

    expect(result.source).toBe("SFV");
  });

  it("never leaks credentials or provider payload material in the diagnostic message", async () => {
    const result = await syncSfvTournaments(TENANT_ID);
    const serialized = JSON.stringify(result);

    expect(serialized).not.toMatch(/bearer/i);
    expect(serialized).not.toContain("applicationKey");
    expect(serialized).not.toContain("applicationPass");
    expect(serialized).not.toContain("X-User-Token");
  });
});

// ── D. Idempotency ─────────────────────────────────────────────────────────────

describe("D. Idempotency", () => {
  it("running twice for the same tenant produces identical diagnostic content", async () => {
    const first = await syncSfvTournaments(TENANT_ID);
    const second = await syncSfvTournaments(TENANT_ID);

    const contentFields = [
      "tenantId",
      "source",
      "clubId",
      "seasonId",
      "fetched",
      "created",
      "updated",
      "unchanged",
      "failed",
      "blocked",
      "warnings",
      "recommendedAction",
      "errors",
    ] as const;

    for (const field of contentFields) {
      expect(first[field]).toEqual(second[field]);
    }
  });

  it("running the diagnostic sync repeatedly never changes clubId/seasonId output", async () => {
    const results = await Promise.all([
      syncSfvTournaments(TENANT_ID),
      syncSfvTournaments(TENANT_ID),
      syncSfvTournaments(TENANT_ID),
    ]);

    for (const result of results) {
      expect(result.clubId).toBe(sfvConfig.clubId);
      expect(result.seasonId).toBe(sfvConfig.defaultSeasonId);
      expect(result.blocked).toBe(true);
    }
  });
});

// ── E. Provider failure / data-loss safety ────────────────────────────────────

describe("E. No network access, no data loss possible", () => {
  it("never calls fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await syncSfvTournaments(TENANT_ID);

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("never touches Prisma (verified via throwing mock)", async () => {
    // If tournament-sync.ts ever imports/uses `prisma`, the mocked module
    // above throws immediately, failing this test.
    await expect(syncSfvTournaments(TENANT_ID)).resolves.toBeDefined();
  });
});
