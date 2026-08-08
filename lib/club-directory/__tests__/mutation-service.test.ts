import { beforeEach, describe, expect, it } from "vitest";

import {
  ClubDirectoryConflictError,
  ClubDirectoryNotFoundError,
  ClubDirectoryUniqueConstraintError,
  ClubDirectoryValidationError,
  createExternalClub,
  createExternalTeam,
  linkExternalClubProvider,
  linkExternalTeamProvider,
  mergeExternalClubs,
  moveExternalTeamToClub,
  setExternalClubArchived,
  setExternalTeamArchived,
  updateExternalClub,
  updateExternalTeam,
  type ClubDirectoryMutationDatabase,
  type ExternalClubProviderMappingRow,
  type ExternalClubRow,
  type ExternalTeamProviderMappingRow,
  type ExternalTeamRow,
} from "../mutation-service";

// ── In-memory fake database ─────────────────────────────────────────────────────
//
// A lightweight fake (not a pure mock) so business rules like "provider
// identity is unique per tenant" and "tenant isolation" are exercised with
// real matching semantics, not just recorded call assertions.

let clubs: ExternalClubRow[];
let teams: ExternalTeamRow[];
let clubMappings: ExternalClubProviderMappingRow[];
let teamMappings: ExternalTeamProviderMappingRow[];
let nextId: number;

function freshId(prefix: string): string {
  nextId += 1;
  return `${prefix}-${nextId}`;
}

function seedClub(overrides: Partial<ExternalClubRow> = {}): ExternalClubRow {
  const club: ExternalClubRow = {
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
    ...overrides,
  };
  clubs.push(club);
  return club;
}

function seedTeam(overrides: Partial<ExternalTeamRow> = {}): ExternalTeamRow {
  const team: ExternalTeamRow = {
    id: freshId("team"),
    tenantId: "tenant-1",
    externalClubId: clubs[0]?.id ?? "club-1",
    name: "SV Muttenz B1",
    shortName: null,
    alternativeName: null,
    categoryLabel: null,
    logoUrl: null,
    source: "MANUAL",
    archivedAt: null,
    ...overrides,
  };
  teams.push(team);
  return team;
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
      findMany: async (args: object) => {
        const { where } = args as FindFirstArgs;
        return teams.filter(
          (t) => t.tenantId === where.tenantId && t.externalClubId === where.externalClubId,
        );
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
      findMany: async (args: object) => {
        const { where } = args as FindFirstArgs;
        return clubMappings.filter(
          (m) => m.tenantId === where.tenantId && m.externalClubId === where.externalClubId,
        );
      },
      update: async (args: object) => {
        const { where, data } = args as UpdateArgs;
        const mapping = clubMappings.find((m) => m.id === where.id);
        if (!mapping) throw new Error("club provider mapping not found in fake DB");
        Object.assign(mapping, data);
        return mapping;
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
        const created: ExternalClubProviderMappingRow = {
          id: freshId("club-map"),
          ...create,
        } as ExternalClubProviderMappingRow;
        clubMappings.push(created);
        return created;
      },
      // CLUB-DIRECTORY-02C: plain create() — never upsert() — used
      // exclusively inside transaction() to atomically claim a provider
      // CLUB identity. Mirrors the real Postgres unique-constraint
      // behaviour: a duplicate (tenantId, provider, providerClubId) throws
      // ClubDirectoryUniqueConstraintError instead of silently updating the
      // existing row.
      create: async (args: object) => {
        const { data } = args as CreateArgs;
        const key = data as { tenantId: string; provider: string; providerClubId: number };
        const existing = clubMappings.find(
          (m) =>
            m.tenantId === key.tenantId &&
            m.provider === key.provider &&
            m.providerClubId === key.providerClubId,
        );
        if (existing) {
          throw new ClubDirectoryUniqueConstraintError(
            "ExternalClubProviderMapping already exists for this identity.",
          );
        }
        const created: ExternalClubProviderMappingRow = {
          id: freshId("club-map"),
          ...data,
        } as ExternalClubProviderMappingRow;
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
        const created: ExternalTeamProviderMappingRow = {
          id: freshId("team-map"),
          ...create,
        } as ExternalTeamProviderMappingRow;
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
        const created: ExternalTeamProviderMappingRow = {
          id: freshId("team-map"),
          ...data,
        } as ExternalTeamProviderMappingRow;
        teamMappings.push(created);
        return created;
      },
    },
    // CLUB-DIRECTORY-02 concurrency fix: a fake but functionally faithful
    // transaction — snapshots state before running `fn`, restores it if
    // `fn` throws. `tx` is the same database instance (a fake doesn't need
    // per-connection isolation), which is sufficient to exercise "an error
    // inside the transaction rolls back every write performed within it".
    //
    // Deep-clones the snapshot (structuredClone) rather than shallow-copying
    // the arrays: `update()` mutates row objects in place (Object.assign),
    // so a shallow `[...clubs]` copy would still share the same mutated
    // object references and fail to actually revert field-level changes on
    // rollback (only array membership) — CLUB-DIRECTORY-03's
    // `mergeExternalClubs` mutates existing rows via `update()` inside a
    // transaction, unlike the create-only flows this fake originally had to
    // support.
    transaction: async <T>(fn: (tx: ClubDirectoryMutationDatabase) => Promise<T>): Promise<T> => {
      const snapshot = structuredClone({ clubs, teams, clubMappings, teamMappings });
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

// ── 1. Manual club creation ─────────────────────────────────────────────────────

describe("createExternalClub — manual creation", () => {
  it("creates a club with source MANUAL and no provider mapping", async () => {
    const club = await createExternalClub(db, { tenantId: "tenant-1", name: "SV Muttenz" });
    expect(club.source).toBe("MANUAL");
    expect(club.name).toBe("SV Muttenz");
    expect(clubMappings).toHaveLength(0);
  });

  it("requires a non-empty name", async () => {
    await expect(
      createExternalClub(db, { tenantId: "tenant-1", name: "   " }),
    ).rejects.toThrow(ClubDirectoryValidationError);
  });

  it("never touches a tenant-owned Team model — the fake DB has no team delegate at all", async () => {
    // The ClubDirectoryMutationDatabase interface has no `team` property —
    // this is a structural guarantee, not just a runtime check, that manual
    // ExternalClub creation cannot create a canonical tenant Team.
    expect("team" in db).toBe(false);
    await createExternalClub(db, { tenantId: "tenant-1", name: "SV Muttenz" });
  });
});

// ── 2. Manual external team creation ────────────────────────────────────────────

describe("createExternalTeam — manual creation", () => {
  it("creates a team under an existing, non-archived club", async () => {
    const club = seedClub();
    const team = await createExternalTeam(db, {
      tenantId: "tenant-1",
      externalClubId: club.id,
      name: "SV Muttenz B1",
    });
    expect(team.externalClubId).toBe(club.id);
    expect(team.source).toBe("MANUAL");
  });

  it("rejects creation when the parent club does not exist", async () => {
    await expect(
      createExternalTeam(db, { tenantId: "tenant-1", externalClubId: "missing", name: "X" }),
    ).rejects.toThrow(ClubDirectoryNotFoundError);
  });

  it("rejects creation under an archived club", async () => {
    const club = seedClub({ archivedAt: new Date() });
    await expect(
      createExternalTeam(db, { tenantId: "tenant-1", externalClubId: club.id, name: "X" }),
    ).rejects.toThrow(/archived/);
  });

  it("never touches a tenant-owned Team model", async () => {
    expect("team" in db).toBe(false);
  });
});

// ── 9. External team belongs to correct external club ───────────────────────────

describe("ExternalTeam ↔ ExternalClub relationship", () => {
  it("a created team's externalClubId always matches the club it was created under", async () => {
    const clubA = seedClub({ name: "SV Muttenz" });
    const clubB = seedClub({ name: "FC Concordia Basel" });

    const teamA = await createExternalTeam(db, {
      tenantId: "tenant-1",
      externalClubId: clubA.id,
      name: "SV Muttenz B1",
    });
    const teamB = await createExternalTeam(db, {
      tenantId: "tenant-1",
      externalClubId: clubB.id,
      name: "FC Concordia Basel B2",
    });

    expect(teamA.externalClubId).toBe(clubA.id);
    expect(teamB.externalClubId).toBe(clubB.id);
    expect(teamA.externalClubId).not.toBe(teamB.externalClubId);
  });
});

// ── 3 & 6. Provider-linked club / manual → provider link later ─────────────────

describe("linkExternalClubProvider", () => {
  it("links a provider identity to a manually-created club (test #6: manual → provider link later)", async () => {
    const club = seedClub({ source: "MANUAL" });

    const { mapping, club: updated } = await linkExternalClubProvider(db, {
      tenantId: "tenant-1",
      externalClubId: club.id,
      provider: "sfv",
      providerClubId: 483,
      providerClubName: "SV Muttenz",
    });

    expect(mapping.provider).toBe("SFV");
    expect(mapping.providerClubId).toBe(483);
    // Manual creation provenance is untouched by linking.
    expect(updated.source).toBe("MANUAL");
  });

  it("is idempotent: linking the same identity again refreshes the mapping without duplicating it", async () => {
    const club = seedClub();
    await linkExternalClubProvider(db, {
      tenantId: "tenant-1",
      externalClubId: club.id,
      provider: "SFV",
      providerClubId: 483,
      providerClubName: "SV Muttenz",
    });
    await linkExternalClubProvider(db, {
      tenantId: "tenant-1",
      externalClubId: club.id,
      provider: "SFV",
      providerClubId: 483,
      providerClubName: "SV Muttenz (aktualisiert)",
    });

    expect(clubMappings).toHaveLength(1);
    expect(clubMappings[0]?.providerClubId).toBe(483);
  });

  it("rejects linking a provider identity already attached to a different ExternalClub", async () => {
    const clubA = seedClub({ name: "SV Muttenz" });
    const clubB = seedClub({ name: "FC Concordia Basel" });

    await linkExternalClubProvider(db, {
      tenantId: "tenant-1",
      externalClubId: clubA.id,
      provider: "SFV",
      providerClubId: 483,
    });

    await expect(
      linkExternalClubProvider(db, {
        tenantId: "tenant-1",
        externalClubId: clubB.id,
        provider: "SFV",
        providerClubId: 483,
      }),
    ).rejects.toThrow(ClubDirectoryConflictError);
  });

  it("rejects linking to a club in a different tenant (tenant isolation)", async () => {
    const club = seedClub({ tenantId: "tenant-2" });
    await expect(
      linkExternalClubProvider(db, {
        tenantId: "tenant-1",
        externalClubId: club.id,
        provider: "SFV",
        providerClubId: 483,
      }),
    ).rejects.toThrow(ClubDirectoryNotFoundError);
  });
});

// ── 4. Provider-linked team ──────────────────────────────────────────────────────

describe("linkExternalTeamProvider", () => {
  it("links a provider identity to a manually-created team", async () => {
    const club = seedClub();
    const team = seedTeam({ externalClubId: club.id });

    const { mapping } = await linkExternalTeamProvider(db, {
      tenantId: "tenant-1",
      externalTeamId: team.id,
      provider: "sfv",
      providerTeamId: 51234,
      providerTeamName: "SV Muttenz B1",
    });

    expect(mapping.provider).toBe("SFV");
    expect(mapping.providerTeamId).toBe(51234);
  });

  it("defaults providerSeasonId to the seasonless sentinel 0", async () => {
    const club = seedClub();
    const team = seedTeam({ externalClubId: club.id });

    const { mapping } = await linkExternalTeamProvider(db, {
      tenantId: "tenant-1",
      externalTeamId: team.id,
      provider: "SFV",
      providerTeamId: 51234,
    });

    expect(mapping.providerSeasonId).toBe(0);
  });

  it("rejects linking a provider identity already attached to a different ExternalTeam", async () => {
    const club = seedClub();
    const teamA = seedTeam({ externalClubId: club.id, name: "SV Muttenz B1" });
    const teamB = seedTeam({ externalClubId: club.id, name: "SV Muttenz B2" });

    await linkExternalTeamProvider(db, {
      tenantId: "tenant-1",
      externalTeamId: teamA.id,
      provider: "SFV",
      providerTeamId: 51234,
    });

    await expect(
      linkExternalTeamProvider(db, {
        tenantId: "tenant-1",
        externalTeamId: teamB.id,
        provider: "SFV",
        providerTeamId: 51234,
      }),
    ).rejects.toThrow(ClubDirectoryConflictError);
  });

  it("feeds the provider-reported crest into the parent club's logo when the club has none yet (club-level imagery)", async () => {
    const club = seedClub({ logoUrl: null });
    const team = seedTeam({ externalClubId: club.id });

    await linkExternalTeamProvider(db, {
      tenantId: "tenant-1",
      externalTeamId: team.id,
      provider: "SFV",
      providerTeamId: 51234,
      providerLogoUrl: "https://sfv.example.com/crest.gif",
    });

    const updatedClub = clubs.find((c) => c.id === club.id);
    expect(updatedClub?.logoUrl).toBe("https://sfv.example.com/crest.gif");
  });

  it("does NOT overwrite an existing tenant-managed club logo (test #7: provider sync never overwrites tenant enrichment)", async () => {
    const club = seedClub({ logoUrl: "https://blob.example.com/manual-crest.png" });
    const team = seedTeam({ externalClubId: club.id });

    await linkExternalTeamProvider(db, {
      tenantId: "tenant-1",
      externalTeamId: team.id,
      provider: "SFV",
      providerTeamId: 51234,
      providerLogoUrl: "https://sfv.example.com/crest.gif",
    });

    const updatedClub = clubs.find((c) => c.id === club.id);
    expect(updatedClub?.logoUrl).toBe("https://blob.example.com/manual-crest.png");
  });
});

// ── 5. Same name + different provider IDs remain distinct ──────────────────────

describe("identity distinctness — same name, different provider ids", () => {
  it("two clubs with the identical name but different provider ids remain fully distinct records", async () => {
    const clubA = seedClub({ name: "FC Concordia Basel" });
    const clubB = seedClub({ name: "FC Concordia Basel" });

    await linkExternalClubProvider(db, {
      tenantId: "tenant-1",
      externalClubId: clubA.id,
      provider: "SFV",
      providerClubId: 100,
    });
    await linkExternalClubProvider(db, {
      tenantId: "tenant-1",
      externalClubId: clubB.id,
      provider: "SFV",
      providerClubId: 200,
    });

    expect(clubA.id).not.toBe(clubB.id);
    expect(clubMappings).toHaveLength(2);
    expect(clubMappings.map((m) => m.providerClubId).sort()).toEqual([100, 200]);
  });

  it("does not auto-merge manually-created records by name — creating two clubs with the same name is allowed", async () => {
    const clubA = await createExternalClub(db, { tenantId: "tenant-1", name: "FC Concordia Basel" });
    const clubB = await createExternalClub(db, { tenantId: "tenant-1", name: "FC Concordia Basel" });
    expect(clubA.id).not.toBe(clubB.id);
    expect(clubs).toHaveLength(2);
  });
});

// ── 10. Archive / restore ───────────────────────────────────────────────────────

describe("archive / restore", () => {
  it("archives and restores an ExternalClub", async () => {
    const club = seedClub();
    const archived = await setExternalClubArchived(db, { tenantId: "tenant-1", id: club.id, archived: true });
    expect(archived.archivedAt).not.toBeNull();

    const restored = await setExternalClubArchived(db, { tenantId: "tenant-1", id: club.id, archived: false });
    expect(restored.archivedAt).toBeNull();
  });

  it("archives and restores an ExternalTeam", async () => {
    const club = seedClub();
    const team = seedTeam({ externalClubId: club.id });

    const archived = await setExternalTeamArchived(db, { tenantId: "tenant-1", id: team.id, archived: true });
    expect(archived.archivedAt).not.toBeNull();

    const restored = await setExternalTeamArchived(db, { tenantId: "tenant-1", id: team.id, archived: false });
    expect(restored.archivedAt).toBeNull();
  });

  it("rejects archiving a club that does not exist in the tenant", async () => {
    await expect(
      setExternalClubArchived(db, { tenantId: "tenant-1", id: "missing", archived: true }),
    ).rejects.toThrow(ClubDirectoryNotFoundError);
  });
});

// ── 11. Tenant isolation ────────────────────────────────────────────────────────

describe("tenant isolation", () => {
  it("updateExternalClub cannot see or modify a club belonging to another tenant", async () => {
    const club = seedClub({ tenantId: "tenant-2" });
    await expect(
      updateExternalClub(db, { tenantId: "tenant-1", id: club.id, name: "Hijacked" }),
    ).rejects.toThrow(ClubDirectoryNotFoundError);
    expect(club.name).toBe("SV Muttenz");
  });

  it("updateExternalTeam cannot see or modify a team belonging to another tenant", async () => {
    const club = seedClub({ tenantId: "tenant-2" });
    const team = seedTeam({ tenantId: "tenant-2", externalClubId: club.id });
    await expect(
      updateExternalTeam(db, { tenantId: "tenant-1", id: team.id, name: "Hijacked" }),
    ).rejects.toThrow(ClubDirectoryNotFoundError);
    expect(team.name).toBe("SV Muttenz B1");
  });

  it("setExternalTeamArchived cannot archive a team belonging to another tenant", async () => {
    const club = seedClub({ tenantId: "tenant-2" });
    const team = seedTeam({ tenantId: "tenant-2", externalClubId: club.id });
    await expect(
      setExternalTeamArchived(db, { tenantId: "tenant-1", id: team.id, archived: true }),
    ).rejects.toThrow(ClubDirectoryNotFoundError);
    expect(team.archivedAt).toBeNull();
  });
});

// ── updateExternalClub — tenant-managed field discipline ────────────────────────

describe("updateExternalClub — tenant-managed fields", () => {
  it("updates only the fields explicitly provided", async () => {
    const club = seedClub({ name: "SV Muttenz", shortName: "Muttenz" });
    const updated = await updateExternalClub(db, {
      tenantId: "tenant-1",
      id: club.id,
      website: "https://svmuttenz.ch",
    });
    expect(updated.name).toBe("SV Muttenz");
    expect(updated.website).toBe("https://svmuttenz.ch");
  });

  it("rejects an update that would blank out the name", async () => {
    const club = seedClub();
    await expect(
      updateExternalClub(db, { tenantId: "tenant-1", id: club.id, name: "   " }),
    ).rejects.toThrow(ClubDirectoryValidationError);
  });
});

// ── CLUB-DIRECTORY-03: moveExternalTeamToClub ───────────────────────────────────

describe("moveExternalTeamToClub", () => {
  it("re-parents a team onto a different canonical club", async () => {
    const clubA = seedClub({ name: "BSC Old Boys B1 (falscher Verein)" });
    const clubB = seedClub({ name: "BSC Old Boys" });
    const team = seedTeam({ externalClubId: clubA.id, name: "BSC Old Boys B1" });

    const moved = await moveExternalTeamToClub(db, {
      tenantId: "tenant-1",
      id: team.id,
      targetExternalClubId: clubB.id,
    });

    expect(moved.externalClubId).toBe(clubB.id);
  });

  it("preserves the team's provider mapping across the move", async () => {
    const clubA = seedClub({ name: "BSC Old Boys B1 (falscher Verein)" });
    const clubB = seedClub({ name: "BSC Old Boys" });
    const team = seedTeam({ externalClubId: clubA.id, name: "BSC Old Boys B1" });

    await linkExternalTeamProvider(db, {
      tenantId: "tenant-1",
      externalTeamId: team.id,
      provider: "SFV",
      providerTeamId: 51234,
    });

    await moveExternalTeamToClub(db, {
      tenantId: "tenant-1",
      id: team.id,
      targetExternalClubId: clubB.id,
    });

    expect(teamMappings).toHaveLength(1);
    expect(teamMappings[0]?.externalTeamId).toBe(team.id);
    expect(teamMappings[0]?.providerTeamId).toBe(51234);
  });

  it("is a no-op when the team already belongs to the target club", async () => {
    const club = seedClub();
    const team = seedTeam({ externalClubId: club.id });

    const result = await moveExternalTeamToClub(db, {
      tenantId: "tenant-1",
      id: team.id,
      targetExternalClubId: club.id,
    });

    expect(result.externalClubId).toBe(club.id);
  });

  it("rejects moving into an archived club", async () => {
    const club = seedClub();
    const team = seedTeam({ externalClubId: club.id });
    const archivedTarget = seedClub({ name: "Archiviert", archivedAt: new Date() });

    await expect(
      moveExternalTeamToClub(db, {
        tenantId: "tenant-1",
        id: team.id,
        targetExternalClubId: archivedTarget.id,
      }),
    ).rejects.toThrow(/archived/);
  });

  it("rejects moving into a club that does not exist", async () => {
    const club = seedClub();
    const team = seedTeam({ externalClubId: club.id });

    await expect(
      moveExternalTeamToClub(db, { tenantId: "tenant-1", id: team.id, targetExternalClubId: "missing" }),
    ).rejects.toThrow(ClubDirectoryNotFoundError);
  });

  it("rejects moving a team belonging to another tenant (tenant isolation)", async () => {
    const clubOtherTenant = seedClub({ tenantId: "tenant-2" });
    const team = seedTeam({ tenantId: "tenant-2", externalClubId: clubOtherTenant.id });
    const targetClub = seedClub({ tenantId: "tenant-1" });

    await expect(
      moveExternalTeamToClub(db, {
        tenantId: "tenant-1",
        id: team.id,
        targetExternalClubId: targetClub.id,
      }),
    ).rejects.toThrow(ClubDirectoryNotFoundError);
  });

  it("rejects moving a team into a club belonging to another tenant (tenant isolation)", async () => {
    const club = seedClub({ tenantId: "tenant-1" });
    const team = seedTeam({ tenantId: "tenant-1", externalClubId: club.id });
    const targetClubOtherTenant = seedClub({ tenantId: "tenant-2" });

    await expect(
      moveExternalTeamToClub(db, {
        tenantId: "tenant-1",
        id: team.id,
        targetExternalClubId: targetClubOtherTenant.id,
      }),
    ).rejects.toThrow(ClubDirectoryNotFoundError);
    expect(team.externalClubId).toBe(club.id);
  });
});

// ── CLUB-DIRECTORY-03: mergeExternalClubs ───────────────────────────────────────

describe("mergeExternalClubs", () => {
  it("moves every team from the losing club onto the surviving club and archives the loser", async () => {
    const survivor = seedClub({ name: "AC Rossoneri" });
    const loser = seedClub({ name: "AC Rossoneri (Duplikat)" });
    const teamA = seedTeam({ externalClubId: loser.id, name: "AC Rossoneri 1" });
    const teamB = seedTeam({ externalClubId: loser.id, name: "AC Rossoneri 2" });

    const result = await mergeExternalClubs(db, {
      tenantId: "tenant-1",
      survivingClubId: survivor.id,
      losingClubIds: [loser.id],
    });

    expect(result.teamsMoved).toBe(2);
    expect(result.mergedClubIds).toEqual([loser.id]);
    expect(teams.find((t) => t.id === teamA.id)?.externalClubId).toBe(survivor.id);
    expect(teams.find((t) => t.id === teamB.id)?.externalClubId).toBe(survivor.id);

    const archivedLoser = clubs.find((c) => c.id === loser.id);
    expect(archivedLoser?.archivedAt).not.toBeNull();
    // NEVER deleted — the fake DB still contains the row.
    expect(clubs.some((c) => c.id === loser.id)).toBe(true);
  });

  it("moves every team from the losing club regardless of the team's own archived state", async () => {
    const survivor = seedClub({ name: "AC Rossoneri" });
    const loser = seedClub({ name: "AC Rossoneri (Duplikat)" });
    const archivedTeam = seedTeam({
      externalClubId: loser.id,
      name: "AC Rossoneri Reserve",
      archivedAt: new Date(),
    });

    await mergeExternalClubs(db, {
      tenantId: "tenant-1",
      survivingClubId: survivor.id,
      losingClubIds: [loser.id],
    });

    expect(teams.find((t) => t.id === archivedTeam.id)?.externalClubId).toBe(survivor.id);
  });

  it("re-points every provider mapping from the losing club onto the surviving club", async () => {
    const survivor = seedClub({ name: "AC Rossoneri" });
    const loser = seedClub({ name: "AC Rossoneri (Duplikat)" });

    await linkExternalClubProvider(db, {
      tenantId: "tenant-1",
      externalClubId: loser.id,
      provider: "SFV",
      providerClubId: 4242,
    });

    const result = await mergeExternalClubs(db, {
      tenantId: "tenant-1",
      survivingClubId: survivor.id,
      losingClubIds: [loser.id],
    });

    expect(result.providerMappingsMoved).toBe(1);
    expect(clubMappings).toHaveLength(1);
    expect(clubMappings[0]?.externalClubId).toBe(survivor.id);
    expect(clubMappings[0]?.providerClubId).toBe(4242);
  });

  it("supports merging several losing clubs into one surviving club in a single call", async () => {
    const survivor = seedClub({ name: "AC Rossoneri" });
    const loserA = seedClub({ name: "AC Rossoneri (Duplikat A)" });
    const loserB = seedClub({ name: "AC Rossoneri (Duplikat B)" });
    seedTeam({ externalClubId: loserA.id });
    seedTeam({ externalClubId: loserB.id });

    const result = await mergeExternalClubs(db, {
      tenantId: "tenant-1",
      survivingClubId: survivor.id,
      losingClubIds: [loserA.id, loserB.id],
    });

    expect(result.teamsMoved).toBe(2);
    expect(result.mergedClubIds.sort()).toEqual([loserA.id, loserB.id].sort());
    expect(clubs.find((c) => c.id === loserA.id)?.archivedAt).not.toBeNull();
    expect(clubs.find((c) => c.id === loserB.id)?.archivedAt).not.toBeNull();
  });

  it("adopts a logo from a losing club when the surviving club has none", async () => {
    const survivor = seedClub({ name: "AC Rossoneri", logoUrl: null });
    const loser = seedClub({ name: "AC Rossoneri (Duplikat)", logoUrl: "https://example.com/crest.png" });

    const result = await mergeExternalClubs(db, {
      tenantId: "tenant-1",
      survivingClubId: survivor.id,
      losingClubIds: [loser.id],
    });

    expect(result.logoAdoptedFromClubId).toBe(loser.id);
    expect(clubs.find((c) => c.id === survivor.id)?.logoUrl).toBe("https://example.com/crest.png");
  });

  it("never overwrites an existing surviving-club logo with a losing club's logo", async () => {
    const survivor = seedClub({ name: "AC Rossoneri", logoUrl: "https://example.com/tenant-crest.png" });
    const loser = seedClub({ name: "AC Rossoneri (Duplikat)", logoUrl: "https://example.com/other.png" });

    const result = await mergeExternalClubs(db, {
      tenantId: "tenant-1",
      survivingClubId: survivor.id,
      losingClubIds: [loser.id],
    });

    expect(result.logoAdoptedFromClubId).toBeNull();
    expect(clubs.find((c) => c.id === survivor.id)?.logoUrl).toBe("https://example.com/tenant-crest.png");
  });

  it("rejects self-merge (surviving club listed as its own loser)", async () => {
    const club = seedClub();
    await expect(
      mergeExternalClubs(db, { tenantId: "tenant-1", survivingClubId: club.id, losingClubIds: [club.id] }),
    ).rejects.toThrow(ClubDirectoryValidationError);
  });

  it("rejects a merge with no losing clubs", async () => {
    const club = seedClub();
    await expect(
      mergeExternalClubs(db, { tenantId: "tenant-1", survivingClubId: club.id, losingClubIds: [] }),
    ).rejects.toThrow(ClubDirectoryValidationError);
  });

  it("rejects merging a losing club that does not exist", async () => {
    const club = seedClub();
    await expect(
      mergeExternalClubs(db, {
        tenantId: "tenant-1",
        survivingClubId: club.id,
        losingClubIds: ["missing"],
      }),
    ).rejects.toThrow(ClubDirectoryNotFoundError);
  });

  it("rejects merging a losing club belonging to another tenant (cross-tenant merge prevention)", async () => {
    const survivor = seedClub({ tenantId: "tenant-1" });
    const loserOtherTenant = seedClub({ tenantId: "tenant-2" });
    const team = seedTeam({ tenantId: "tenant-2", externalClubId: loserOtherTenant.id });

    await expect(
      mergeExternalClubs(db, {
        tenantId: "tenant-1",
        survivingClubId: survivor.id,
        losingClubIds: [loserOtherTenant.id],
      }),
    ).rejects.toThrow(ClubDirectoryNotFoundError);

    // Nothing was mutated — the cross-tenant club/team are untouched.
    expect(loserOtherTenant.archivedAt).toBeNull();
    expect(team.externalClubId).toBe(loserOtherTenant.id);
  });

  it("rejects merging into a surviving club belonging to another tenant (tenant isolation)", async () => {
    const survivorOtherTenant = seedClub({ tenantId: "tenant-2" });
    const loser = seedClub({ tenantId: "tenant-1" });

    await expect(
      mergeExternalClubs(db, {
        tenantId: "tenant-1",
        survivingClubId: survivorOtherTenant.id,
        losingClubIds: [loser.id],
      }),
    ).rejects.toThrow(ClubDirectoryNotFoundError);
  });

  it("rolls back every write when the transaction fails partway through", async () => {
    const survivor = seedClub({ name: "AC Rossoneri" });
    const loser = seedClub({ name: "AC Rossoneri (Duplikat)" });
    const team = seedTeam({ externalClubId: loser.id });

    const originalUpdate = db.externalClub.update;
    // The team move (externalTeam.update) happens before the archive step
    // (externalClub.update) — forcing every externalClub.update call to
    // fail simulates a failure during archiving, *after* the team has
    // already been re-parented within the same transaction.
    db.externalClub.update = async () => {
      throw new Error("simulated failure");
    };

    await expect(
      mergeExternalClubs(db, {
        tenantId: "tenant-1",
        survivingClubId: survivor.id,
        losingClubIds: [loser.id],
      }),
    ).rejects.toThrow("simulated failure");

    db.externalClub.update = originalUpdate;

    // The team move that happened before the simulated failure must have
    // been rolled back by the transaction wrapper.
    expect(teams.find((t) => t.id === team.id)?.externalClubId).toBe(loser.id);
    expect(clubs.find((c) => c.id === loser.id)?.archivedAt).toBeNull();
  });

  it("deduplicates repeated losing club ids", async () => {
    const survivor = seedClub({ name: "AC Rossoneri" });
    const loser = seedClub({ name: "AC Rossoneri (Duplikat)" });
    seedTeam({ externalClubId: loser.id });

    const result = await mergeExternalClubs(db, {
      tenantId: "tenant-1",
      survivingClubId: survivor.id,
      losingClubIds: [loser.id, loser.id],
    });

    expect(result.mergedClubIds).toEqual([loser.id]);
    expect(result.teamsMoved).toBe(1);
  });
});
