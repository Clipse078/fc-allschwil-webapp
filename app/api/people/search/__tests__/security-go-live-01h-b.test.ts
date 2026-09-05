import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireContext: vi.fn(),
  teamSeasonFindFirst: vi.fn(),
  personFindMany: vi.fn(),
  getAllowedBirthYearsForSeason: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-tenant-context", () => ({
  requireApiTenantPermissionContext: mocks.requireContext,
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    teamSeason: { findFirst: mocks.teamSeasonFindFirst },
    person: { findMany: mocks.personFindMany },
  },
}));
vi.mock("@/lib/teams/jahrgang-rules", () => ({
  getAllowedBirthYearsForSeason: mocks.getAllowedBirthYearsForSeason,
}));

import { GET } from "@/app/api/people/search/route";

const tenantAPerson = {
  id: "person-a",
  firstName: "Alice",
  lastName: "TenantA",
  displayName: "Alice A",
  email: "alice@a.test",
  phone: "+41000000000",
  dateOfBirth: new Date("2012-03-04T00:00:00.000Z"),
  isActive: true,
  isPlayer: true,
  isTrainer: false,
};

function request(params = "q=Alice") {
  return new NextRequest(`http://localhost/api/people/search?${params}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireContext.mockResolvedValue({
    ok: true,
    context: { tenantId: "tenant-a", actorUserId: "actor-a" },
  });
  mocks.personFindMany.mockImplementation(async (args: { where: { tenantId?: string } }) =>
    args.where.tenantId === "tenant-a" ? [tenantAPerson] : [],
  );
  mocks.getAllowedBirthYearsForSeason.mockReturnValue([2012]);
});

describe("SECURITY-GO-LIVE-01H-B GET /api/people/search", () => {
  it("1/2. returns Tenant A data and applies tenant ownership in the Person query", async () => {
    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      { ...tenantAPerson, dateOfBirth: "2012-03-04T00:00:00.000Z" },
    ]);
    expect(mocks.personFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "tenant-a", isActive: true }),
      }),
    );
  });

  it("3. rejects a Tenant B teamSeasonId before any Person query", async () => {
    mocks.teamSeasonFindFirst.mockResolvedValue(null);

    const response = await GET(request("q=Alice&mode=player&teamSeasonId=team-season-b"));

    expect(response.status).toBe(404);
    expect(mocks.teamSeasonFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "team-season-b", team: { tenantId: "tenant-a" } },
      }),
    );
    expect(mocks.personFindMany).not.toHaveBeenCalled();
  });

  it("4. preserves player search fields, birth-year filtering, and roster exclusion", async () => {
    mocks.teamSeasonFindFirst.mockResolvedValue({
      season: { startDate: new Date("2025-07-01T00:00:00.000Z") },
      team: { ageGroup: "U14" },
      playerSquadMembers: [{ personId: "already-rostered" }],
    });
    mocks.personFindMany.mockResolvedValue([
      tenantAPerson,
      { ...tenantAPerson, id: "already-rostered" },
      { ...tenantAPerson, id: "wrong-year", dateOfBirth: new Date("2000-01-01") },
    ]);

    const response = await GET(request("q=Alice&mode=player&teamSeasonId=team-season-a"));
    const body = await response.json();

    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      id: "person-a",
      email: "alice@a.test",
      phone: "+41000000000",
      dateOfBirth: "2012-03-04T00:00:00.000Z",
    });
  });

  it("scopes trainer team-season lookup to Tenant A as well", async () => {
    mocks.teamSeasonFindFirst.mockResolvedValue({ trainerTeamMembers: [] });

    await GET(request("q=Alice&mode=trainer&teamSeasonId=team-season-a"));

    expect(mocks.teamSeasonFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "team-season-a", team: { tenantId: "tenant-a" } },
      }),
    );
  });

  it("5. fails closed without valid tenant permission context", async () => {
    mocks.requireContext.mockResolvedValue({ ok: false, status: 403, error: "Forbidden" });

    const response = await GET(request());

    expect(response.status).toBe(403);
    expect(mocks.personFindMany).not.toHaveBeenCalled();
  });
});
