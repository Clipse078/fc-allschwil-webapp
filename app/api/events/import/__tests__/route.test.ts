import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiPermission: vi.fn(),
  parseCsvEvents: vi.fn(),
  eventImportRunCreate: vi.fn(),
  eventImportRunUpdate: vi.fn(),
  seasonFindFirst: vi.fn(),
  teamSeasonFindMany: vi.fn(),
  eventCreate: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-permission", () => ({
  requireApiPermission: mocks.requireApiPermission,
}));

vi.mock("@/lib/events/parse-csv-events", () => ({
  parseCsvEvents: mocks.parseCsvEvents,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    eventImportRun: {
      create: mocks.eventImportRunCreate,
      update: mocks.eventImportRunUpdate,
    },
    season: { findFirst: mocks.seasonFindFirst },
    teamSeason: { findMany: mocks.teamSeasonFindMany },
    event: { create: mocks.eventCreate },
  },
}));

import { POST } from "../route";

function makeRequest(): NextRequest {
  const formData = new FormData();
  formData.set(
    "file",
    new File(["type,team\nTOURNAMENT,E1"], "events.csv", {
      type: "text/csv",
    }),
  );
  return new NextRequest("http://localhost/api/events/import", {
    method: "POST",
    body: formData,
  });
}

describe("POST /api/events/import canonical tournament TeamSeason", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiPermission.mockResolvedValue({
      ok: true,
      session: { user: { activeTenantId: "tenant-a" } },
    });
    mocks.eventImportRunCreate.mockResolvedValue({ id: "run-a" });
    mocks.eventImportRunUpdate.mockResolvedValue({ id: "run-a" });
    mocks.seasonFindFirst.mockResolvedValue({ id: "season-a" });
    mocks.teamSeasonFindMany.mockResolvedValue([
      {
        id: "team-season-a",
        teamId: "team-a",
        team: { name: "E1" },
      },
    ]);
    mocks.parseCsvEvents.mockResolvedValue([
      {
        type: "TOURNAMENT",
        teamName: "E1",
        title: "E1 Turnier",
        location: null,
        startAt: new Date("2026-09-01T08:00:00.000Z"),
        endAt: null,
        opponentName: null,
        organizerName: null,
        competitionLabel: null,
        homeAway: null,
      },
    ]);
    mocks.eventCreate.mockResolvedValue({ id: "event-a" });
  });

  it("scopes TeamSeason lookup to the authenticated tenant and writes its id", async () => {
    const response = await POST(makeRequest());
    expect(response.status).toBe(200);

    expect(mocks.teamSeasonFindMany).toHaveBeenCalledWith({
      where: {
        seasonId: "season-a",
        team: { tenantId: "tenant-a" },
      },
      include: { team: true },
    });
    expect(mocks.eventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-a",
        seasonId: "season-a",
        teamId: "team-a",
        teamSeasonId: "team-season-a",
        type: "TOURNAMENT",
      }),
    });
  });

  it("does not assign teamSeasonId to a non-tournament import", async () => {
    mocks.parseCsvEvents.mockResolvedValue([
      {
        type: "MATCH",
        teamName: "E1",
        title: "E1 Match",
        location: null,
        startAt: new Date("2026-09-01T08:00:00.000Z"),
        endAt: null,
        opponentName: "Opponent",
        organizerName: null,
        competitionLabel: null,
        homeAway: "HOME",
      },
    ]);

    await POST(makeRequest());

    expect(mocks.eventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        teamId: "team-a",
        teamSeasonId: null,
      }),
    });
  });

  it("rejects ambiguous label matches instead of guessing", async () => {
    mocks.teamSeasonFindMany.mockResolvedValue([
      {
        id: "team-season-a",
        teamId: "team-a",
        team: { name: "E1" },
      },
      {
        id: "team-season-b",
        teamId: "team-b",
        team: { name: "E1" },
      },
    ]);

    const response = await POST(makeRequest());

    expect(response.status).toBe(500);
    expect(mocks.eventCreate).not.toHaveBeenCalled();
    expect(mocks.eventImportRunUpdate).toHaveBeenCalledWith({
      where: { id: "run-a" },
      data: expect.objectContaining({
        status: "FAILED",
        errorMessage: expect.stringContaining("nicht eindeutig"),
      }),
    });
  });

  it("rejects import without authenticated tenant context", async () => {
    mocks.requireApiPermission.mockResolvedValue({
      ok: true,
      session: { user: { activeTenantId: null } },
    });

    const response = await POST(makeRequest());

    expect(response.status).toBe(403);
    expect(mocks.eventImportRunCreate).not.toHaveBeenCalled();
    expect(mocks.eventCreate).not.toHaveBeenCalled();
  });
});
