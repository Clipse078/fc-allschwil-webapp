/**
 * TEAM-COCKPIT-03G — participation event discovery season isolation tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    teamSeason: { findFirst: vi.fn() },
    trainingSession: { findMany: vi.fn() },
    event: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/db/prisma";
import { listUpcomingParticipationEvents } from "../queries";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const TEAM_ID = "team-01";
const OTHER_TEAM_ID = "team-02";
const TEAM_SEASON_ID = "ts-current";
const SEASON_CURRENT = "season-current";
const SEASON_OTHER = "season-other";

const FUTURE_DATE = new Date("2026-09-01T14:00:00Z");

function mockTeamSeason(seasonId = SEASON_CURRENT) {
  vi.mocked(prisma.teamSeason.findFirst).mockResolvedValue({ seasonId } as never);
}

function mockTrainingSessions(
  sessions: Array<{ id: string; startAt: Date; title: string }> = [],
) {
  vi.mocked(prisma.trainingSession.findMany).mockResolvedValue(
    sessions.map((session) => ({
      id: session.id,
      startAt: session.startAt,
      trainingSeries: { title: session.title },
    })) as never,
  );
}

function mockCalendarEvents(
  events: Array<{ id: string; type: "MATCH" | "TOURNAMENT"; title: string; startAt: Date }> = [],
) {
  vi.mocked(prisma.event.findMany).mockResolvedValue(events as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTeamSeason();
  mockTrainingSessions();
  mockCalendarEvents();
});

describe("TEAM-COCKPIT-03G — listUpcomingParticipationEvents season isolation", () => {
  it("includes current-season Match", async () => {
    mockCalendarEvents([
      { id: "match-current", type: "MATCH", title: "Heimspiel", startAt: FUTURE_DATE },
    ]);

    const events = await listUpcomingParticipationEvents(
      TENANT_A,
      TEAM_SEASON_ID,
      TEAM_ID,
      { from: new Date("2026-08-01") },
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventKind: "MATCH",
      eventId: "match-current",
      title: "Heimspiel",
    });
  });

  it("includes current-season Tournament", async () => {
    mockCalendarEvents([
      { id: "tournament-current", type: "TOURNAMENT", title: "Sommerturnier", startAt: FUTURE_DATE },
    ]);

    const events = await listUpcomingParticipationEvents(
      TENANT_A,
      TEAM_SEASON_ID,
      TEAM_ID,
      { from: new Date("2026-08-01") },
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventKind: "TOURNAMENT",
      eventId: "tournament-current",
      title: "Sommerturnier",
    });
  });

  it("scopes Match discovery to active TeamSeason season", async () => {
    await listUpcomingParticipationEvents(TENANT_A, TEAM_SEASON_ID, TEAM_ID);

    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: TENANT_A,
          teamId: TEAM_ID,
          seasonId: SEASON_CURRENT,
          type: { in: ["MATCH", "TOURNAMENT"] },
        }),
      }),
    );
  });

  it("scopes Tournament discovery to active TeamSeason season", async () => {
    mockTeamSeason(SEASON_OTHER);

    await listUpcomingParticipationEvents(TENANT_A, TEAM_SEASON_ID, TEAM_ID);

    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          seasonId: SEASON_OTHER,
        }),
      }),
    );
  });

  it("does not trust client-supplied seasonId — derives from TeamSeason", async () => {
    await listUpcomingParticipationEvents(TENANT_A, TEAM_SEASON_ID, TEAM_ID);

    expect(prisma.teamSeason.findFirst).toHaveBeenCalledWith({
      where: {
        id: TEAM_SEASON_ID,
        teamId: TEAM_ID,
        team: { tenantId: TENANT_A },
      },
      select: { seasonId: true },
    });
    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ seasonId: SEASON_CURRENT }),
      }),
    );
  });

  it("excludes events when TeamSeason is not found", async () => {
    vi.mocked(prisma.teamSeason.findFirst).mockResolvedValue(null);

    const events = await listUpcomingParticipationEvents(
      TENANT_A,
      "foreign-ts",
      TEAM_ID,
    );

    expect(events).toEqual([]);
    expect(prisma.event.findMany).not.toHaveBeenCalled();
  });

  it("preserves tenant isolation in event query", async () => {
    await listUpcomingParticipationEvents(TENANT_A, TEAM_SEASON_ID, TEAM_ID);

    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TENANT_A }),
      }),
    );
  });

  it("preserves team isolation in event query", async () => {
    await listUpcomingParticipationEvents(TENANT_A, TEAM_SEASON_ID, TEAM_ID);

    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ teamId: TEAM_ID }),
      }),
    );
  });

  it("keeps Training scoped through teamSeasonId", async () => {
    mockTrainingSessions([
      { id: "session-01", startAt: FUTURE_DATE, title: "Dienstagstraining" },
    ]);

    const events = await listUpcomingParticipationEvents(
      TENANT_A,
      TEAM_SEASON_ID,
      TEAM_ID,
      { from: new Date("2026-08-01") },
    );

    expect(prisma.trainingSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: TENANT_A,
          teamSeasonId: TEAM_SEASON_ID,
        }),
      }),
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventKind: "TRAINING",
      trainingSessionId: "session-01",
    });
  });

  it("returns empty when DB excludes foreign-team and foreign-tenant events", async () => {
    mockCalendarEvents([]);

    const events = await listUpcomingParticipationEvents(
      TENANT_B,
      TEAM_SEASON_ID,
      OTHER_TEAM_ID,
    );

    expect(events).toHaveLength(0);
    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: TENANT_B,
          teamId: OTHER_TEAM_ID,
        }),
      }),
    );
  });
});
