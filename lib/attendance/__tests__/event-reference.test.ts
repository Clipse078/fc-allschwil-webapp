/**
 * TEAM-COCKPIT-02B — event reference validation tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    teamSeason: { findFirst: vi.fn() },
    trainingSession: { findFirst: vi.fn() },
    event: { findFirst: vi.fn() },
  },
}));

import { prisma } from "@/lib/db/prisma";
import { resolveAttendanceEventContext } from "../event-reference";
import {
  AttendanceEventNotFoundError,
  AttendanceTenantMismatchError,
} from "../errors";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TEAM-COCKPIT-02B — resolveAttendanceEventContext", () => {
  it("resolves training sessions within tenant and team season", async () => {
    vi.mocked(prisma.teamSeason.findFirst).mockResolvedValue({
      id: "ts-01",
      teamId: "team-01",
    } as never);
    vi.mocked(prisma.trainingSession.findFirst).mockResolvedValue({
      id: "session-01",
      startAt: new Date("2026-08-20T17:00:00Z"),
      trainingSeries: { title: "Training" },
    } as never);

    const context = await resolveAttendanceEventContext("tenant-a", "ts-01", {
      eventKind: "TRAINING",
      trainingSessionId: "session-01",
    });

    expect(context.eventKind).toBe("TRAINING");
    expect(context.trainingSessionId).toBe("session-01");
  });

  it("rejects unknown team seasons for tenant", async () => {
    vi.mocked(prisma.teamSeason.findFirst).mockResolvedValue(null);

    await expect(
      resolveAttendanceEventContext("tenant-a", "ts-01", {
        eventKind: "TRAINING",
        trainingSessionId: "session-01",
      }),
    ).rejects.toBeInstanceOf(AttendanceTenantMismatchError);
  });

  it("resolves match events with correct type", async () => {
    vi.mocked(prisma.teamSeason.findFirst).mockResolvedValue({
      id: "ts-01",
      teamId: "team-01",
    } as never);
    vi.mocked(prisma.event.findFirst).mockResolvedValue({
      id: "event-01",
      title: "Heimspiel",
      startAt: new Date("2026-08-21T15:00:00Z"),
    } as never);

    const context = await resolveAttendanceEventContext("tenant-a", "ts-01", {
      eventKind: "MATCH",
      eventId: "event-01",
    });

    expect(context.eventKind).toBe("MATCH");
    expect(context.eventId).toBe("event-01");
    expect(prisma.event.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: "MATCH" }),
      }),
    );
  });

  it("rejects missing events", async () => {
    vi.mocked(prisma.teamSeason.findFirst).mockResolvedValue({
      id: "ts-01",
      teamId: "team-01",
    } as never);
    vi.mocked(prisma.event.findFirst).mockResolvedValue(null);

    await expect(
      resolveAttendanceEventContext("tenant-a", "ts-01", {
        eventKind: "TOURNAMENT",
        eventId: "event-01",
      }),
    ).rejects.toBeInstanceOf(AttendanceEventNotFoundError);
  });
});
