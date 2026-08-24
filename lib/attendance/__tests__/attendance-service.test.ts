/**
 * TEAM-COCKPIT-02B — attendance service tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    teamSeason: { findFirst: vi.fn() },
    trainingSession: { findFirst: vi.fn() },
    event: { findFirst: vi.fn() },
    person: { findFirst: vi.fn() },
    playerSquadMember: { findFirst: vi.fn() },
    attendanceRecord: {
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
import { upsertAttendanceRecord } from "../attendance-service";
import {
  AttendanceTenantMismatchError,
  AttendanceValidationError,
} from "../errors";

const TENANT_A = "tenant-a";
const TEAM_SEASON_ID = "ts-01";
const PERSON_ID = "person-01";
const SESSION_ID = "session-01";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TEAM-COCKPIT-02B — upsertAttendanceRecord", () => {
  it("creates a training attendance record", async () => {
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
    vi.mocked(prisma.person.findFirst).mockResolvedValue({
      id: PERSON_ID,
      isPlayer: true,
    } as never);
    vi.mocked(prisma.playerSquadMember.findFirst).mockResolvedValue({ id: "squad-01" } as never);
    vi.mocked(prisma.attendanceRecord.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.attendanceRecord.create).mockResolvedValue({
      id: "record-01",
      status: "PRESENT",
    } as never);

    const result = await upsertAttendanceRecord(TENANT_A, "user-01", {
      personId: PERSON_ID,
      teamSeasonId: TEAM_SEASON_ID,
      event: { eventKind: "TRAINING", trainingSessionId: SESSION_ID },
      status: "PRESENT",
    });

    expect(result.status).toBe("PRESENT");
    expect(prisma.attendanceRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: TENANT_A,
          personId: PERSON_ID,
          eventKind: "TRAINING",
          trainingSessionId: SESSION_ID,
          eventId: null,
        }),
      }),
    );
  });

  it("rejects cross-tenant persons", async () => {
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
    vi.mocked(prisma.person.findFirst).mockResolvedValue(null);

    await expect(
      upsertAttendanceRecord(TENANT_A, "user-01", {
        personId: PERSON_ID,
        teamSeasonId: TEAM_SEASON_ID,
        event: { eventKind: "TRAINING", trainingSessionId: SESSION_ID },
        status: "PRESENT",
      }),
    ).rejects.toBeInstanceOf(AttendanceTenantMismatchError);
  });

  it("rejects persons outside the roster", async () => {
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
    vi.mocked(prisma.person.findFirst).mockResolvedValue({
      id: PERSON_ID,
      isPlayer: true,
    } as never);
    vi.mocked(prisma.playerSquadMember.findFirst).mockResolvedValue(null);

    await expect(
      upsertAttendanceRecord(TENANT_A, "user-01", {
        personId: PERSON_ID,
        teamSeasonId: TEAM_SEASON_ID,
        event: { eventKind: "TRAINING", trainingSessionId: SESSION_ID },
        status: "PRESENT",
      }),
    ).rejects.toBeInstanceOf(AttendanceValidationError);
  });

  it("updates an existing record", async () => {
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
    vi.mocked(prisma.person.findFirst).mockResolvedValue({
      id: PERSON_ID,
      isPlayer: true,
    } as never);
    vi.mocked(prisma.playerSquadMember.findFirst).mockResolvedValue({ id: "squad-01" } as never);
    vi.mocked(prisma.attendanceRecord.findFirst).mockResolvedValue({
      id: "record-01",
      status: "OPEN",
      note: null,
    } as never);
    vi.mocked(prisma.attendanceRecord.update).mockResolvedValue({
      id: "record-01",
      status: "ABSENT",
    } as never);

    const result = await upsertAttendanceRecord(TENANT_A, "user-01", {
      personId: PERSON_ID,
      teamSeasonId: TEAM_SEASON_ID,
      event: { eventKind: "TRAINING", trainingSessionId: SESSION_ID },
      status: "ABSENT",
    });

    expect(result.status).toBe("ABSENT");
    expect(prisma.attendanceRecord.update).toHaveBeenCalled();
  });
});
