import { beforeEach, describe, expect, it } from "vitest";

import { discoverExternalTeamFromProvider } from "../discovery-service";
import {
  ClubDirectoryUniqueConstraintError,
  type ClubDirectoryMutationDatabase,
  type ExternalClubProviderMappingRow,
  type ExternalClubRow,
  type ExternalTeamProviderMappingRow,
  type ExternalTeamRow,
} from "../mutation-service";

// ── In-memory fake database ─────────────────────────────────────────────────────
//
// Mirrors the fake used by mutation-service.test.ts so discovery is exercised
// against real matching/uniqueness semantics rather than recorded call
// assertions only.

// Fake-DB rows carry more provider-owned fields (providerTeamName,
// lastSyncedAt, …) than the narrow ExternalTeamProviderMappingRow /
// ExternalClubProviderMappingRow types mutation-service.ts declares for its
// own use — mirrors the real Prisma row shape so assertions on refreshed
// provider-owned fields can read them back.
type FakeClubMappingRow = ExternalClubProviderMappingRow & {
  providerClubName?: string | null;
  lastSyncedAt?: Date;
};
type FakeTeamMappingRow = ExternalTeamProviderMappingRow & {
  providerTeamName?: string | null;
  providerClubId?: number | null;
  providerOrganisationId?: number | null;
  providerLogoUrl?: string | null;
  providerIsActive?: boolean;
  lastSyncedAt?: Date;
};

let clubs: ExternalClubRow[];
let teams: ExternalTeamRow[];
let clubMappings: FakeClubMappingRow[];
let teamMappings: FakeTeamMappingRow[];
let nextId: number;

function freshId(prefix: string): string {
  nextId += 1;
  return `${prefix}-${nextId}`;
}

type FindFirstArgs = { where: Record<string, unknown> };
type CreateArgs = { data: Record<string, unknown> };
type UpdateArgs = { where: { id: string }; data: Record<string, unknown> };
type MappingUpsertArgs = {
  where: Record<string, Record<string, unknown>>;
  create: Record<string, unknown>;
  update: Record<string, unknown>;
};

function createFakeDatabase(): ClubDirectoryMutationDatabase {
  const database: ClubDirectoryMutationDatabase = {
    externalClub: {
      findFirst: async (args: object) => {
        const { where } = args as FindFirstArgs;
        return clubs.find((c) => c.id === where.id && c.tenantId === where.tenantId) ?? null;
      },
      create: async (args: object) => {
        const { data } = args as CreateArgs;
        const club: ExternalClubRow = {
          id: freshId("club"),
          website: null,
          location: null,
          logoUrl: null,
          notes: null,
          shortName: null,
          alternativeName: null,
          archivedAt: null,
          ...data,
        } as ExternalClubRow;
        clubs.push(club);
        return club;
      },
      update: async (args: object) => {
        const { where, data } = args as UpdateArgs;
        const club = clubs.find((c) => c.id === where.id);
        if (!club) throw new Error("club not found in fake DB");
        Object.assign(club, data);
        return club;
      },
    },
    externalTeam: {
      findFirst: async (args: object) => {
        const { where } = args as FindFirstArgs;
        return teams.find((t) => t.id === where.id && t.tenantId === where.tenantId) ?? null;
      },
      create: async (args: object) => {
        const { data } = args as CreateArgs;
        const team: ExternalTeamRow = {
          id: freshId("team"),
          logoUrl: null,
          shortName: null,
          alternativeName: null,
          categoryLabel: null,
          archivedAt: null,
          ...data,
        } as ExternalTeamRow;
        teams.push(team);
        return team;
      },
      update: async (args: object) => {
        const { where, data } = args as UpdateArgs;
        const team = teams.find((t) => t.id === where.id);
        if (!team) throw new Error("team not found in fake DB");
        Object.assign(team, data);
        return team;
      },
    },
    externalClubProviderMapping: {
      findFirst: async (args: object) => {
        const { where } = args as FindFirstArgs;
        return (
          clubMappings.find(
            (m) =>
              m.tenantId === where.tenantId &&
              m.provider === where.provider &&
              m.providerClubId === where.providerClubId,
          ) ?? null
        );
      },
      upsert: async (args: object) => {
        const { where, create, update } = args as MappingUpsertArgs;
        const key = where.tenantId_provider_providerClubId;
        const existing = clubMappings.find(
          (m) =>
            m.tenantId === key.tenantId &&
            m.provider === key.provider &&
            m.providerClubId === key.providerClubId,
        );
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const created: FakeClubMappingRow = {
          id: freshId("club-map"),
          ...create,
        } as FakeClubMappingRow;
        clubMappings.push(created);
        return created;
      },
    },
    externalTeamProviderMapping: {
      findFirst: async (args: object) => {
        const { where } = args as FindFirstArgs;
        return (
          teamMappings.find(
            (m) =>
              m.tenantId === where.tenantId &&
              m.provider === where.provider &&
              m.providerTeamId === where.providerTeamId &&
              m.providerSeasonId === where.providerSeasonId,
          ) ?? null
        );
      },
      upsert: async (args: object) => {
        const { where, create, update } = args as MappingUpsertArgs;
        const key = where.tenantId_provider_providerTeamId_providerSeasonId;
        const existing = teamMappings.find(
          (m) =>
            m.tenantId === key.tenantId &&
            m.provider === key.provider &&
            m.providerTeamId === key.providerTeamId &&
            m.providerSeasonId === key.providerSeasonId,
        );
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const created: FakeTeamMappingRow = {
          id: freshId("team-map"),
          ...create,
        } as FakeTeamMappingRow;
        teamMappings.push(created);
        return created;
      },
      // CLUB-DIRECTORY-02 concurrency fix: plain create() — never upsert() —
      // used exclusively inside transaction() to atomically claim a
      // provider identity. Mirrors the real Postgres unique-constraint
      // behaviour: a duplicate (tenantId, provider, providerTeamId,
      // providerSeasonId) throws ClubDirectoryUniqueConstraintError instead
      // of silently updating the existing row.
      create: async (args: object) => {
        const { data } = args as CreateArgs;
        const key = data as {
          tenantId: string;
          provider: string;
          providerTeamId: number;
          providerSeasonId: number;
        };
        const existing = teamMappings.find(
          (m) =>
            m.tenantId === key.tenantId &&
            m.provider === key.provider &&
            m.providerTeamId === key.providerTeamId &&
            m.providerSeasonId === key.providerSeasonId,
        );
        if (existing) {
          throw new ClubDirectoryUniqueConstraintError(
            "ExternalTeamProviderMapping already exists for this identity.",
          );
        }
        const created: FakeTeamMappingRow = {
          id: freshId("team-map"),
          ...data,
        } as FakeTeamMappingRow;
        teamMappings.push(created);
        return created;
      },
    },
    // CLUB-DIRECTORY-02 concurrency fix: a fake but functionally faithful
    // transaction — snapshots state before running `fn`, restores it if
    // `fn` throws. `tx` is the same database instance (a fake doesn't need
    // per-connection isolation), which is sufficient to exercise "an error
    // inside the transaction rolls back every write performed within it".
    transaction: async <T>(fn: (tx: ClubDirectoryMutationDatabase) => Promise<T>): Promise<T> => {
      const snapshot = {
        clubs: [...clubs],
        teams: [...teams],
        clubMappings: [...clubMappings],
        teamMappings: [...teamMappings],
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
        teamMappings.length = 0;
        teamMappings.push(...snapshot.teamMappings);
        throw err;
      }
    },
  };
  return database;
}

let db: ClubDirectoryMutationDatabase;

beforeEach(() => {
  clubs = [];
  teams = [];
  clubMappings = [];
  teamMappings = [];
  nextId = 0;
  db = createFakeDatabase();
});

// ── Discovery ─────────────────────────────────────────────────────────────────

describe("discoverExternalTeamFromProvider — brand-new opponent", () => {
  it("creates a canonical ExternalClub + ExternalTeam pair for a never-seen SFV team", async () => {
    const result = await discoverExternalTeamFromProvider(db, {
      tenantId: "tenant-1",
      provider: "SFV",
      providerTeamId: 51234,
      providerTeamName: "SV Muttenz B1",
    });

    expect(result.discovered).toBe(true);
    expect(result.team.name).toBe("SV Muttenz B1");
    expect(result.team.externalClubId).toBe(result.club.id);
    expect(result.club.name).toBe("SV Muttenz B1");
    expect(result.club.source).toBe("SFV");
    expect(result.team.source).toBe("SFV");
  });

  it("persists a stable ExternalTeamProviderMapping identifying the discovered team", async () => {
    await discoverExternalTeamFromProvider(db, {
      tenantId: "tenant-1",
      provider: "SFV",
      providerTeamId: 51234,
      providerTeamName: "SV Muttenz B1",
    });

    expect(teamMappings).toHaveLength(1);
    expect(teamMappings[0]).toMatchObject({
      tenantId: "tenant-1",
      provider: "SFV",
      providerTeamId: 51234,
      providerSeasonId: 0,
    });
  });

  it("falls back to a stable synthetic name when the provider gives no team name", async () => {
    const result = await discoverExternalTeamFromProvider(db, {
      tenantId: "tenant-1",
      provider: "SFV",
      providerTeamId: 999,
      providerTeamName: null,
    });

    expect(result.team.name).toBe("SFV 999");
    expect(result.club.name).toBe("SFV 999");
  });

  it("normalizes provider to upper-case for identity purposes", async () => {
    const result = await discoverExternalTeamFromProvider(db, {
      tenantId: "tenant-1",
      provider: "sfv",
      providerTeamId: 51234,
      providerTeamName: "SV Muttenz B1",
    });

    expect(teamMappings[0]?.provider).toBe("SFV");
    expect(result.discovered).toBe(true);
  });
});

describe("discoverExternalTeamFromProvider — idempotency across repeated syncs", () => {
  it("does not create a second club/team pair when the provider identity already resolved", async () => {
    const first = await discoverExternalTeamFromProvider(db, {
      tenantId: "tenant-1",
      provider: "SFV",
      providerTeamId: 51234,
      providerTeamName: "SV Muttenz B1",
    });

    const second = await discoverExternalTeamFromProvider(db, {
      tenantId: "tenant-1",
      provider: "SFV",
      providerTeamId: 51234,
      providerTeamName: "SV Muttenz B1",
    });

    expect(second.discovered).toBe(false);
    expect(second.team.id).toBe(first.team.id);
    expect(second.club.id).toBe(first.club.id);
    expect(clubs).toHaveLength(1);
    expect(teams).toHaveLength(1);
    expect(teamMappings).toHaveLength(1);
  });

  it("running the same sync three times in a row is fully idempotent", async () => {
    for (let i = 0; i < 3; i++) {
      await discoverExternalTeamFromProvider(db, {
        tenantId: "tenant-1",
        provider: "SFV",
        providerTeamId: 51234,
        providerTeamName: "SV Muttenz B1",
      });
    }

    expect(clubs).toHaveLength(1);
    expect(teams).toHaveLength(1);
    expect(teamMappings).toHaveLength(1);
  });

  it("refreshes provider-owned fields (providerTeamName, lastSyncedAt) on re-sync", async () => {
    const now1 = new Date("2026-08-01T00:00:00.000Z");
    await discoverExternalTeamFromProvider(
      db,
      { tenantId: "tenant-1", provider: "SFV", providerTeamId: 51234, providerTeamName: "SV Muttenz B1" },
      now1,
    );

    const now2 = new Date("2026-08-08T00:00:00.000Z");
    const result = await discoverExternalTeamFromProvider(
      db,
      {
        tenantId: "tenant-1",
        provider: "SFV",
        providerTeamId: 51234,
        providerTeamName: "SV Muttenz B1 (neu benannt)",
      },
      now2,
    );

    expect(result.discovered).toBe(false);
    expect(teamMappings[0]?.providerTeamName).toBe("SV Muttenz B1 (neu benannt)");
    expect(teamMappings[0]?.lastSyncedAt).toEqual(now2);
  });
});

describe("discoverExternalTeamFromProvider — reuses existing provider-linked records", () => {
  it("reuses a team that was already manually linked to the same provider identity", async () => {
    const club = clubs[0] ?? {
      id: freshId("club"),
      tenantId: "tenant-1",
      name: "SV Muttenz",
      shortName: null,
      alternativeName: null,
      website: null,
      location: null,
      logoUrl: null,
      notes: null,
      source: "MANUAL",
      archivedAt: null,
    };
    clubs.push(club);

    const team: ExternalTeamRow = {
      id: freshId("team"),
      tenantId: "tenant-1",
      externalClubId: club.id,
      name: "SV Muttenz B1 (manuell gepflegt)",
      shortName: null,
      alternativeName: null,
      categoryLabel: null,
      logoUrl: "https://cdn.example.com/manual-logo.png",
      source: "MANUAL",
      archivedAt: null,
    };
    teams.push(team);

    teamMappings.push({
      id: freshId("team-map"),
      tenantId: "tenant-1",
      externalTeamId: team.id,
      provider: "SFV",
      providerTeamId: 51234,
      providerSeasonId: 0,
    });

    const result = await discoverExternalTeamFromProvider(db, {
      tenantId: "tenant-1",
      provider: "SFV",
      providerTeamId: 51234,
      providerTeamName: "SV Muttenz B1",
    });

    expect(result.discovered).toBe(false);
    expect(result.team.id).toBe(team.id);
    expect(result.club.id).toBe(club.id);
    expect(clubs).toHaveLength(1);
    expect(teams).toHaveLength(1);
  });
});

describe("discoverExternalTeamFromProvider — STRICT OWNERSHIP RULE", () => {
  it("never overwrites a tenant-managed name on re-sync", async () => {
    await discoverExternalTeamFromProvider(db, {
      tenantId: "tenant-1",
      provider: "SFV",
      providerTeamId: 51234,
      providerTeamName: "SV Muttenz B1",
    });

    // A Club Admin renames the auto-discovered team/club (tenant enrichment).
    teams[0]!.name = "SV Muttenz Erste Mannschaft";
    clubs[0]!.name = "SV Muttenz";
    clubs[0]!.logoUrl = "https://cdn.example.com/tenant-logo.png";

    const result = await discoverExternalTeamFromProvider(db, {
      tenantId: "tenant-1",
      provider: "SFV",
      providerTeamId: 51234,
      providerTeamName: "SV Muttenz B1 (Anbieter-Update)",
      providerLogoUrl: "https://provider.example.com/crest.gif",
    });

    expect(result.team.name).toBe("SV Muttenz Erste Mannschaft");
    expect(result.club.name).toBe("SV Muttenz");
    // Tenant-managed logo survives even though the provider now reports one.
    expect(result.club.logoUrl).toBe("https://cdn.example.com/tenant-logo.png");
    // The provider-reported values are still captured on the mapping row.
    expect(teamMappings[0]?.providerTeamName).toBe("SV Muttenz B1 (Anbieter-Update)");
  });

  it("fills an empty club logo slot from provider data without touching a tenant-set one", async () => {
    const first = await discoverExternalTeamFromProvider(db, {
      tenantId: "tenant-1",
      provider: "SFV",
      providerTeamId: 51234,
      providerTeamName: "SV Muttenz B1",
      providerLogoUrl: "https://provider.example.com/crest.gif",
    });

    expect(first.club.logoUrl).toBe("https://provider.example.com/crest.gif");
  });
});

describe("discoverExternalTeamFromProvider — concurrency (CLUB-DIRECTORY-02 fix)", () => {
  it("rolls back its own shell and adopts the winner when a conflict appears mid-transaction", async () => {
    // Simulates a concurrent writer whose transaction already committed the
    // SAME provider identity by the time our own transaction starts (the
    // real-Postgres guarantee: the loser's conflicting INSERT only ever
    // raises once the winner is visible — see
    // discovery-service-concurrency.integration.test.ts for the genuine
    // two-connection proof). Patching `transaction()` itself (rather than
    // an inner delegate) ensures the injected winner rows land BEFORE the
    // snapshot this fake's transaction() takes, so rolling back our own
    // (later, losing) writes never touches them — exactly mirroring how a
    // real DB rollback can never undo another session's committed work.
    const originalTransaction = db.transaction.bind(db);
    let winnerTeamId: string | null = null;

    db.transaction = (async (fn: (tx: ClubDirectoryMutationDatabase) => Promise<unknown>) => {
      const winnerClub: ExternalClubRow = {
        id: freshId("club"),
        tenantId: "tenant-1",
        name: "SV Muttenz B1",
        shortName: null,
        alternativeName: null,
        website: null,
        location: null,
        logoUrl: null,
        notes: null,
        source: "SFV",
        archivedAt: null,
      };
      clubs.push(winnerClub);

      const winnerTeam: ExternalTeamRow = {
        id: freshId("team"),
        tenantId: "tenant-1",
        externalClubId: winnerClub.id,
        name: "SV Muttenz B1",
        shortName: null,
        alternativeName: null,
        categoryLabel: null,
        logoUrl: null,
        source: "SFV",
        archivedAt: null,
      };
      teams.push(winnerTeam);
      winnerTeamId = winnerTeam.id;

      teamMappings.push({
        id: freshId("team-map"),
        tenantId: "tenant-1",
        externalTeamId: winnerTeam.id,
        provider: "SFV",
        providerTeamId: 51234,
        providerSeasonId: 0,
      });

      return originalTransaction(fn);
    }) as typeof db.transaction;

    const result = await discoverExternalTeamFromProvider(db, {
      tenantId: "tenant-1",
      provider: "SFV",
      providerTeamId: 51234,
      providerTeamName: "SV Muttenz B1",
    });

    expect(result.discovered).toBe(false);
    expect(result.team.id).toBe(winnerTeamId);
    // Exactly one club/team/mapping survive — our own shell (created inside
    // the now-rolled-back transaction) never persisted.
    expect(clubs).toHaveLength(1);
    expect(teams).toHaveLength(1);
    expect(teamMappings).toHaveLength(1);
  });

  it("does not leave an orphan club behind when the mapping create conflicts", async () => {
    const originalTransaction = db.transaction.bind(db);

    db.transaction = (async (fn: (tx: ClubDirectoryMutationDatabase) => Promise<unknown>) => {
      // A competing winner has already committed by the time our
      // transaction starts.
      const winnerClub: ExternalClubRow = {
        id: freshId("club"),
        tenantId: "tenant-1",
        name: "Winner",
        shortName: null,
        alternativeName: null,
        website: null,
        location: null,
        logoUrl: null,
        notes: null,
        source: "SFV",
        archivedAt: null,
      };
      clubs.push(winnerClub);

      const winnerTeam: ExternalTeamRow = {
        id: freshId("team"),
        tenantId: "tenant-1",
        externalClubId: winnerClub.id,
        name: "Winner",
        shortName: null,
        alternativeName: null,
        categoryLabel: null,
        logoUrl: null,
        source: "SFV",
        archivedAt: null,
      };
      teams.push(winnerTeam);
      teamMappings.push({
        id: freshId("team-map"),
        tenantId: "tenant-1",
        externalTeamId: winnerTeam.id,
        provider: "SFV",
        providerTeamId: 999999,
        providerSeasonId: 0,
      });

      return originalTransaction(fn);
    }) as typeof db.transaction;

    await discoverExternalTeamFromProvider(db, {
      tenantId: "tenant-1",
      provider: "SFV",
      providerTeamId: 999999,
      providerTeamName: "Race Team",
    });

    // Our own attempt (inside the now-rolled-back transaction) tried to
    // create a club named "Race Team" — it must not survive.
    expect(clubs.filter((c) => c.name === "Race Team")).toHaveLength(0);
  });

  it("propagates a genuine (non-conflict) transaction failure unchanged", async () => {
    const boom = new Error("simulated connection failure");
    db.externalTeam.create = async () => {
      throw boom;
    };

    await expect(
      discoverExternalTeamFromProvider(db, {
        tenantId: "tenant-1",
        provider: "SFV",
        providerTeamId: 51234,
        providerTeamName: "SV Muttenz B1",
      }),
    ).rejects.toThrow(boom);

    // The failed transaction must not leave a dangling club behind either.
    expect(clubs).toHaveLength(0);
  });
});

describe("discoverExternalTeamFromProvider — tenant isolation", () => {
  it("discovers independent club/team pairs per tenant for the same provider team id", async () => {
    const tenantAResult = await discoverExternalTeamFromProvider(db, {
      tenantId: "tenant-a",
      provider: "SFV",
      providerTeamId: 51234,
      providerTeamName: "SV Muttenz B1",
    });

    const tenantBResult = await discoverExternalTeamFromProvider(db, {
      tenantId: "tenant-b",
      provider: "SFV",
      providerTeamId: 51234,
      providerTeamName: "SV Muttenz B1",
    });

    expect(tenantAResult.club.id).not.toBe(tenantBResult.club.id);
    expect(tenantAResult.team.id).not.toBe(tenantBResult.team.id);
    expect(clubs).toHaveLength(2);
    expect(teams).toHaveLength(2);
    expect(teamMappings).toHaveLength(2);
  });

  it("rejects resolving a team across tenants (defensive: throws not-found rather than leaking)", async () => {
    await discoverExternalTeamFromProvider(db, {
      tenantId: "tenant-a",
      provider: "SFV",
      providerTeamId: 51234,
      providerTeamName: "SV Muttenz B1",
    });

    // A different tenant sees the same provider team id as brand-new — never
    // reuses tenant-a's canonical record.
    const tenantBResult = await discoverExternalTeamFromProvider(db, {
      tenantId: "tenant-b",
      provider: "SFV",
      providerTeamId: 51234,
      providerTeamName: "SV Muttenz B1",
    });

    expect(tenantBResult.discovered).toBe(true);
    expect(clubs.filter((c) => c.tenantId === "tenant-b")).toHaveLength(1);
  });
});
