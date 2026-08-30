/**
 * WEBSITE-CONSUMERS-01 — Public Teams API: OrgUnit Grouping + Active Season
 *
 * Covers the canonical publication contract for
 * GET /api/public/[tenant]/website/teams
 *
 * Assertions:
 *   1. Active-season team with websiteVisible=true appears in response.
 *   2. Team with websiteVisible=false is excluded.
 *   3. Team that belongs only to historical (inactive) seasons is excluded.
 *   4. Team appears with its primary OrgUnit from TeamSeasonOrgUnit.
 *   5. Teams without a primary OrgUnit assignment appear with orgUnit: null.
 *   6. No cross-tenant teams appear (tenantId enforced at DB level).
 *   7. response.data.teams[n].orgUnit.name is the canonical OrgUnit name,
 *      not a category enum string.
 *   8. Deprecated category field is still present for backward-compat.
 */

import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  tenantFindFirst: vi.fn(),
  teamFindMany: vi.fn(),
  teamExternalMappingFindMany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    tenant: { findFirst: mocks.tenantFindFirst },
    team: { findMany: mocks.teamFindMany },
    teamExternalMapping: { findMany: mocks.teamExternalMappingFindMany },
  },
}));

const { GET: getTeams } = await import("../route");

// ── Fixtures ─────────────────────────────────────────────────────────────────

const ACTIVE_TENANT = {
  id: "tenant-fca",
  key: "fc-allschwil",
  name: "FC Allschwil",
  status: "ACTIVE",
  websiteEnabled: true,
};

const BASE_URL = "http://localhost/api/public/fc-allschwil/website";

function makeRequest(query = ""): NextRequest {
  return new NextRequest(`${BASE_URL}/teams${query ? "?" + query : ""}`, {
    method: "GET",
  });
}

function makeParams(slug = "fc-allschwil") {
  return { params: Promise.resolve({ tenant: slug }) };
}

/** Minimal team row returned by Prisma findMany for the public feed. */
function makeTeamRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "team-1",
    name: "1. Mannschaft",
    slug: "1-mannschaft",
    category: "AKTIVE",
    genderGroup: null,
    ageGroup: null,
    sortOrder: 0,
    teamSeasons: [
      {
        id: "team-season-1",
        displayName: "1. Mannschaft 2025/26",
        shortName: "1M",
        season: { key: "2025-26", name: "Saison 2025/26" },
        orgUnits: [
          {
            isPrimary: true,
            displayOrder: 0,
            orgUnit: {
              id: "org-aktive",
              name: "Aktive",
              key: "aktive",
              sortOrder: 10,
            },
          },
        ],
      },
    ],
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/public/[tenant]/website/teams — OrgUnit grouping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tenantFindFirst.mockResolvedValue(ACTIVE_TENANT);
    mocks.teamFindMany.mockResolvedValue([]);
    mocks.teamExternalMappingFindMany.mockResolvedValue([]);
  });

  // 1. Basic happy path
  it("returns 200 with standard envelope shape", async () => {
    const res = await getTeams(makeRequest(), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("version");
    expect(body).toHaveProperty("data.teams");
    expect(Array.isArray(body.data.teams)).toBe(true);
    expect(body.tenant.key).toBe("fc-allschwil");
  });

  // 1. Active-season team appears
  it("active-season team with websiteVisible=true appears in response", async () => {
    mocks.teamFindMany.mockResolvedValue([makeTeamRow()]);
    const res = await getTeams(makeRequest(), makeParams());
    const body = await res.json();
    expect(body.data.teams).toHaveLength(1);
    expect(body.data.teams[0].id).toBe("team-1");
    expect(body.data.teams[0].displayName).toBe("1. Mannschaft 2025/26");
    expect(body.data.teams[0].season).toEqual({ key: "2025-26", name: "Saison 2025/26" });
  });

  // 2. websiteVisible=false → excluded at DB level (Prisma WHERE filters it)
  it("DB query applies tenantId + isActive + websiteVisible + active-season filter", async () => {
    await getTeams(makeRequest(), makeParams());
    const call = mocks.teamFindMany.mock.calls[0][0];
    expect(call.where.tenantId).toBe("tenant-fca");
    expect(call.where.isActive).toBe(true);
    expect(call.where.websiteVisible).toBe(true);
    // Active-season filter: `some:` constraint on teamSeasons
    expect(call.where.teamSeasons).toBeDefined();
    expect(call.where.teamSeasons).toHaveProperty("some");
  });

  // 4. OrgUnit data is included in response
  it("team appears with its canonical primary OrgUnit from TeamSeasonOrgUnit", async () => {
    mocks.teamFindMany.mockResolvedValue([makeTeamRow()]);
    const res = await getTeams(makeRequest(), makeParams());
    const body = await res.json();
    const team = body.data.teams[0];
    expect(team.orgUnit).not.toBeNull();
    expect(team.orgUnit.name).toBe("Aktive");
    expect(team.orgUnit.key).toBe("aktive");
    expect(team.orgUnit.id).toBe("org-aktive");
    expect(team.orgUnit.sortOrder).toBe(10);
    expect(team.orgUnit.isPrimary).toBe(true);
  });

  // 5. No OrgUnit assignment → orgUnit: null
  it("team with no OrgUnit assignment returns orgUnit: null", async () => {
    mocks.teamFindMany.mockResolvedValue([
      makeTeamRow({
        teamSeasons: [
          {
            displayName: "U12 2025/26",
            shortName: null,
            season: { key: "2025-26", name: "Saison 2025/26" },
            orgUnits: [],
          },
        ],
      }),
    ]);
    const res = await getTeams(makeRequest(), makeParams());
    const body = await res.json();
    expect(body.data.teams[0].orgUnit).toBeNull();
  });

  // 6. Tenant isolation
  it("applies tenant isolation — only the resolved tenant's id is passed to DB", async () => {
    const otherTenant = { ...ACTIVE_TENANT, id: "tenant-other", key: "other-club" };
    mocks.tenantFindFirst.mockResolvedValue(otherTenant);
    await getTeams(makeRequest(), makeParams("other-club"));
    const call = mocks.teamFindMany.mock.calls[0][0];
    expect(call.where.tenantId).toBe("tenant-other");
    expect(call.where.tenantId).not.toBe("tenant-fca");
  });

  // 7. OrgUnit name is canonical (not a category enum)
  it("orgUnit.name comes from OrgUnit model (canonical name), not from team.category enum", async () => {
    mocks.teamFindMany.mockResolvedValue([
      makeTeamRow({
        category: "JUNIOREN",
        teamSeasons: [
          {
            displayName: "E4 2025/26",
            shortName: "E4",
            season: { key: "2025-26", name: "Saison 2025/26" },
            orgUnits: [
              {
                isPrimary: true,
                displayOrder: 0,
                orgUnit: {
                  id: "org-junioren",
                  name: "Junioren",
                  key: "junioren",
                  sortOrder: 20,
                },
              },
            ],
          },
        ],
      }),
    ]);
    const res = await getTeams(makeRequest(), makeParams());
    const body = await res.json();
    const team = body.data.teams[0];
    // orgUnit.name must be the canonical OrgUnit name, not the category enum
    expect(team.orgUnit.name).toBe("Junioren");
    expect(team.orgUnit.name).not.toBe("JUNIOREN"); // not the enum value
  });

  // 8. Deprecated category field still present for backward compat
  it("deprecated category field is still present in response for backward compatibility", async () => {
    mocks.teamFindMany.mockResolvedValue([makeTeamRow()]);
    const res = await getTeams(makeRequest(), makeParams());
    const body = await res.json();
    expect(body.data.teams[0]).toHaveProperty("category");
    expect(body.data.teams[0].category).toBe("AKTIVE");
  });

  // OrgUnit fetched via TeamSeasonOrgUnit
  it("DB query selects orgUnits via teamSeasons.orgUnits nested relation", async () => {
    await getTeams(makeRequest(), makeParams());
    const call = mocks.teamFindMany.mock.calls[0][0];
    const teamSeasonsSelect = call.select?.teamSeasons?.select;
    expect(teamSeasonsSelect).toBeDefined();
    expect(teamSeasonsSelect).toHaveProperty("orgUnits");
    const orgUnitsSelect = teamSeasonsSelect.orgUnits.select;
    expect(orgUnitsSelect).toHaveProperty("isPrimary");
    expect(orgUnitsSelect).toHaveProperty("orgUnit");
  });

  // Multiple teams — ordering by OrgUnit.sortOrder
  it("teams are ordered by OrgUnit.sortOrder (canonical grouping order)", async () => {
    mocks.teamFindMany.mockResolvedValue([
      makeTeamRow({
        id: "team-junioren",
        name: "E4",
        sortOrder: 0,
        teamSeasons: [
          {
            displayName: "E4 2025/26",
            shortName: null,
            season: { key: "2025-26", name: "Saison 2025/26" },
            orgUnits: [
              {
                isPrimary: true,
                displayOrder: 0,
                orgUnit: { id: "org-jun", name: "Junioren", key: "junioren", sortOrder: 20 },
              },
            ],
          },
        ],
      }),
      makeTeamRow({
        id: "team-aktive",
        name: "1. Mannschaft",
        sortOrder: 0,
        teamSeasons: [
          {
            displayName: "1. Mannschaft 2025/26",
            shortName: null,
            season: { key: "2025-26", name: "Saison 2025/26" },
            orgUnits: [
              {
                isPrimary: true,
                displayOrder: 0,
                orgUnit: { id: "org-akt", name: "Aktive", key: "aktive", sortOrder: 10 },
              },
            ],
          },
        ],
      }),
    ]);
    const res = await getTeams(makeRequest(), makeParams());
    const body = await res.json();
    // Aktive (sortOrder=10) should come before Junioren (sortOrder=20)
    expect(body.data.teams[0].id).toBe("team-aktive");
    expect(body.data.teams[1].id).toBe("team-junioren");
  });

  // 404 on unknown tenant
  it("returns 404 when tenant is not found", async () => {
    mocks.tenantFindFirst.mockResolvedValue(null);
    const res = await getTeams(makeRequest(), makeParams("unknown-slug"));
    expect(res.status).toBe(404);
  });

  // 403 when website disabled
  it("returns 403 when website integration is not enabled for tenant", async () => {
    mocks.tenantFindFirst.mockResolvedValue({ ...ACTIVE_TENANT, websiteEnabled: false });
    const res = await getTeams(makeRequest(), makeParams());
    expect(res.status).toBe(403);
  });

  // Internal fields not exposed
  it("internal fields (isActive, websiteVisible, tenantId, orgUnitId) are not exposed", async () => {
    mocks.teamFindMany.mockResolvedValue([makeTeamRow()]);
    const res = await getTeams(makeRequest(), makeParams());
    const body = await res.json();
    const team = body.data.teams[0];
    expect(team).not.toHaveProperty("isActive");
    expect(team).not.toHaveProperty("websiteVisible");
    expect(team).not.toHaveProperty("tenantId");
    expect(team).not.toHaveProperty("orgUnitId");
    expect(team).not.toHaveProperty("infoboardVisible");
  });
});
