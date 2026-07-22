import { NextRequest } from "next/server";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiAnyPermission: vi.fn(),
  assignMatchcenterTeamMapping: vi.fn(),
}));

vi.mock(
  "@/lib/permissions/require-api-any-permission",
  () => ({
    requireApiAnyPermission:
      mocks.requireApiAnyPermission,
  }),
);

vi.mock(
  "@/lib/matchcenter/team-mapping-service",
  async () => {
    const actual = await vi.importActual<
      typeof import("@/lib/matchcenter/team-mapping-service")
    >("@/lib/matchcenter/team-mapping-service");

    return {
      ...actual,
      assignMatchcenterTeamMapping:
        mocks.assignMatchcenterTeamMapping,
    };
  },
);

vi.mock("@/lib/db/prisma", () => ({
  prisma: {},
}));

import { POST } from "../route";
import {
  MatchcenterTeamMappingNotFoundError,
  MatchcenterTeamMappingValidationError,
} from "@/lib/matchcenter/team-mapping-service";

const URL =
  "http://localhost/api/matchcenter/team-mappings";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/matchcenter/team-mappings", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.requireApiAnyPermission.mockResolvedValue({
      ok: true,
      status: 200,
      error: null,
      session: {
        user: {
          id: "user-1",
          tenantId: "tenant-1",
        },
      },
    });

    mocks.assignMatchcenterTeamMapping.mockResolvedValue({
      id: "mapping-1",
      tenantId: "tenant-1",
      teamId: "team-1",
      provider: "SFV",
      externalTeamId: 31927,
      externalSeasonId: 2027,
      providerTeamName: "FC Allschwil E1",
      providerIsActive: true,
      lastSyncedAt: new Date(
        "2026-07-22T18:00:00.000Z",
      ),
    });
  });

  it("requires events.manage", async () => {
    await POST(
      makeRequest({
        provider: "SFV",
        externalTeamId: 31927,
        externalSeasonId: 2027,
        teamId: "team-1",
      }),
    );

    expect(
      mocks.requireApiAnyPermission,
    ).toHaveBeenCalledWith(["events.manage"]);
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Unauthorized",
      session: null,
    });

    const response = await POST(
      makeRequest({
        provider: "SFV",
        externalTeamId: 31927,
        externalSeasonId: 2027,
        teamId: "team-1",
      }),
    );

    expect(response.status).toBe(401);
    expect(
      mocks.assignMatchcenterTeamMapping,
    ).not.toHaveBeenCalled();
  });

  it("returns 403 without tenant context", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue({
      ok: true,
      status: 200,
      error: null,
      session: {
        user: {
          id: "user-1",
          tenantId: null,
        },
      },
    });

    const response = await POST(
      makeRequest({
        provider: "SFV",
        externalTeamId: 31927,
        externalSeasonId: 2027,
        teamId: "team-1",
      }),
    );

    expect(response.status).toBe(403);
  });

  it("passes only the authenticated tenant to the service", async () => {
    const response = await POST(
      makeRequest({
        tenantId: "attacker-tenant",
        provider: "SFV",
        externalTeamId: 31927,
        externalSeasonId: 2027,
        teamId: "team-1",
        providerTeamName: "FC Allschwil E1",
      }),
    );

    expect(response.status).toBe(200);

    expect(
      mocks.assignMatchcenterTeamMapping,
    ).toHaveBeenCalledWith(
      expect.anything(),
      {
        tenantId: "tenant-1",
        provider: "SFV",
        externalTeamId: 31927,
        externalSeasonId: 2027,
        teamId: "team-1",
        providerTeamName: "FC Allschwil E1",
      },
    );
  });

  it("returns the mapping and sync requirement", async () => {
    const response = await POST(
      makeRequest({
        provider: "SFV",
        externalTeamId: 31927,
        externalSeasonId: 2027,
        teamId: "team-1",
      }),
    );

    expect(response.status).toBe(200);

    const payload = await response.json();

    expect(payload).toEqual(
      expect.objectContaining({
        mapping: expect.objectContaining({
          id: "mapping-1",
          teamId: "team-1",
        }),
        requiresScheduleSync: true,
      }),
    );
  });

  it("returns 400 for an invalid payload", async () => {
    const response = await POST(
      makeRequest({
        provider: "SFV",
        externalTeamId: "31927",
        externalSeasonId: 2027,
        teamId: "team-1",
      }),
    );

    expect(response.status).toBe(400);
    expect(
      mocks.assignMatchcenterTeamMapping,
    ).not.toHaveBeenCalled();
  });

  it("returns 400 for service validation errors", async () => {
    mocks.assignMatchcenterTeamMapping.mockRejectedValue(
      new MatchcenterTeamMappingValidationError(
        "provider is required.",
      ),
    );

    const response = await POST(
      makeRequest({
        provider: " ",
        externalTeamId: 31927,
        externalSeasonId: 2027,
        teamId: "team-1",
      }),
    );

    expect(response.status).toBe(400);
  });

  it("returns 404 when the tenant team is unavailable", async () => {
    mocks.assignMatchcenterTeamMapping.mockRejectedValue(
      new MatchcenterTeamMappingNotFoundError(
        "Active tenant team not found.",
      ),
    );

    const response = await POST(
      makeRequest({
        provider: "SFV",
        externalTeamId: 31927,
        externalSeasonId: 2027,
        teamId: "team-other",
      }),
    );

    expect(response.status).toBe(404);
  });

  it("returns 500 for an unexpected failure", async () => {
    mocks.assignMatchcenterTeamMapping.mockRejectedValue(
      new Error("Database unavailable"),
    );

    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const response = await POST(
      makeRequest({
        provider: "SFV",
        externalTeamId: 31927,
        externalSeasonId: 2027,
        teamId: "team-1",
      }),
    );

    expect(response.status).toBe(500);

    consoleError.mockRestore();
  });
});