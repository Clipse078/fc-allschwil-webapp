/**
 * SCE-SPORTING-IDENTITY-01 — GET /website/matches matchIdentity route tests.
 */

import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  tenantFindFirst: vi.fn(),
  eventFindMany: vi.fn(),
  externalClubProviderMappingFindMany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    tenant: { findFirst: mocks.tenantFindFirst },
    event: { findMany: mocks.eventFindMany },
    externalClubProviderMapping: {
      findMany: mocks.externalClubProviderMappingFindMany,
    },
  },
}));

const { GET: getMatches } = await import("../route");

const ACTIVE_TENANT = {
  id: "tenant-fca",
  key: "fc-allschwil",
  name: "FC Allschwil",
  status: "ACTIVE",
  websiteEnabled: true,
  approvedDataOnly: false,
  logoUrl: "https://cdn.example.com/fca.png",
};

const FUTURE_DATE = new Date("2026-11-08T15:00:00.000Z");

function makeFeedRow() {
  return {
    id: "event-koeniz",
    title: "3. Liga — vs FC Köniz",
    description: null,
    location: "Sportanlage Moos",
    type: "MATCH",
    source: "SFV",
    status: "SCHEDULED",
    startAt: FUTURE_DATE,
    endAt: null,
    opponentName: "FC Köniz",
    organizerName: null,
    competitionLabel: "3. Liga",
    homeAway: "HOME",
    resultLabel: null,
    meetingTime: null,
    websiteVisible: true,
    infoboardVisible: false,
    homepageVisible: false,
    wochenplanVisible: false,
    trainingsplanVisible: false,
    teamPageVisible: false,
    remarks: null,
    pitchCode: null,
    homeDressingRoomCode: null,
    awayDressingRoomCode: null,
    season: {
      id: "s1",
      key: "2026-27",
      name: "Saison 2026/27",
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-06-30"),
      isActive: true,
    },
    team: {
      id: "team-fca",
      name: "FC Allschwil 1. Mannschaft",
      slug: "aktive-1",
      category: "AKTIVE",
      genderGroup: null,
      ageGroup: null,
    },
  };
}

function makePolicyRow() {
  return {
    id: "event-koeniz",
    status: "SCHEDULED",
    infoboardVisible: true,
    websiteVisible: true,
    trainingsplanVisible: false,
    homeAway: "HOME",
    organizerName: null,
    competitionLabel: "3. Liga",
    meetingTime: null,
    resultLabel: null,
    intermediateResultLabel: null,
    season: { key: "2026-27" },
    team: {
      id: "team-fca",
      name: "FC Allschwil 1. Mannschaft",
      shortName: null,
      alternativeName: null,
      infoboardDisplayName: null,
      infoboardTrainingDisplayName: null,
      infoboardMatchDisplayName: null,
      infoboardTournamentDisplayName: null,
    },
    opponentExternalClub: null,
    matchExternalMapping: {
      homeTeam: {
        id: "team-fca",
        name: "FC Allschwil 1. Mannschaft",
        shortName: null,
        alternativeName: null,
        infoboardDisplayName: null,
        infoboardTrainingDisplayName: null,
        infoboardMatchDisplayName: null,
        infoboardTournamentDisplayName: null,
      },
      awayTeam: null,
      homeExternalTeam: null,
      awayExternalTeam: {
        name: "FC Köniz",
        shortName: null,
        alternativeName: null,
        logoUrl: null,
        externalClub: {
          name: "FC Köniz",
          shortName: null,
          logoUrl: null,
        },
        providerMappings: [{ providerClubId: 100 }],
      },
    },
  };
}

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/public/fc-allschwil/website/matches");
}

function makeParams() {
  return { params: Promise.resolve({ tenant: "fc-allschwil" }) };
}

describe("GET /api/public/[tenant]/website/matches — matchIdentity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tenantFindFirst.mockResolvedValue(ACTIVE_TENANT);
    mocks.externalClubProviderMappingFindMany.mockResolvedValue([
      {
        providerClubId: 100,
        externalClub: { logoUrl: "https://cdn.example.com/koeniz.png" },
      },
    ]);
    mocks.eventFindMany.mockImplementation((args: { select?: { matchExternalMapping?: unknown } }) => {
      if (args.select?.matchExternalMapping) {
        return Promise.resolve([makePolicyRow()]);
      }
      return Promise.resolve([makeFeedRow()]);
    });
  });

  it("returns matchIdentity on each match", async () => {
    const res = await getMatches(makeRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.matches[0].matchIdentity).toBeDefined();
    expect(body.data.matches[0].matchIdentity.home.displayName).toBe("FC Allschwil 1. Mannschaft");
    expect(body.data.matches[0].matchIdentity.away.displayName).toBe("FC Köniz");
  });

  it("returns canonical away logoUrl from SCE identity", async () => {
    const res = await getMatches(makeRequest(), makeParams());
    const body = await res.json();

    expect(body.data.matches[0].matchIdentity.home.logoUrl).toBe("https://cdn.example.com/fca.png");
    expect(body.data.matches[0].matchIdentity.away.logoUrl).toBe("https://cdn.example.com/koeniz.png");
  });

  it("batch-loads match policies without per-match queries", async () => {
    await getMatches(makeRequest(), makeParams());

    const policyCalls = mocks.eventFindMany.mock.calls.filter(
      (call) => call[0]?.select?.matchExternalMapping,
    );
    expect(policyCalls).toHaveLength(1);
    expect(policyCalls[0][0].where.id.in).toEqual(["event-koeniz"]);
  });

  it("preserves existing status and score fields", async () => {
    mocks.eventFindMany.mockImplementation((args: { select?: { matchExternalMapping?: unknown } }) => {
      if (args.select?.matchExternalMapping) {
        return Promise.resolve([{ ...makePolicyRow(), status: "COMPLETED", resultLabel: "2:1" }]);
      }
      return Promise.resolve([
        { ...makeFeedRow(), status: "COMPLETED", resultLabel: "2:1" },
      ]);
    });

    const res = await getMatches(makeRequest(), makeParams());
    const body = await res.json();

    expect(body.data.matches[0].status).toBe("COMPLETED");
    expect(body.data.matches[0].resultLabel).toBe("2:1");
  });
});
