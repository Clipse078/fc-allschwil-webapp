/**
 * TEAM-COCKPIT-03A — participation service tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    teamSeason: { findFirst: vi.fn() },
    trainingSession: { findFirst: vi.fn() },
    event: { findFirst: vi.fn() },
    person: { findFirst: vi.fn() },
    playerSquadMember: { findFirst: vi.fn() },
    participationResponse: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/audit/log-action", () => ({
  logAction: vi.fn(),
}));

import { prisma } from "@/lib/db/prisma";
import { respondToParticipation } from "../participation-service";
import {
  ParticipationTenantMismatchError,
  ParticipationValidationError,
} from "../errors";

const TENANT_A = "tenant-a";
const TEAM_SEASON_ID = "ts-01";
const PERSON_ID = "person-01";
const SESSION_ID = "session-01";
const MATCH_EVENT_ID = "event-match-01";
const TOURNAMENT_EVENT_ID = "event-tournament-01";

function mockTrainingEventContext() {
  vi.mocked(prisma.teamSeason.findFirst).mockResolvedValue({
    id: TEAM_SEASON_ID,
    teamId: "team-01",
  } as never);
  vi.mocked(prisma.trainingSession.findFirst).mockResolvedValue({
    id: SESSION_ID,
    date: new Date("2026-08-20"),
    startAt: new Date("2026-08-20T17:00:00Z"),
    trainingSeries: { title: "Dienstagstraining" },
  } as never);
}

function mockMatchEventContext() {
  vi.mocked(prisma.teamSeason.findFirst).mockResolvedValue({
    id: TEAM_SEASON_ID,
    teamId: "team-01",
  } as never);
  vi.mocked(prisma.event.findFirst).mockResolvedValue({
    id: MATCH_EVENT_ID,
    title: "Heimspiel",
    startAt: new Date("2026-08-22T14:00:00Z"),
  } as never);
}

function mockTournamentEventContext() {
  vi.mocked(prisma.teamSeason.findFirst).mockResolvedValue({
    id: TEAM_SEASON_ID,
    teamId: "team-01",
  } as never);
  vi.mocked(prisma.event.findFirst).mockResolvedValue({
    id: TOURNAMENT_EVENT_ID,
    title: "Sommerturnier",
    startAt: new Date("2026-08-23T09:00:00Z"),
  } as never);
}

function mockRoster() {
  vi.mocked(prisma.person.findFirst).mockResolvedValue({
    id: PERSON_ID,
    isPlayer: true,
  } as never);
  vi.mocked(prisma.playerSquadMember.findFirst).mockResolvedValue({ id: "squad-01" } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TEAM-COCKPIT-03A — respondToParticipation", () => {
  it("creates a training participation response", async () => {
    mockTrainingEventContext();
    mockRoster();
    vi.mocked(prisma.participationResponse.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.participationResponse.create).mockResolvedValue({
      id: "response-01",
      status: "YES",
    } as never);

    const result = await respondToParticipation(TENANT_A, "user-01", {
      personId: PERSON_ID,
      teamSeasonId: TEAM_SEASON_ID,
      event: { eventKind: "TRAINING", trainingSessionId: SESSION_ID },
      status: "YES",
      responseSource: "PARENT",
      note: "Kommt pünktlich",
    });

    expect(result.status).toBe("YES");
    expect(prisma.participationResponse.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: TENANT_A,
          personId: PERSON_ID,
          eventKind: "TRAINING",
          trainingSessionId: SESSION_ID,
          eventId: null,
          responseSource: "PARENT",
        }),
      }),
    );
  });

  it("creates a match participation response", async () => {
    mockMatchEventContext();
    mockRoster();
    vi.mocked(prisma.participationResponse.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.participationResponse.create).mockResolvedValue({
      id: "response-02",
      status: "NO",
    } as never);

    const result = await respondToParticipation(TENANT_A, "user-01", {
      personId: PERSON_ID,
      teamSeasonId: TEAM_SEASON_ID,
      event: { eventKind: "MATCH", eventId: MATCH_EVENT_ID },
      status: "NO",
      responseSource: "PARENT",
      note: "Krank",
    });

    expect(result.status).toBe("NO");
    expect(prisma.participationResponse.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventKind: "MATCH",
          eventId: MATCH_EVENT_ID,
          trainingSessionId: null,
        }),
      }),
    );
  });

  it("creates a tournament participation response", async () => {
    mockTournamentEventContext();
    mockRoster();
    vi.mocked(prisma.participationResponse.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.participationResponse.create).mockResolvedValue({
      id: "response-03",
      status: "MAYBE",
    } as never);

    const result = await respondToParticipation(TENANT_A, "user-01", {
      personId: PERSON_ID,
      teamSeasonId: TEAM_SEASON_ID,
      event: { eventKind: "TOURNAMENT", eventId: TOURNAMENT_EVENT_ID },
      status: "MAYBE",
      responseSource: "PLAYER",
    });

    expect(result.status).toBe("MAYBE");
  });

  it("updates existing response idempotently", async () => {
    mockTrainingEventContext();
    mockRoster();
    vi.mocked(prisma.participationResponse.findFirst).mockResolvedValue({
      id: "response-01",
      status: "OPEN",
      note: null,
    } as never);
    vi.mocked(prisma.participationResponse.update).mockResolvedValue({
      id: "response-01",
      status: "NO",
    } as never);

    const result = await respondToParticipation(TENANT_A, "user-01", {
      personId: PERSON_ID,
      teamSeasonId: TEAM_SEASON_ID,
      event: { eventKind: "TRAINING", trainingSessionId: SESSION_ID },
      status: "NO",
      responseSource: "PARENT",
      note: "Krank",
    });

    expect(result.status).toBe("NO");
    expect(prisma.participationResponse.update).toHaveBeenCalled();
    expect(prisma.participationResponse.create).not.toHaveBeenCalled();
  });

  it("rejects cross-tenant persons", async () => {
    mockTrainingEventContext();
    vi.mocked(prisma.person.findFirst).mockResolvedValue(null);

    await expect(
      respondToParticipation(TENANT_A, "user-01", {
        personId: PERSON_ID,
        teamSeasonId: TEAM_SEASON_ID,
        event: { eventKind: "TRAINING", trainingSessionId: SESSION_ID },
        status: "YES",
        responseSource: "PARENT",
      }),
    ).rejects.toBeInstanceOf(ParticipationTenantMismatchError);
  });

  it("rejects persons outside the roster", async () => {
    mockTrainingEventContext();
    vi.mocked(prisma.person.findFirst).mockResolvedValue({
      id: PERSON_ID,
      isPlayer: true,
    } as never);
    vi.mocked(prisma.playerSquadMember.findFirst).mockResolvedValue(null);

    await expect(
      respondToParticipation(TENANT_A, "user-01", {
        personId: PERSON_ID,
        teamSeasonId: TEAM_SEASON_ID,
        event: { eventKind: "TRAINING", trainingSessionId: SESSION_ID },
        status: "YES",
        responseSource: "PARENT",
      }),
    ).rejects.toBeInstanceOf(ParticipationValidationError);
  });

  it("rejects foreign team season via event context", async () => {
    vi.mocked(prisma.teamSeason.findFirst).mockResolvedValue(null);

    await expect(
      respondToParticipation(TENANT_A, "user-01", {
        personId: PERSON_ID,
        teamSeasonId: "foreign-ts",
        event: { eventKind: "TRAINING", trainingSessionId: SESSION_ID },
        status: "YES",
        responseSource: "PARENT",
      }),
    ).rejects.toThrow();
  });

  it("rejects foreign training session", async () => {
    vi.mocked(prisma.teamSeason.findFirst).mockResolvedValue({
      id: TEAM_SEASON_ID,
      teamId: "team-01",
    } as never);
    vi.mocked(prisma.trainingSession.findFirst).mockResolvedValue(null);

    await expect(
      respondToParticipation(TENANT_A, "user-01", {
        personId: PERSON_ID,
        teamSeasonId: TEAM_SEASON_ID,
        event: { eventKind: "TRAINING", trainingSessionId: "foreign-session" },
        status: "YES",
        responseSource: "PARENT",
      }),
    ).rejects.toThrow();
  });
});
