/**
 * scripts/__tests__/team-sfv-mapping-04-stale-match-reconciliation.test.ts
 *
 * Unit tests for the TEAM-SFV-MAPPING-04 CLI script's own logic: tenant/
 * season resolution, backup writing, and report printing. All Prisma access
 * is mocked — no real database. See:
 *   - lib/integrations/sfv/sync/__tests__/stale-match-reconciliation.test.ts
 *     for the underlying reconciliation logic itself.
 *   - scripts/__tests__/team-sfv-mapping-04-stale-match-reconciliation.integration.test.ts
 *     for the real-Postgres end-to-end coverage.
 *
 * TEST COVERAGE MAP:
 *   13. Importing this module performs no database calls and does not
 *       invoke main() — mirrors the existing TEAM-SFV-MAPPING-01/03 CLI
 *       entrypoint-gating convention (isCliEntrypoint), verified here by
 *       confirming main() never runs the mocked prisma factory just from
 *       the module import above.
 *   Season resolution:
 *     - explicit --season override always wins, no TenantSfvConfig lookup.
 *     - falls back to TenantSfvConfig.defaultSeasonId when no override given.
 *     - reports a clear error when the tenant does not exist.
 *     - reports a clear error when no TenantSfvConfig exists and no override
 *       was given.
 *   printReport:
 *     - never throws for an all-zero report.
 *     - never throws for a report containing repairable + ambiguous entries.
 *   writeBackupToDisk:
 *     - writes valid JSON containing the report.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

const mockCreatePrismaClient = vi.fn();
vi.mock("../team-sfv-mapping-01-fca-reconciliation", () => ({
  TENANT_KEY: "fc-allschwil",
  detectEnvironment: (url: string | undefined) => {
    if (!url) return "UNKNOWN";
    if (url.includes("prod")) return "PROD";
    if (url.includes("stage")) return "STAGE";
    return "LOCAL";
  },
  maskUrl: (url: string | undefined) => url ?? "(not set)",
  createPrismaClient: (...args: unknown[]) => mockCreatePrismaClient(...args),
  isCliEntrypoint: () => false,
}));

const {
  resolveTenantAndSeason,
  printReport,
  writeBackupToDisk,
  EXECUTE_CONFIRMATION,
} = await import("../team-sfv-mapping-04-stale-match-reconciliation");

import type { StaleMatchReconciliationReport } from "../../lib/integrations/sfv/sync/stale-match-reconciliation";

function makeReport(overrides: Partial<StaleMatchReconciliationReport> = {}): StaleMatchReconciliationReport {
  return {
    tenantId: "tenant-1",
    provider: "SFV",
    seasonId: 2027,
    totalScanned: 0,
    staleRowsFound: 0,
    repairableRows: 0,
    ambiguousRows: 0,
    alreadyCorrectRows: 0,
    affectedExternalTeamIds: [],
    affectedMatchIds: [],
    entries: [],
    ...overrides,
  };
}

describe("module import safety", () => {
  it("13 — importing the CLI module performs no database calls (isCliEntrypoint gates main())", () => {
    // createPrismaClient is only ever called from within main(), which only
    // runs when isCliEntrypoint() returns true. The mock above hard-codes it
    // to false, exactly mirroring how `tsx ... .ts` vs. a test import differ.
    expect(mockCreatePrismaClient).not.toHaveBeenCalled();
  });
});

describe("EXECUTE_CONFIRMATION", () => {
  it("is a non-empty, stable confirmation string", () => {
    expect(EXECUTE_CONFIRMATION).toBe("FIX-SFV-STALE-MATCHES");
  });
});

describe("resolveTenantAndSeason", () => {
  function makePrismaMock(overrides: {
    tenant?: { id: string } | null;
    sfvConfig?: { defaultSeasonId: number } | null;
  } = {}) {
    const tenant = "tenant" in overrides ? overrides.tenant : { id: "tenant-1" };
    const sfvConfig = "sfvConfig" in overrides ? overrides.sfvConfig : { defaultSeasonId: 2027 };
    return {
      tenant: {
        findUnique: vi.fn().mockResolvedValue(tenant),
      },
      tenantSfvConfig: {
        findUnique: vi.fn().mockResolvedValue(sfvConfig),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  }

  it("an explicit --season override wins without querying TenantSfvConfig", async () => {
    const prisma = makePrismaMock();
    const result = await resolveTenantAndSeason(prisma, "fc-allschwil", 2099);

    expect(result).toEqual({ ok: true, tenantId: "tenant-1", seasonId: 2099 });
    expect(prisma.tenantSfvConfig.findUnique).not.toHaveBeenCalled();
  });

  it("falls back to TenantSfvConfig.defaultSeasonId when no override is given", async () => {
    const prisma = makePrismaMock({ sfvConfig: { defaultSeasonId: 2027 } });
    const result = await resolveTenantAndSeason(prisma, "fc-allschwil", undefined);

    expect(result).toEqual({ ok: true, tenantId: "tenant-1", seasonId: 2027 });
  });

  it("reports a clear error when the tenant does not exist", async () => {
    const prisma = makePrismaMock({ tenant: null });
    const result = await resolveTenantAndSeason(prisma, "unknown-tenant", undefined);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("unknown-tenant");
    }
  });

  it("reports a clear error when no TenantSfvConfig exists and no override was given", async () => {
    const prisma = makePrismaMock({ sfvConfig: null });
    const result = await resolveTenantAndSeason(prisma, "fc-allschwil", undefined);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("--season");
    }
  });
});

describe("printReport", () => {
  it("never throws for an all-zero report", () => {
    expect(() => printReport(makeReport())).not.toThrow();
  });

  it("never throws for a report containing repairable + ambiguous entries", () => {
    const report = makeReport({
      totalScanned: 2,
      staleRowsFound: 2,
      repairableRows: 1,
      ambiguousRows: 1,
      affectedExternalTeamIds: [31924, 31925],
      affectedMatchIds: [1, 2],
      entries: [
        {
          mappingId: "m-1",
          eventId: "e-1",
          externalMatchId: 1,
          externalSeasonId: 2027,
          home: { status: "repairable", side: "home", providerTeamId: 31924, canonicalTeamId: "team-a" },
          away: { status: "unmapped", side: "away", providerTeamId: 44001 },
          classification: "repairable",
        },
        {
          mappingId: "m-2",
          eventId: "e-2",
          externalMatchId: 2,
          externalSeasonId: 2027,
          home: {
            status: "conflict",
            side: "home",
            providerTeamId: 31925,
            existingTeamId: "team-wrong",
            candidateTeamId: "team-right",
          },
          away: { status: "already_correct", side: "away", providerTeamId: 44002, canonicalTeamId: "team-b" },
          classification: "ambiguous",
        },
      ],
    });

    expect(() => printReport(report)).not.toThrow();
  });
});

describe("writeBackupToDisk", () => {
  const tmpDirs: string[] = [];

  afterEach(() => {
    for (const dir of tmpDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("writes a valid JSON file containing the report", () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "team-sfv-mapping-04-"));
    tmpDirs.push(outDir);

    const report = makeReport({ repairableRows: 1 });
    const filePath = writeBackupToDisk({ generatedAt: "2027-08-01T00:00:00.000Z", report }, outDir);

    expect(fs.existsSync(filePath)).toBe(true);
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    expect(parsed.report.repairableRows).toBe(1);
  });
});
