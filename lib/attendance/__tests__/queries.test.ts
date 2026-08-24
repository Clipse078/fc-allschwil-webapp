/**
 * TEAM-COCKPIT-02B — attendance query aggregation tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    playerSquadMember: { findMany: vi.fn() },
    attendanceRecord: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/db/prisma";
import { getTeamAttendanceOverview } from "../queries";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TEAM-COCKPIT-02B — getTeamAttendanceOverview", () => {
  it("aggregates player attendance counts and percentage", async () => {
    vi.mocked(prisma.playerSquadMember.findMany).mockResolvedValue([
      {
        personId: "p1",
        shirtNumber: 10,
        sortOrder: 0,
        person: { firstName: "Max", lastName: "Muster", displayName: null },
      },
    ] as never);
    vi.mocked(prisma.attendanceRecord.findMany).mockResolvedValue([
      { personId: "p1", status: "PRESENT" },
      { personId: "p1", status: "ABSENT" },
      { personId: "p1", status: "OPEN" },
    ] as never);

    const overview = await getTeamAttendanceOverview("tenant-a", "ts-01");

    expect(overview.players).toHaveLength(1);
    expect(overview.players[0]?.eventCount).toBe(3);
    expect(overview.players[0]?.counts.present).toBe(1);
    expect(overview.players[0]?.counts.absent).toBe(1);
    expect(overview.players[0]?.counts.open).toBe(1);
    expect(overview.players[0]?.percentageLabel).toBe("50%");
  });
});
