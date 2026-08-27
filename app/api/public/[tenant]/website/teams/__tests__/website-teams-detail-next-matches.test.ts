import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  tenantFindFirst: vi.fn(),
  getPublicTeamDetail: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    tenant: { findFirst: mocks.tenantFindFirst },
  },
}));

vi.mock("@/lib/website/public-teams-feed", () => ({
  getPublicTeamDetail: mocks.getPublicTeamDetail,
}));

const { GET } = await import("../[slug]/route");

const ACTIVE_TENANT = {
  id: "tenant-fca",
  key: "fc-allschwil",
  name: "FC Allschwil",
  status: "ACTIVE",
  websiteEnabled: true,
};

function makeRequest(slug = "e1"): NextRequest {
  return new NextRequest(
    `http://localhost/api/public/fc-allschwil/website/teams/${slug}`,
    { method: "GET" },
  );
}

function makeParams(slug = "e1") {
  return { params: Promise.resolve({ tenant: "fc-allschwil", slug }) };
}

describe("GET /api/public/[tenant]/website/teams/[slug] — nextMatches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tenantFindFirst.mockResolvedValue(ACTIVE_TENANT);
    mocks.getPublicTeamDetail.mockResolvedValue({
      name: "FC Example E1",
      displayName: "FC Example E1 2026/27",
      slug: "e1",
      category: "JUNIOREN",
      ageGroup: null,
      genderGroup: null,
      shortName: "E1",
      season: { key: "2026-2027", name: "Saison 2026/27" },
      description: null,
      heroImage: null,
      squad: [],
      trainers: [],
      training: [],
      nextMatches: [
        {
          id: "event-home",
          startAt: new Date("2026-09-01T18:00:00.000Z"),
          status: "SCHEDULED",
          home: {
            teamId: "team-e1",
            name: "FC Example E1",
            shortName: "E1",
            clubName: "FC Allschwil",
            logoUrl: "https://cdn.example.com/tenant.png",
          },
          away: {
            teamId: null,
            name: "Opponent FC",
            shortName: "Opp",
            clubName: "Opponent Club",
            logoUrl: "https://cdn.example.com/opponent.png",
          },
          isHomeTeam: true,
          isAwayTeam: false,
          opponent: {
            name: "Opponent FC",
            shortName: "Opp",
            clubName: "Opponent Club",
            logoUrl: "https://cdn.example.com/opponent.png",
          },
          score: null,
          resultPerspective: null,
          venue: {
            name: "Sportanlage Brüel",
            address: "Im Brüel",
          },
          competition: {
            name: "Junioren E",
          },
        },
      ],
      results: [
        {
          id: "event-completed",
          startAt: new Date("2026-07-01T18:00:00.000Z"),
          status: "COMPLETED",
          home: {
            teamId: "team-e1",
            name: "FC Example E1",
            shortName: "E1",
            clubName: "FC Allschwil",
            logoUrl: "https://cdn.example.com/tenant.png",
          },
          away: {
            teamId: null,
            name: "Opponent FC",
            shortName: "Opp",
            clubName: "Opponent Club",
            logoUrl: "https://cdn.example.com/opponent.png",
          },
          isHomeTeam: true,
          isAwayTeam: false,
          opponent: {
            name: "Opponent FC",
            shortName: "Opp",
            clubName: "Opponent Club",
            logoUrl: "https://cdn.example.com/opponent.png",
          },
          score: { home: 3, away: 1 },
          resultPerspective: "WON",
          venue: {
            name: "Sportanlage Brüel",
            address: "Im Brüel",
          },
          competition: {
            name: "Junioren E",
          },
        },
      ],
    });
  });

  it("N. returns existing team detail fields plus nextMatches and results", async () => {
    const response = await GET(makeRequest(), makeParams());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.team.nextMatches).toHaveLength(1);
    expect(body.data.team.results).toHaveLength(1);
    expect(body.data.team.results[0].resultPerspective).toBe("WON");
    expect(body.data.team.name).toBe("FC Example E1");
    expect(body.data.team.squad).toEqual([]);
    expect(body.data.team.training).toEqual([]);
    expect(body.version).toBeTruthy();
    expect(body.tenant.key).toBe("fc-allschwil");
  });

  it("N. keeps unknown team slug behavior unchanged", async () => {
    mocks.getPublicTeamDetail.mockResolvedValue(null);

    const response = await GET(makeRequest("missing"), makeParams("missing"));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Team not found.");
  });
});
