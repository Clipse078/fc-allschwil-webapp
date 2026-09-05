import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiTenantPermissionContext: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  revalidatePath: vi.fn(),
  seasonFindUnique: vi.fn(),
  teamFindFirst: vi.fn(),
  teamSeasonFindMany: vi.fn(),
  eventCreate: vi.fn(),
  eventFindFirst: vi.fn(),
  eventUpdate: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-tenant-context", () => ({
  requireApiTenantPermissionContext:
    mocks.requireApiTenantPermissionContext,
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    season: { findUnique: mocks.seasonFindUnique },
    team: { findFirst: mocks.teamFindFirst },
    teamSeason: { findMany: mocks.teamSeasonFindMany },
    event: {
      create: mocks.eventCreate,
      findFirst: mocks.eventFindFirst,
      update: mocks.eventUpdate,
    },
  },
}));

import {
  createPlannerEntryAction,
  updatePlannerEntryAction,
} from "../actions";

function plannerForm(
  overrides: Record<string, string | null> = {},
): FormData {
  const values: Record<string, string | null> = {
    seasonId: "season-a",
    seasonKey: "2026-27",
    teamId: "team-a",
    type: "TOURNAMENT",
    source: "MANUAL",
    title: "E1 Turnier",
    startAt: "2026-09-01T08:00:00.000Z",
    eventId: "event-a",
    ...overrides,
  };
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (value !== null) formData.set(key, value);
  }
  return formData;
}

describe("planner tournament TeamSeason consistency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiTenantPermissionContext.mockResolvedValue({
      ok: true,
      context: {
        tenantId: "tenant-a",
        actorUserId: "user-a",
        permissionKeys: ["events.manage"],
        roleKeys: [],
      },
    });
    mocks.seasonFindUnique.mockResolvedValue({
      id: "season-a",
      key: "2026-27",
    });
    mocks.teamFindFirst.mockResolvedValue({ id: "team-a" });
    mocks.teamSeasonFindMany.mockResolvedValue([{ id: "team-season-a" }]);
    mocks.eventFindFirst.mockResolvedValue({ id: "event-a" });
    mocks.eventCreate.mockResolvedValue({ id: "event-a" });
    mocks.eventUpdate.mockResolvedValue({ id: "event-a" });
  });

  it("writes the canonical TeamSeason when creating a tournament", async () => {
    await expect(
      createPlannerEntryAction(plannerForm()),
    ).rejects.toThrow(/REDIRECT:.*create-success/);

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

  it("re-resolves TeamSeason when planner update changes team or season", async () => {
    mocks.seasonFindUnique.mockResolvedValue({
      id: "season-new",
      key: "2026-27",
    });
    mocks.teamFindFirst.mockResolvedValue({ id: "team-new" });
    mocks.teamSeasonFindMany.mockResolvedValue([{ id: "team-season-new" }]);

    await expect(
      updatePlannerEntryAction(
        plannerForm({ teamId: "team-new", seasonId: "season-new" }),
      ),
    ).rejects.toThrow(/REDIRECT:.*update-success/);

    expect(mocks.eventFindFirst).toHaveBeenCalledWith({
      where: { id: "event-a", tenantId: "tenant-a" },
      select: { id: true },
    });
    expect(mocks.teamSeasonFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          teamId: "team-new",
          seasonId: "season-new",
          team: { tenantId: "tenant-a" },
        },
      }),
    );
    expect(mocks.eventUpdate).toHaveBeenCalledWith({
      where: { id: "event-a", tenantId: "tenant-a" },
      data: expect.objectContaining({
        teamId: "team-new",
        seasonId: "season-new",
        teamSeasonId: "team-season-new",
      }),
    });
  });

  it("clears a stale relation when changing away from TOURNAMENT", async () => {
    await expect(
      updatePlannerEntryAction(plannerForm({ type: "OTHER" })),
    ).rejects.toThrow(/REDIRECT:.*update-success/);

    expect(mocks.teamSeasonFindMany).not.toHaveBeenCalled();
    expect(mocks.eventUpdate).toHaveBeenCalledWith({
      where: { id: "event-a", tenantId: "tenant-a" },
      data: expect.objectContaining({ teamSeasonId: null, type: "OTHER" }),
    });
  });

  it("rejects a cross-tenant or mismatched TeamSeason", async () => {
    mocks.teamSeasonFindMany.mockResolvedValue([]);

    await expect(
      updatePlannerEntryAction(plannerForm()),
    ).rejects.toThrow(/REDIRECT:.*update-invalid-team-season/);

    expect(mocks.eventUpdate).not.toHaveBeenCalled();
  });
});
