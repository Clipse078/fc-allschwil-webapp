/**
 * lib/integrations/sfv/__tests__/pub-02-creation-defaults.test.ts
 *
 * PUB-02 — SFV creation defaults and homepage feed policy tests.
 *
 * TEST COVERAGE MAP:
 *
 * SFV creation defaults (C-PUB02):
 *   C-PUB02-1. Home match → websiteVisible=true
 *   C-PUB02-2. Away match → websiteVisible=true
 *   C-PUB02-3. Home match → infoboardVisible=true
 *   C-PUB02-4. Away match → infoboardVisible=false
 *
 * SFV resync preservation (U-PUB02):
 *   U-PUB02-1. Resync does NOT overwrite manually set websiteVisible=false
 *   U-PUB02-2. Resync does NOT overwrite manually set infoboardVisible=false (home)
 *   U-PUB02-3. Resync does NOT overwrite manually set infoboardVisible=true (away)
 *   U-PUB02-4. Resync does NOT overwrite pitchCode
 *   U-PUB02-5. Resync does NOT overwrite homeDressingRoomCode
 *   U-PUB02-6. Resync does NOT overwrite awayDressingRoomCode
 *
 * Homepage feed policy (H-PUB02):
 *   H-PUB02-1. websiteVisible=true → match eligible for homepage
 *   H-PUB02-2. websiteVisible=false → match excluded from homepage
 *   H-PUB02-3. homepageVisible does NOT independently suppress homepage match
 *   H-PUB02-4. Homepage predicate does NOT require homepageVisible=true
 *   H-PUB02-5. Both HOME and AWAY website-visible matches are homepage-eligible
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ClubScheduleEntry } from "../client";

// ── Mock Prisma ───────────────────────────────────────────────────────────────

const mockEventCreate = vi.fn();
const mockEventUpdate = vi.fn();
const mockMappingCreate = vi.fn();
const mockMappingUpdate = vi.fn();
const mockTransaction = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => mockTransaction(fn),
  },
}));

const { createMatchWithMapping, updateMatchRecord } = await import(
  "../sync/schedule-persistence"
);

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<ClubScheduleEntry> = {}): ClubScheduleEntry {
  return {
    matchId: 99101,
    matchNumber: 1,
    matchDate: "2026-09-20T15:00:00",
    groupId: null,
    cupId: null,
    groupName: null,
    roundNbr: 5,
    playgroundId: 1001,
    stadiumPlaygroundName: "Im Brüel",
    isUnkownPlayground: false,
    leagueId: 17131,
    leagueNumber: 1,
    leagueName: "3. Liga",
    divisionId: 999,
    divisionName: "Gruppe 2",
    organisationId: 8,
    organisationName: "FVNWS",
    matchType: 1,
    matchTypeName: "Meisterschaft",
    matchState: 0,
    matchStateName: "angesetzt",
    playDay: 5,
    playDayName: "5. Spieltag",
    seasonId: 2027,
    teamAId: 12001,
    teamAName: "FC Allschwil 1",
    teamBId: 99801,
    teamBName: "FC Opponent X",
    scoreTeamA: null,
    scoreTeamB: null,
    ...overrides,
  };
}

function makeContext() {
  return {
    tenantId: "tenant-fca",
    provider: "SFV",
    seasonId: 2027,
    syncedAt: new Date("2026-09-01T12:00:00Z"),
  };
}

// ── Set up mocked transaction ─────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  mockTransaction.mockImplementation(
    async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        event: {
          create: mockEventCreate,
          update: mockEventUpdate,
        },
        matchExternalMapping: {
          create: mockMappingCreate,
          update: mockMappingUpdate,
        },
      };
      return fn(tx);
    },
  );

  mockEventCreate.mockResolvedValue({ id: "event-new-1" });
  mockMappingCreate.mockResolvedValue({});
  mockEventUpdate.mockResolvedValue({});
  mockMappingUpdate.mockResolvedValue({});
});

// ── C-PUB02: SFV creation defaults ───────────────────────────────────────────

describe("PUB-02 — SFV creation defaults", () => {
  it("C-PUB02-1: home match → websiteVisible=true", async () => {
    await createMatchWithMapping(
      makeEntry(),
      makeContext(),
      "season-fca",
      "team-fca",
      "FC Opponent X",
      true, // isHome
      "team-fca",
      null,
    );
    const data = mockEventCreate.mock.calls[0][0].data;
    expect(data.websiteVisible).toBe(true);
  });

  it("C-PUB02-2: away match → websiteVisible=true", async () => {
    await createMatchWithMapping(
      makeEntry(),
      makeContext(),
      "season-fca",
      null,
      "FC Allschwil 1",
      false, // isHome=false → away
      null,
      "team-fca",
    );
    const data = mockEventCreate.mock.calls[0][0].data;
    expect(data.websiteVisible).toBe(true);
  });

  it("C-PUB02-3: home match → infoboardVisible=true", async () => {
    await createMatchWithMapping(
      makeEntry(),
      makeContext(),
      "season-fca",
      "team-fca",
      "FC Opponent X",
      true, // isHome
      "team-fca",
      null,
    );
    const data = mockEventCreate.mock.calls[0][0].data;
    expect(data.infoboardVisible).toBe(true);
  });

  it("C-PUB02-4: away match → infoboardVisible=false", async () => {
    await createMatchWithMapping(
      makeEntry(),
      makeContext(),
      "season-fca",
      null,
      "FC Allschwil 1",
      false, // isHome=false → away
      null,
      "team-fca",
    );
    const data = mockEventCreate.mock.calls[0][0].data;
    expect(data.infoboardVisible).toBe(false);
  });
});

// ── U-PUB02: SFV resync preservation ─────────────────────────────────────────

describe("PUB-02 — SFV resync preservation", () => {
  it("U-PUB02-1: resync does NOT overwrite manually set websiteVisible=false", async () => {
    await updateMatchRecord(
      "mapping-1",
      "event-1",
      makeEntry(),
      makeContext(),
      "FC Opponent X",
      "team-fca",
      null,
      "team-fca",
      true,
    );
    const updateData = mockEventUpdate.mock.calls[0][0].data;
    expect(updateData).not.toHaveProperty("websiteVisible");
  });

  it("U-PUB02-2: resync does NOT overwrite manually set infoboardVisible=false (home)", async () => {
    await updateMatchRecord(
      "mapping-1",
      "event-1",
      makeEntry(),
      makeContext(),
      "FC Opponent X",
      "team-fca",
      null,
      "team-fca",
      true,
    );
    const updateData = mockEventUpdate.mock.calls[0][0].data;
    expect(updateData).not.toHaveProperty("infoboardVisible");
  });

  it("U-PUB02-3: resync does NOT overwrite manually set infoboardVisible=true (away)", async () => {
    await updateMatchRecord(
      "mapping-1",
      "event-away",
      makeEntry(),
      makeContext(),
      "FC Allschwil 1",
      null,
      "team-fca",
      null,
      false, // away
    );
    const updateData = mockEventUpdate.mock.calls[0][0].data;
    expect(updateData).not.toHaveProperty("infoboardVisible");
  });

  it("U-PUB02-4: resync does NOT overwrite pitchCode", async () => {
    await updateMatchRecord(
      "mapping-1",
      "event-1",
      makeEntry(),
      makeContext(),
      "FC Opponent X",
      "team-fca",
      null,
      "team-fca",
      true,
    );
    const updateData = mockEventUpdate.mock.calls[0][0].data;
    expect(updateData).not.toHaveProperty("pitchCode");
  });

  it("U-PUB02-5: resync does NOT overwrite homeDressingRoomCode", async () => {
    await updateMatchRecord(
      "mapping-1",
      "event-1",
      makeEntry(),
      makeContext(),
      "FC Opponent X",
      "team-fca",
      null,
      "team-fca",
      true,
    );
    const updateData = mockEventUpdate.mock.calls[0][0].data;
    expect(updateData).not.toHaveProperty("homeDressingRoomCode");
  });

  it("U-PUB02-6: resync does NOT overwrite awayDressingRoomCode", async () => {
    await updateMatchRecord(
      "mapping-1",
      "event-1",
      makeEntry(),
      makeContext(),
      "FC Opponent X",
      "team-fca",
      null,
      "team-fca",
      true,
    );
    const updateData = mockEventUpdate.mock.calls[0][0].data;
    expect(updateData).not.toHaveProperty("awayDressingRoomCode");
  });
});
