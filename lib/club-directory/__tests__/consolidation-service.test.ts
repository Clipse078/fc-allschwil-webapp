/**
 * lib/club-directory/__tests__/consolidation-service.test.ts
 *
 * CLUB-DIRECTORY-02C — unit tests for the pure/injected-DB backfill
 * consolidation service, against an in-memory fake database (mirrors the
 * fake used by discovery-service.test.ts / mutation-service.test.ts).
 */

import { beforeEach, describe, expect, it } from "vitest";

import {
  consolidateExternalClubsByProviderIdentity,
  type ClubConsolidationDatabase,
  type ConsolidationClubRow,
  type ConsolidationTeamMappingRow,
} from "../consolidation-service";

type FakeClub = ConsolidationClubRow & { tenantId: string };
type FakeTeam = { id: string; tenantId: string; externalClubId: string; archivedAt: Date | null };
type FakeTeamMapping = {
  id: string;
  tenantId: string;
  provider: string;
  externalTeamId: string;
  providerTeamId: number;
};
type FakeClubMapping = {
  id: string;
  tenantId: string;
  provider: string;
  providerClubId: number;
  externalClubId: string;
};

let clubs: FakeClub[];
let teams: FakeTeam[];
let teamMappings: FakeTeamMapping[];
let clubMappings: FakeClubMapping[];
let nextId: number;

function freshId(prefix: string): string {
  nextId += 1;
  return `${prefix}-${nextId}`;
}

function seedClub(overrides: Partial<FakeClub> = {}): FakeClub {
  const club: FakeClub = {
    id: freshId("club"),
    tenantId: "tenant-1",
    logoUrl: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    archivedAt: null,
    ...overrides,
  };
  clubs.push(club);
  return club;
}

function seedTeam(externalClubId: string, overrides: Partial<FakeTeam> = {}): FakeTeam {
  const team: FakeTeam = {
    id: freshId("team"),
    tenantId: "tenant-1",
    externalClubId,
    archivedAt: null,
    ...overrides,
  };
  teams.push(team);
  return team;
}

function seedTeamMapping(
  externalTeamId: string,
  providerTeamId: number,
  overrides: Partial<FakeTeamMapping> = {},
): FakeTeamMapping {
  const mapping: FakeTeamMapping = {
    id: freshId("team-map"),
    tenantId: "tenant-1",
    provider: "SFV",
    externalTeamId,
    providerTeamId,
    ...overrides,
  };
  teamMappings.push(mapping);
  return mapping;
}

/** Seeds a fully-formed pre-existing duplicate: N clubs, one team each, one mapping each. */
function seedDuplicateClubPerTeam(
  teamSpecs: Array<{ providerTeamId: number; clubOverrides?: Partial<FakeClub> }>,
  tenantId = "tenant-1",
): { clubs: FakeClub[]; teams: FakeTeam[] } {
  const createdClubs: FakeClub[] = [];
  const createdTeams: FakeTeam[] = [];
  for (const spec of teamSpecs) {
    const club = seedClub({ tenantId, ...spec.clubOverrides });
    const team = seedTeam(club.id, { tenantId });
    seedTeamMapping(team.id, spec.providerTeamId, { tenantId });
    createdClubs.push(club);
    createdTeams.push(team);
  }
  return { clubs: createdClubs, teams: createdTeams };
}

function createFakeDatabase(): ClubConsolidationDatabase {
  const database: ClubConsolidationDatabase = {
    externalTeamProviderMapping: {
      findMany: async (args: object) => {
        const { where } = args as {
          where: { tenantId?: string; provider: string; providerTeamId: { in: number[] } };
        };
        const idSet = new Set(where.providerTeamId.in);
        // Mirrors real Prisma/SQL semantics exactly: a `where` clause that
        // omits `tenantId` altogether does NOT filter by tenant at all (it is
        // not equivalent to "match tenantId === undefined"). This fidelity
        // matters for mutation-testing the production query below — see the
        // "shared providerTeamId across tenants" describe block, which
        // deliberately strips `tenantId` from the real call to prove the fake
        // (and the real Postgres integration test) both expose the resulting
        // cross-tenant leak instead of silently returning zero rows.
        return teamMappings
          .filter(
            (m) =>
              (where.tenantId === undefined || m.tenantId === where.tenantId) &&
              m.provider === where.provider &&
              idSet.has(m.providerTeamId),
          )
          .map((m): ConsolidationTeamMappingRow => {
            const team = teams.find((t) => t.id === m.externalTeamId);
            if (!team) throw new Error("team not found in fake DB");
            return {
              externalTeamId: m.externalTeamId,
              providerTeamId: m.providerTeamId,
              externalTeam: { id: team.id, externalClubId: team.externalClubId, archivedAt: team.archivedAt },
            };
          });
      },
    },
    externalTeam: {
      update: async (args: object) => {
        const { where, data } = args as { where: { id: string }; data: { externalClubId: string } };
        const team = teams.find((t) => t.id === where.id);
        if (!team) throw new Error("team not found in fake DB");
        team.externalClubId = data.externalClubId;
        return { id: team.id, externalClubId: team.externalClubId };
      },
    },
    externalClub: {
      findMany: async (args: object) => {
        const { where } = args as { where: { tenantId: string; id: { in: string[] } } };
        const idSet = new Set(where.id.in);
        return clubs
          .filter((c) => c.tenantId === where.tenantId && idSet.has(c.id))
          .map((c) => ({ id: c.id, logoUrl: c.logoUrl, createdAt: c.createdAt, archivedAt: c.archivedAt }));
      },
      update: async (args: object) => {
        const { where, data } = args as { where: { id: string }; data: Partial<FakeClub> };
        const club = clubs.find((c) => c.id === where.id);
        if (!club) throw new Error("club not found in fake DB");
        Object.assign(club, data);
        return { id: club.id, logoUrl: club.logoUrl, createdAt: club.createdAt, archivedAt: club.archivedAt };
      },
    },
    externalClubProviderMapping: {
      findFirst: async (args: object) => {
        const { where } = args as { where: { tenantId: string; provider: string; providerClubId: number } };
        const found = clubMappings.find(
          (m) =>
            m.tenantId === where.tenantId &&
            m.provider === where.provider &&
            m.providerClubId === where.providerClubId,
        );
        return found ? { id: found.id, externalClubId: found.externalClubId } : null;
      },
      upsert: async (args: object) => {
        const { where, create, update } = args as {
          where: { tenantId_provider_providerClubId: { tenantId: string; provider: string; providerClubId: number } };
          create: Omit<FakeClubMapping, "id">;
          update: { externalClubId: string };
        };
        const key = where.tenantId_provider_providerClubId;
        const existing = clubMappings.find(
          (m) => m.tenantId === key.tenantId && m.provider === key.provider && m.providerClubId === key.providerClubId,
        );
        if (existing) {
          Object.assign(existing, update);
          return { id: existing.id, externalClubId: existing.externalClubId };
        }
        const created: FakeClubMapping = { id: freshId("club-map"), ...create };
        clubMappings.push(created);
        return { id: created.id, externalClubId: created.externalClubId };
      },
    },
    transaction: async <T>(fn: (tx: ClubConsolidationDatabase) => Promise<T>): Promise<T> => {
      const snapshot = {
        clubs: clubs.map((c) => ({ ...c })),
        teams: teams.map((t) => ({ ...t })),
        clubMappings: clubMappings.map((m) => ({ ...m })),
      };
      try {
        return await fn(database);
      } catch (err) {
        clubs.length = 0;
        clubs.push(...snapshot.clubs);
        teams.length = 0;
        teams.push(...snapshot.teams);
        clubMappings.length = 0;
        clubMappings.push(...snapshot.clubMappings);
        throw err;
      }
    },
  };
  return database;
}

let db: ClubConsolidationDatabase;

beforeEach(() => {
  clubs = [];
  teams = [];
  teamMappings = [];
  clubMappings = [];
  nextId = 0;
  db = createFakeDatabase();
});

// ── Consolidation of pre-existing duplicates ──────────────────────────────────

describe("consolidateExternalClubsByProviderIdentity — merges pre-existing duplicates", () => {
  it("merges N pre-existing per-team clubs sharing the same providerClubId into ONE canonical club", async () => {
    const { clubs: seededClubs, teams: seededTeams } = seedDuplicateClubPerTeam([
      { providerTeamId: 2001 },
      { providerTeamId: 2002 },
      { providerTeamId: 2003 },
    ]);

    const resolvedClubIdsByTeamId = new Map([
      [2001, 700],
      [2002, 700],
      [2003, 700],
    ]);

    const result = await consolidateExternalClubsByProviderIdentity(db, {
      tenantId: "tenant-1",
      provider: "SFV",
      resolvedClubIdsByTeamId,
    });

    expect(result.groupsProcessed).toBe(1);
    expect(result.groupsMerged).toBe(1);
    expect(result.teamsMoved).toBe(2); // canonical stays put; other 2 move
    expect(result.clubsArchived).toBe(2);

    const canonicalClubId = teams.find((t) => t.id === seededTeams[0].id)!.externalClubId;
    for (const team of seededTeams) {
      const live = teams.find((t) => t.id === team.id)!;
      expect(live.externalClubId).toBe(canonicalClubId);
    }

    // The two losing clubs are archived, never deleted.
    const losingClubs = seededClubs.filter((c) => c.id !== canonicalClubId);
    expect(losingClubs).toHaveLength(2);
    for (const losing of losingClubs) {
      const live = clubs.find((c) => c.id === losing.id)!;
      expect(live.archivedAt).not.toBeNull();
    }
    // Nothing is deleted — every original club row still exists.
    expect(clubs).toHaveLength(3);
    expect(teams).toHaveLength(3);
  });

  it("picks the earliest-created club as canonical when no prior mapping exists", async () => {
    seedDuplicateClubPerTeam([
      { providerTeamId: 3001, clubOverrides: { createdAt: new Date("2026-03-01T00:00:00.000Z") } },
      { providerTeamId: 3002, clubOverrides: { createdAt: new Date("2026-01-01T00:00:00.000Z") } },
      { providerTeamId: 3003, clubOverrides: { createdAt: new Date("2026-02-01T00:00:00.000Z") } },
    ]);

    const result = await consolidateExternalClubsByProviderIdentity(db, {
      tenantId: "tenant-1",
      provider: "SFV",
      resolvedClubIdsByTeamId: new Map([
        [3001, 800],
        [3002, 800],
        [3003, 800],
      ]),
    });

    const merged = result.details[0];
    expect(merged?.status).toBe("merged");
    const teamFor3002 = teamMappings.find((m) => m.providerTeamId === 3002)!;
    const canonicalTeam = teams.find((t) => t.id === teamFor3002.externalTeamId)!;
    if (merged?.status === "merged") {
      expect(merged.canonicalClubId).toBe(canonicalTeam.externalClubId);
    }
  });

  it("prefers an existing ExternalClubProviderMapping's club as canonical over 'earliest createdAt'", async () => {
    const { clubs: seededClubs } = seedDuplicateClubPerTeam([
      { providerTeamId: 4001, clubOverrides: { createdAt: new Date("2026-01-01T00:00:00.000Z") } },
      { providerTeamId: 4002, clubOverrides: { createdAt: new Date("2026-06-01T00:00:00.000Z") } },
    ]);

    // A prior partial consolidation (or manual admin link) already
    // established club[1] (the LATER-created one) as canonical.
    clubMappings.push({
      id: freshId("club-map"),
      tenantId: "tenant-1",
      provider: "SFV",
      providerClubId: 900,
      externalClubId: seededClubs[1].id,
    });

    const result = await consolidateExternalClubsByProviderIdentity(db, {
      tenantId: "tenant-1",
      provider: "SFV",
      resolvedClubIdsByTeamId: new Map([
        [4001, 900],
        [4002, 900],
      ]),
    });

    const merged = result.details[0];
    expect(merged?.status).toBe("merged");
    if (merged?.status === "merged") {
      expect(merged.canonicalClubId).toBe(seededClubs[1].id);
    }
  });

  it("prefers a non-archived club over an archived one when no prior mapping exists", async () => {
    const { clubs: seededClubs } = seedDuplicateClubPerTeam([
      {
        providerTeamId: 5001,
        clubOverrides: { createdAt: new Date("2026-01-01T00:00:00.000Z"), archivedAt: new Date("2026-02-01T00:00:00.000Z") },
      },
      { providerTeamId: 5002, clubOverrides: { createdAt: new Date("2026-06-01T00:00:00.000Z") } },
    ]);

    const result = await consolidateExternalClubsByProviderIdentity(db, {
      tenantId: "tenant-1",
      provider: "SFV",
      resolvedClubIdsByTeamId: new Map([
        [5001, 950],
        [5002, 950],
      ]),
    });

    const merged = result.details[0];
    if (merged?.status === "merged") {
      // seededClubs[1] is the active (non-archived) one despite being newer.
      expect(merged.canonicalClubId).toBe(seededClubs[1].id);
    }
  });
});

// ── Distinct clubs remain distinct ────────────────────────────────────────────

describe("consolidateExternalClubsByProviderIdentity — distinct clubs stay distinct", () => {
  it("never merges teams resolving to different providerClubId values", async () => {
    seedDuplicateClubPerTeam([{ providerTeamId: 6001 }, { providerTeamId: 6002 }]);

    const result = await consolidateExternalClubsByProviderIdentity(db, {
      tenantId: "tenant-1",
      provider: "SFV",
      resolvedClubIdsByTeamId: new Map([
        [6001, 111],
        [6002, 222],
      ]),
    });

    expect(result.groupsProcessed).toBe(2);
    expect(result.groupsMerged).toBe(0);
    expect(result.groupsAlreadyConsolidated).toBe(2);
    expect(clubs).toHaveLength(2);
    expect(clubs.every((c) => c.archivedAt === null)).toBe(true);
  });

  it("leaves a team whose providerTeamId is absent from the resolved map completely untouched", async () => {
    const { teams: seededTeams } = seedDuplicateClubPerTeam([{ providerTeamId: 7001 }, { providerTeamId: 7002 }]);

    await consolidateExternalClubsByProviderIdentity(db, {
      tenantId: "tenant-1",
      provider: "SFV",
      // Only 7001 has resolved identity evidence this run — 7002 must be
      // left exactly as-is, never guessed at.
      resolvedClubIdsByTeamId: new Map([[7001, 300]]),
    });

    const untouchedTeam = teams.find((t) => t.id === seededTeams[1].id)!;
    const originalClubId = seededTeams[1].externalClubId;
    expect(untouchedTeam.externalClubId).toBe(originalClubId);
  });
});

// ── Idempotency ────────────────────────────────────────────────────────────────

describe("consolidateExternalClubsByProviderIdentity — idempotent rerun", () => {
  it("running the same consolidation twice produces no further changes", async () => {
    seedDuplicateClubPerTeam([{ providerTeamId: 8001 }, { providerTeamId: 8002 }, { providerTeamId: 8003 }]);

    const map = new Map([
      [8001, 400],
      [8002, 400],
      [8003, 400],
    ]);

    const first = await consolidateExternalClubsByProviderIdentity(db, {
      tenantId: "tenant-1",
      provider: "SFV",
      resolvedClubIdsByTeamId: map,
    });
    expect(first.groupsMerged).toBe(1);
    expect(first.teamsMoved).toBe(2);

    const clubsAfterFirst = clubs.map((c) => ({ ...c }));
    const teamsAfterFirst = teams.map((t) => ({ ...t }));

    const second = await consolidateExternalClubsByProviderIdentity(db, {
      tenantId: "tenant-1",
      provider: "SFV",
      resolvedClubIdsByTeamId: map,
    });

    expect(second.groupsMerged).toBe(0);
    expect(second.groupsAlreadyConsolidated).toBe(1);
    expect(second.teamsMoved).toBe(0);
    expect(second.clubsArchived).toBe(0);
    expect(clubs).toEqual(clubsAfterFirst);
    expect(teams).toEqual(teamsAfterFirst);
  });

  it("running three consecutive times never creates duplicate ExternalClubProviderMapping rows", async () => {
    seedDuplicateClubPerTeam([{ providerTeamId: 8101 }, { providerTeamId: 8102 }]);
    const map = new Map([
      [8101, 401],
      [8102, 401],
    ]);

    for (let i = 0; i < 3; i++) {
      await consolidateExternalClubsByProviderIdentity(db, {
        tenantId: "tenant-1",
        provider: "SFV",
        resolvedClubIdsByTeamId: map,
      });
    }

    expect(clubMappings.filter((m) => m.providerClubId === 401)).toHaveLength(1);
  });
});

// ── Teams / mappings / references survive consolidation ──────────────────────

describe("consolidateExternalClubsByProviderIdentity — preserves teams and mappings", () => {
  it("never deletes any ExternalTeam row, only re-parents externalClubId", async () => {
    const { teams: seededTeams } = seedDuplicateClubPerTeam([
      { providerTeamId: 9001 },
      { providerTeamId: 9002 },
    ]);

    await consolidateExternalClubsByProviderIdentity(db, {
      tenantId: "tenant-1",
      provider: "SFV",
      resolvedClubIdsByTeamId: new Map([
        [9001, 500],
        [9002, 500],
      ]),
    });

    for (const team of seededTeams) {
      expect(teams.some((t) => t.id === team.id)).toBe(true);
    }
  });

  it("never touches ExternalTeamProviderMapping rows (provider identity of each team survives unchanged)", async () => {
    seedDuplicateClubPerTeam([{ providerTeamId: 9101 }, { providerTeamId: 9102 }]);
    const before = teamMappings.map((m) => ({ ...m }));

    await consolidateExternalClubsByProviderIdentity(db, {
      tenantId: "tenant-1",
      provider: "SFV",
      resolvedClubIdsByTeamId: new Map([
        [9101, 600],
        [9102, 600],
      ]),
    });

    expect(teamMappings).toEqual(before);
  });

  it("never deletes an ExternalClub row — losing clubs are archived, count stays the same", async () => {
    seedDuplicateClubPerTeam([{ providerTeamId: 9201 }, { providerTeamId: 9202 }, { providerTeamId: 9203 }]);

    await consolidateExternalClubsByProviderIdentity(db, {
      tenantId: "tenant-1",
      provider: "SFV",
      resolvedClubIdsByTeamId: new Map([
        [9201, 601],
        [9202, 601],
        [9203, 601],
      ]),
    });

    expect(clubs).toHaveLength(3);
  });
});

// ── Tenant isolation ───────────────────────────────────────────────────────────

describe("consolidateExternalClubsByProviderIdentity — tenant isolation", () => {
  it("never merges clubs across tenants, even for the same providerClubId", async () => {
    const tenantAClub = seedClub({ tenantId: "tenant-a" });
    const tenantATeam = seedTeam(tenantAClub.id, { tenantId: "tenant-a" });
    seedTeamMapping(tenantATeam.id, 1001, { tenantId: "tenant-a" });

    const tenantBClub = seedClub({ tenantId: "tenant-b" });
    const tenantBTeam = seedTeam(tenantBClub.id, { tenantId: "tenant-b" });
    seedTeamMapping(tenantBTeam.id, 1002, { tenantId: "tenant-b" });

    await consolidateExternalClubsByProviderIdentity(db, {
      tenantId: "tenant-a",
      provider: "SFV",
      resolvedClubIdsByTeamId: new Map([
        [1001, 700],
        [1002, 700], // same clubNumber as tenant A's team, but this call is scoped to tenant-a only
      ]),
    });

    // Tenant B's team/club must be completely untouched by a tenant-A-scoped run.
    const liveTenantBTeam = teams.find((t) => t.id === tenantBTeam.id)!;
    expect(liveTenantBTeam.externalClubId).toBe(tenantBClub.id);
    expect(clubs.find((c) => c.id === tenantBClub.id)!.archivedAt).toBeNull();
  });

  it("runs independently per tenant when both are explicitly consolidated", async () => {
    const tenantAClubs = seedDuplicateClubPerTeam(
      [{ providerTeamId: 1101 }, { providerTeamId: 1102 }],
      "tenant-a",
    );
    const tenantBClubs = seedDuplicateClubPerTeam(
      [{ providerTeamId: 1201 }, { providerTeamId: 1202 }],
      "tenant-b",
    );

    await consolidateExternalClubsByProviderIdentity(db, {
      tenantId: "tenant-a",
      provider: "SFV",
      resolvedClubIdsByTeamId: new Map([
        [1101, 700],
        [1102, 700],
      ]),
    });
    await consolidateExternalClubsByProviderIdentity(db, {
      tenantId: "tenant-b",
      provider: "SFV",
      resolvedClubIdsByTeamId: new Map([
        [1201, 700],
        [1202, 700],
      ]),
    });

    const tenantALiveClubIds = new Set(
      tenantAClubs.teams.map((t) => teams.find((live) => live.id === t.id)!.externalClubId),
    );
    const tenantBLiveClubIds = new Set(
      tenantBClubs.teams.map((t) => teams.find((live) => live.id === t.id)!.externalClubId),
    );
    expect(tenantALiveClubIds.size).toBe(1);
    expect(tenantBLiveClubIds.size).toBe(1);
    // Independent canonical clubs — never cross-tenant-merged.
    expect([...tenantALiveClubIds][0]).not.toBe([...tenantBLiveClubIds][0]);
  });

  // SFV `providerTeamId` values are provider-global (assigned by SFV, not by
  // SportClubEvo) — two entirely different SportClubEvo tenants can
  // legitimately reference the exact SAME numeric `providerTeamId` (e.g. both
  // tenants play against the same real-world opponent team). This describe
  // block proves consolidation scoped to tenant A never touches tenant B's
  // records even when the two tenants' `ExternalTeamProviderMapping` rows
  // share the identical `(provider, providerTeamId)` pair — the disjoint-id
  // tests above do not exercise this specific, realistic collision.
  describe("shared providerTeamId across two different tenants", () => {
    it("consolidating tenant A never reads, reparents, archives, or otherwise mutates tenant B's records for a providerTeamId both tenants happen to share", async () => {
      const SHARED_PROVIDER_TEAM_ID = 900301;

      // Tenant A: a genuine pre-existing duplicate — two clubs whose teams
      // both resolve to the same real-world clubNumber (500) this run. One of
      // those two teams uses SHARED_PROVIDER_TEAM_ID.
      const tenantAClubX = seedClub({
        tenantId: "tenant-a",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      });
      const tenantATeamX = seedTeam(tenantAClubX.id, { tenantId: "tenant-a" });
      seedTeamMapping(tenantATeamX.id, SHARED_PROVIDER_TEAM_ID, { tenantId: "tenant-a" });

      const tenantAClubY = seedClub({
        tenantId: "tenant-a",
        createdAt: new Date("2026-02-01T00:00:00.000Z"),
      });
      const tenantATeamY = seedTeam(tenantAClubY.id, { tenantId: "tenant-a" });
      seedTeamMapping(tenantATeamY.id, 900302, { tenantId: "tenant-a" });

      // Tenant B: a completely independent club/team/mapping that happens to
      // use the exact SAME numeric providerTeamId as tenant A's teamX above,
      // with its OWN distinct clubNumber (999), its OWN tenant-managed logo,
      // and a much earlier createdAt (which would "win" canonical selection
      // by the earliest-created tie-break if it were ever incorrectly pulled
      // into tenant A's group).
      const tenantBClub = seedClub({
        tenantId: "tenant-b",
        logoUrl: "https://cdn.example.com/tenant-b-own-logo.png",
        createdAt: new Date("2020-01-01T00:00:00.000Z"),
      });
      const tenantBTeam = seedTeam(tenantBClub.id, { tenantId: "tenant-b" });
      seedTeamMapping(tenantBTeam.id, SHARED_PROVIDER_TEAM_ID, { tenantId: "tenant-b" });
      clubMappings.push({
        id: freshId("club-map"),
        tenantId: "tenant-b",
        provider: "SFV",
        providerClubId: 999,
        externalClubId: tenantBClub.id,
      });

      // Full snapshot of every tenant-B row BEFORE any tenant-A-scoped call —
      // used below for a byte-for-byte / relationship-equivalent comparison.
      const tenantBBefore = {
        club: { ...clubs.find((c) => c.id === tenantBClub.id)! },
        team: { ...teams.find((t) => t.id === tenantBTeam.id)! },
        teamMapping: { ...teamMappings.find((m) => m.externalTeamId === tenantBTeam.id)! },
        clubMapping: { ...clubMappings.find((m) => m.externalClubId === tenantBClub.id)! },
      };

      const result = await consolidateExternalClubsByProviderIdentity(db, {
        tenantId: "tenant-a",
        provider: "SFV",
        resolvedClubIdsByTeamId: new Map([
          [SHARED_PROVIDER_TEAM_ID, 500],
          [900302, 500],
        ]),
      });

      // Tenant A's own pre-existing duplicate DOES merge correctly...
      expect(result.groupsMerged).toBe(1);
      const tenantACanonicalClubId = teams.find((t) => t.id === tenantATeamX.id)!.externalClubId;
      expect(teams.find((t) => t.id === tenantATeamY.id)!.externalClubId).toBe(tenantACanonicalClubId);

      // ...but tenant B is completely untouched: reads, mutations, archival,
      // provider mappings, and logo/data adoption all excluded.
      expect(clubs.find((c) => c.id === tenantBClub.id)).toEqual(tenantBBefore.club);
      expect(teams.find((t) => t.id === tenantBTeam.id)).toEqual(tenantBBefore.team);
      expect(teamMappings.find((m) => m.externalTeamId === tenantBTeam.id)).toEqual(tenantBBefore.teamMapping);
      expect(clubMappings.find((m) => m.externalClubId === tenantBClub.id)).toEqual(tenantBBefore.clubMapping);

      // Explicit per-guarantee assertions (redundant with the snapshot above,
      // but each one maps directly to a specific requirement):
      expect(teams.find((t) => t.id === tenantBTeam.id)!.externalClubId).toBe(tenantBClub.id); // never reparented
      expect(clubs.find((c) => c.id === tenantBClub.id)!.archivedAt).toBeNull(); // never archived
      expect(clubs.find((c) => c.id === tenantBClub.id)!.logoUrl).toBe(
        "https://cdn.example.com/tenant-b-own-logo.png",
      ); // logo never adopted/overwritten
      expect(clubMappings.filter((m) => m.tenantId === "tenant-b")).toHaveLength(1); // mapping not duplicated/repointed
      expect(clubMappings.find((m) => m.tenantId === "tenant-b")!.providerClubId).toBe(999); // mapping value untouched

      // Tenant A's canonical club must never resolve to tenant B's club, and
      // tenant B's earlier createdAt must never have "won" canonical
      // selection for tenant A's group.
      expect(tenantACanonicalClubId).not.toBe(tenantBClub.id);
      expect(clubs).toHaveLength(3); // A's two + B's one — nothing deleted, nothing spuriously created
      expect(teams).toHaveLength(3);
    });
  });
});

// ── Logo completeness during consolidation ────────────────────────────────────

describe("consolidateExternalClubsByProviderIdentity — logo completeness", () => {
  it("adopts an existing valid provider crest from a losing club when the canonical club has none", async () => {
    const { clubs: seededClubs } = seedDuplicateClubPerTeam([
      { providerTeamId: 1301, clubOverrides: { createdAt: new Date("2026-01-01T00:00:00.000Z"), logoUrl: null } },
      {
        providerTeamId: 1302,
        clubOverrides: { createdAt: new Date("2026-02-01T00:00:00.000Z"), logoUrl: "data:image/gif;base64,AAA=" },
      },
    ]);

    const result = await consolidateExternalClubsByProviderIdentity(db, {
      tenantId: "tenant-1",
      provider: "SFV",
      resolvedClubIdsByTeamId: new Map([
        [1301, 700],
        [1302, 700],
      ]),
    });

    const merged = result.details[0];
    expect(merged?.status).toBe("merged");
    if (merged?.status === "merged") {
      expect(merged.canonicalClubId).toBe(seededClubs[0].id); // earliest-created wins
      expect(merged.logoAdoptedFromClubId).toBe(seededClubs[1].id);
    }
    const canonical = clubs.find((c) => c.id === seededClubs[0].id)!;
    expect(canonical.logoUrl).toBe("data:image/gif;base64,AAA=");
  });

  it("keeps the canonical club's existing logo — never overwrites it with a losing club's logo", async () => {
    const { clubs: seededClubs } = seedDuplicateClubPerTeam([
      {
        providerTeamId: 1401,
        clubOverrides: {
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          logoUrl: "https://cdn.example.com/tenant-uploaded.png",
        },
      },
      {
        providerTeamId: 1402,
        clubOverrides: { createdAt: new Date("2026-02-01T00:00:00.000Z"), logoUrl: "data:image/gif;base64,BBB=" },
      },
    ]);

    await consolidateExternalClubsByProviderIdentity(db, {
      tenantId: "tenant-1",
      provider: "SFV",
      resolvedClubIdsByTeamId: new Map([
        [1401, 700],
        [1402, 700],
      ]),
    });

    const canonical = clubs.find((c) => c.id === seededClubs[0].id)!;
    expect(canonical.logoUrl).toBe("https://cdn.example.com/tenant-uploaded.png");
  });

  it("leaves the canonical club logo-less when no losing club has a logo either (nothing to adopt)", async () => {
    const { clubs: seededClubs } = seedDuplicateClubPerTeam([
      { providerTeamId: 1501 },
      { providerTeamId: 1502 },
    ]);

    const result = await consolidateExternalClubsByProviderIdentity(db, {
      tenantId: "tenant-1",
      provider: "SFV",
      resolvedClubIdsByTeamId: new Map([
        [1501, 700],
        [1502, 700],
      ]),
    });

    const merged = result.details[0];
    if (merged?.status === "merged") {
      expect(merged.logoAdoptedFromClubId).toBeNull();
    }
    expect(clubs.find((c) => c.id === seededClubs[0].id)!.logoUrl).toBeNull();
  });
});
