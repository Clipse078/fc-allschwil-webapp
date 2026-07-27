/**
 * Tests for lib/training/training-service.ts
 *
 * Covers:
 *   A. createTrainingSeries  — validation, success, duplicate, cross-tenant,
 *                              archived team, season ownership
 *   B. updateTrainingSeries  — field updates, weekday replacement, not-found
 *   C. archiveTrainingSeries — lifecycle, idempotency
 *   D. restoreTrainingSeries — lifecycle, not-found
 *   E. listTrainingSeries    — filtering, archived exclusion
 *   F. getTrainingSeries     — retrieval, not-found, cross-tenant
 *
 * All external dependencies (Prisma) are mocked. No DB access.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    trainingSeries: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    teamSeason: {
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db/prisma";
import {
  createTrainingSeries,
  updateTrainingSeries,
  archiveTrainingSeries,
  restoreTrainingSeries,
  listTrainingSeries,
  getTrainingSeries,
} from "../training-service";
import {
  TrainingSeriesNotFoundError,
  TrainingSeriesConflictError,
  TrainingSeriesValidationError,
  TrainingSeriesTeamSeasonNotFoundError,
  TrainingSeriesArchivedTeamError,
} from "../errors";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const SERIES_ID = "series-01";
const TEAM_SEASON_ID = "ts-01";
const TEAM_ID = "team-01";

const baseRow = {
  id: SERIES_ID,
  tenantId: TENANT_A,
  teamSeasonId: TEAM_SEASON_ID,
  title: "E1 Tuesday Training",
  description: null,
  status: "ACTIVE" as const,
  startsAt: "19:00",
  endsAt: "21:00",
  timezone: "Europe/Zurich",
  validFrom: null,
  validUntil: null,
  archivedAt: null,
  createdAt: new Date("2026-08-01"),
  updatedAt: new Date("2026-08-01"),
  recurrenceDays: [{ weekday: "TUESDAY" }],
};

const activeTeamSeason = {
  id: TEAM_SEASON_ID,
  team: { id: TEAM_ID, isActive: true, tenantId: TENANT_A },
};

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ── A. createTrainingSeries ───────────────────────────────────────────────────

describe("A. createTrainingSeries", () => {
  it("creates a series with valid input", async () => {
    vi.mocked(prisma.teamSeason.findFirst).mockResolvedValue(activeTeamSeason as never);
    vi.mocked(prisma.trainingSeries.create).mockResolvedValue(baseRow as never);

    const result = await createTrainingSeries(TENANT_A, {
      teamSeasonId: TEAM_SEASON_ID,
      title: "E1 Tuesday Training",
      startsAt: "19:00",
      endsAt: "21:00",
      weekdays: ["TUESDAY"],
    });

    expect(result.id).toBe(SERIES_ID);
    expect(result.title).toBe("E1 Tuesday Training");
    expect(result.tenantId).toBe(TENANT_A);
    expect(result.weekdays).toEqual(["TUESDAY"]);
    expect(prisma.trainingSeries.create).toHaveBeenCalledOnce();
  });

  it("always passes tenantId from context, never from input", async () => {
    vi.mocked(prisma.teamSeason.findFirst).mockResolvedValue(activeTeamSeason as never);
    vi.mocked(prisma.trainingSeries.create).mockResolvedValue(baseRow as never);

    await createTrainingSeries(TENANT_A, {
      teamSeasonId: TEAM_SEASON_ID,
      title: "FF17 Thursday Training",
      startsAt: "17:30",
      endsAt: "19:00",
      weekdays: ["THURSDAY"],
    });

    const call = vi.mocked(prisma.trainingSeries.create).mock.calls[0][0];
    expect(call.data.tenantId).toBe(TENANT_A);
  });

  it("defaults timezone to UTC when not provided", async () => {
    vi.mocked(prisma.teamSeason.findFirst).mockResolvedValue(activeTeamSeason as never);
    vi.mocked(prisma.trainingSeries.create).mockResolvedValue({
      ...baseRow,
      timezone: "UTC",
    } as never);

    await createTrainingSeries(TENANT_A, {
      teamSeasonId: TEAM_SEASON_ID,
      title: "E1 Tuesday Training",
      startsAt: "19:00",
      endsAt: "21:00",
      weekdays: ["TUESDAY"],
    });

    const call = vi.mocked(prisma.trainingSeries.create).mock.calls[0][0];
    expect(call.data.timezone).toBe("UTC");
  });

  it("deduplicates repeated weekdays", async () => {
    vi.mocked(prisma.teamSeason.findFirst).mockResolvedValue(activeTeamSeason as never);
    vi.mocked(prisma.trainingSeries.create).mockResolvedValue({
      ...baseRow,
      recurrenceDays: [{ weekday: "MONDAY" }, { weekday: "WEDNESDAY" }],
    } as never);

    await createTrainingSeries(TENANT_A, {
      teamSeasonId: TEAM_SEASON_ID,
      title: "Mon/Wed Training",
      startsAt: "18:00",
      endsAt: "20:00",
      weekdays: ["MONDAY", "WEDNESDAY", "MONDAY"],
    });

    const call = vi.mocked(prisma.trainingSeries.create).mock.calls[0][0];
    const recurrenceDays = call.data.recurrenceDays;
    expect(recurrenceDays).toBeDefined();
    expect((recurrenceDays as { create: unknown[] }).create).toHaveLength(2);
  });

  it("supports multiple weekdays", async () => {
    vi.mocked(prisma.teamSeason.findFirst).mockResolvedValue(activeTeamSeason as never);
    vi.mocked(prisma.trainingSeries.create).mockResolvedValue({
      ...baseRow,
      recurrenceDays: [{ weekday: "TUESDAY" }, { weekday: "THURSDAY" }],
    } as never);

    const result = await createTrainingSeries(TENANT_A, {
      teamSeasonId: TEAM_SEASON_ID,
      title: "Tue/Thu Training",
      startsAt: "18:00",
      endsAt: "20:00",
      weekdays: ["TUESDAY", "THURSDAY"],
    });

    expect(result.weekdays).toEqual(["TUESDAY", "THURSDAY"]);
  });

  it("throws TrainingSeriesValidationError when title is empty", async () => {
    await expect(
      createTrainingSeries(TENANT_A, {
        teamSeasonId: TEAM_SEASON_ID,
        title: "",
        startsAt: "19:00",
        endsAt: "21:00",
        weekdays: ["TUESDAY"],
      }),
    ).rejects.toThrow(TrainingSeriesValidationError);
  });

  it("throws TrainingSeriesValidationError when title is whitespace-only", async () => {
    await expect(
      createTrainingSeries(TENANT_A, {
        teamSeasonId: TEAM_SEASON_ID,
        title: "   ",
        startsAt: "19:00",
        endsAt: "21:00",
        weekdays: ["TUESDAY"],
      }),
    ).rejects.toThrow(TrainingSeriesValidationError);
  });

  it("throws TrainingSeriesValidationError when weekdays is empty", async () => {
    await expect(
      createTrainingSeries(TENANT_A, {
        teamSeasonId: TEAM_SEASON_ID,
        title: "E1 Training",
        startsAt: "19:00",
        endsAt: "21:00",
        weekdays: [],
      }),
    ).rejects.toThrow(TrainingSeriesValidationError);
  });

  it("throws TrainingSeriesValidationError when startsAt equals endsAt", async () => {
    await expect(
      createTrainingSeries(TENANT_A, {
        teamSeasonId: TEAM_SEASON_ID,
        title: "E1 Training",
        startsAt: "19:00",
        endsAt: "19:00",
        weekdays: ["TUESDAY"],
      }),
    ).rejects.toThrow(TrainingSeriesValidationError);
  });

  it("throws TrainingSeriesValidationError when startsAt is after endsAt", async () => {
    await expect(
      createTrainingSeries(TENANT_A, {
        teamSeasonId: TEAM_SEASON_ID,
        title: "E1 Training",
        startsAt: "21:00",
        endsAt: "19:00",
        weekdays: ["TUESDAY"],
      }),
    ).rejects.toThrow(TrainingSeriesValidationError);
  });

  it("throws TrainingSeriesValidationError for malformed time string", async () => {
    await expect(
      createTrainingSeries(TENANT_A, {
        teamSeasonId: TEAM_SEASON_ID,
        title: "E1 Training",
        startsAt: "7pm",
        endsAt: "9pm",
        weekdays: ["TUESDAY"],
      }),
    ).rejects.toThrow(TrainingSeriesValidationError);
  });

  it("throws TrainingSeriesTeamSeasonNotFoundError when TeamSeason not found", async () => {
    vi.mocked(prisma.teamSeason.findFirst).mockResolvedValue(null as never);

    await expect(
      createTrainingSeries(TENANT_A, {
        teamSeasonId: "nonexistent-ts",
        title: "E1 Training",
        startsAt: "19:00",
        endsAt: "21:00",
        weekdays: ["TUESDAY"],
      }),
    ).rejects.toThrow(TrainingSeriesTeamSeasonNotFoundError);
  });

  it("rejects cross-tenant TeamSeason — TeamSeason not found for wrong tenant", async () => {
    vi.mocked(prisma.teamSeason.findFirst).mockResolvedValue(null as never);

    await expect(
      createTrainingSeries(TENANT_B, {
        teamSeasonId: TEAM_SEASON_ID,
        title: "E1 Training",
        startsAt: "19:00",
        endsAt: "21:00",
        weekdays: ["TUESDAY"],
      }),
    ).rejects.toThrow(TrainingSeriesTeamSeasonNotFoundError);

    const call = vi.mocked(prisma.teamSeason.findFirst).mock.calls[0][0] as {
      where: { team: { tenantId: string } };
    };
    expect(call.where.team.tenantId).toBe(TENANT_B);
  });

  it("throws TrainingSeriesArchivedTeamError when team is inactive", async () => {
    vi.mocked(prisma.teamSeason.findFirst).mockResolvedValue({
      ...activeTeamSeason,
      team: { ...activeTeamSeason.team, isActive: false },
    } as never);

    await expect(
      createTrainingSeries(TENANT_A, {
        teamSeasonId: TEAM_SEASON_ID,
        title: "E1 Training",
        startsAt: "19:00",
        endsAt: "21:00",
        weekdays: ["TUESDAY"],
      }),
    ).rejects.toThrow(TrainingSeriesArchivedTeamError);
  });

  it("throws TrainingSeriesValidationError for invalid IANA timezone", async () => {
    await expect(
      createTrainingSeries(TENANT_A, {
        teamSeasonId: TEAM_SEASON_ID,
        title: "E1 Training",
        startsAt: "19:00",
        endsAt: "21:00",
        weekdays: ["TUESDAY"],
        timezone: "Not/A/Timezone",
      }),
    ).rejects.toThrow(TrainingSeriesValidationError);
  });

  it("accepts a valid IANA timezone", async () => {
    vi.mocked(prisma.teamSeason.findFirst).mockResolvedValue(activeTeamSeason as never);
    vi.mocked(prisma.trainingSeries.create).mockResolvedValue({
      ...baseRow,
      timezone: "Europe/Zurich",
    } as never);

    const result = await createTrainingSeries(TENANT_A, {
      teamSeasonId: TEAM_SEASON_ID,
      title: "E1 Tuesday Training",
      startsAt: "19:00",
      endsAt: "21:00",
      weekdays: ["TUESDAY"],
      timezone: "Europe/Zurich",
    });

    expect(result.timezone).toBe("Europe/Zurich");
  });

  it("throws TrainingSeriesValidationError when validFrom is after validUntil", async () => {
    await expect(
      createTrainingSeries(TENANT_A, {
        teamSeasonId: TEAM_SEASON_ID,
        title: "E1 Training",
        startsAt: "19:00",
        endsAt: "21:00",
        weekdays: ["TUESDAY"],
        validFrom: new Date("2027-01-01"),
        validUntil: new Date("2026-01-01"),
      }),
    ).rejects.toThrow(TrainingSeriesValidationError);
  });

  it("throws TrainingSeriesValidationError when validFrom equals validUntil", async () => {
    await expect(
      createTrainingSeries(TENANT_A, {
        teamSeasonId: TEAM_SEASON_ID,
        title: "E1 Training",
        startsAt: "19:00",
        endsAt: "21:00",
        weekdays: ["TUESDAY"],
        validFrom: new Date("2026-08-01"),
        validUntil: new Date("2026-08-01"),
      }),
    ).rejects.toThrow(TrainingSeriesValidationError);
  });

  it("throws TrainingSeriesConflictError on duplicate title within TeamSeason", async () => {
    vi.mocked(prisma.teamSeason.findFirst).mockResolvedValue(activeTeamSeason as never);
    vi.mocked(prisma.trainingSeries.create).mockRejectedValue(
      new Error('Unique constraint failed on the fields: (`TrainingSeries_teamSeasonId_title_key`)'),
    );

    await expect(
      createTrainingSeries(TENANT_A, {
        teamSeasonId: TEAM_SEASON_ID,
        title: "E1 Tuesday Training",
        startsAt: "19:00",
        endsAt: "21:00",
        weekdays: ["TUESDAY"],
      }),
    ).rejects.toThrow(TrainingSeriesConflictError);
  });
});

// ── B. updateTrainingSeries ───────────────────────────────────────────────────

describe("B. updateTrainingSeries", () => {
  it("updates title and description", async () => {
    vi.mocked(prisma.trainingSeries.findFirst).mockResolvedValue(baseRow as never);
    vi.mocked(prisma.trainingSeries.update).mockResolvedValue({
      ...baseRow,
      title: "E1 Tuesday Advanced Training",
      description: "Advanced session",
    } as never);

    const result = await updateTrainingSeries(TENANT_A, SERIES_ID, {
      title: "E1 Tuesday Advanced Training",
      description: "Advanced session",
    });

    expect(result.title).toBe("E1 Tuesday Advanced Training");
    expect(result.description).toBe("Advanced session");
    expect(prisma.trainingSeries.update).toHaveBeenCalledOnce();
  });

  it("replaces all recurrence days when weekdays is provided", async () => {
    vi.mocked(prisma.trainingSeries.findFirst).mockResolvedValue(baseRow as never);
    vi.mocked(prisma.trainingSeries.update).mockResolvedValue({
      ...baseRow,
      recurrenceDays: [{ weekday: "MONDAY" }, { weekday: "WEDNESDAY" }],
    } as never);

    const result = await updateTrainingSeries(TENANT_A, SERIES_ID, {
      weekdays: ["MONDAY", "WEDNESDAY"],
    });

    expect(result.weekdays).toEqual(["MONDAY", "WEDNESDAY"]);
    const call = vi.mocked(prisma.trainingSeries.update).mock.calls[0][0];
    expect(call.data.recurrenceDays).toBeDefined();
  });

  it("does not touch recurrence days when weekdays is not provided", async () => {
    vi.mocked(prisma.trainingSeries.findFirst).mockResolvedValue(baseRow as never);
    vi.mocked(prisma.trainingSeries.update).mockResolvedValue({
      ...baseRow,
      startsAt: "18:30",
    } as never);

    await updateTrainingSeries(TENANT_A, SERIES_ID, { startsAt: "18:30" });

    const call = vi.mocked(prisma.trainingSeries.update).mock.calls[0][0];
    expect(call.data.recurrenceDays).toBeUndefined();
  });

  it("scopes findFirst by tenantId to prevent cross-tenant update", async () => {
    vi.mocked(prisma.trainingSeries.findFirst).mockResolvedValue(null as never);

    await expect(
      updateTrainingSeries(TENANT_B, SERIES_ID, { title: "Hijacked" }),
    ).rejects.toThrow(TrainingSeriesNotFoundError);

    const call = vi.mocked(prisma.trainingSeries.findFirst).mock.calls[0][0] as {
      where: { tenantId: string };
    };
    expect(call.where.tenantId).toBe(TENANT_B);
  });

  it("throws TrainingSeriesNotFoundError when series does not exist", async () => {
    vi.mocked(prisma.trainingSeries.findFirst).mockResolvedValue(null as never);

    await expect(
      updateTrainingSeries(TENANT_A, "nonexistent-id", { title: "New Title" }),
    ).rejects.toThrow(TrainingSeriesNotFoundError);
  });

  it("throws TrainingSeriesValidationError when updated title is empty", async () => {
    await expect(
      updateTrainingSeries(TENANT_A, SERIES_ID, { title: "" }),
    ).rejects.toThrow(TrainingSeriesValidationError);
  });

  it("throws TrainingSeriesValidationError when updated weekdays is empty array", async () => {
    await expect(
      updateTrainingSeries(TENANT_A, SERIES_ID, { weekdays: [] }),
    ).rejects.toThrow(TrainingSeriesValidationError);
  });

  it("throws TrainingSeriesValidationError for invalid time range on update", async () => {
    await expect(
      updateTrainingSeries(TENANT_A, SERIES_ID, {
        startsAt: "21:00",
        endsAt: "19:00",
      }),
    ).rejects.toThrow(TrainingSeriesValidationError);
  });

  it("throws TrainingSeriesValidationError for invalid timezone on update", async () => {
    await expect(
      updateTrainingSeries(TENANT_A, SERIES_ID, { timezone: "Mars/Olympus_Mons" }),
    ).rejects.toThrow(TrainingSeriesValidationError);
  });

  it("throws TrainingSeriesValidationError when updated validFrom is after validUntil", async () => {
    await expect(
      updateTrainingSeries(TENANT_A, SERIES_ID, {
        validFrom: new Date("2027-01-01"),
        validUntil: new Date("2026-01-01"),
      }),
    ).rejects.toThrow(TrainingSeriesValidationError);
  });

  it("throws TrainingSeriesConflictError on duplicate title update", async () => {
    vi.mocked(prisma.trainingSeries.findFirst).mockResolvedValue(baseRow as never);
    vi.mocked(prisma.trainingSeries.update).mockRejectedValue(
      new Error('Unique constraint failed on the fields: (`TrainingSeries_teamSeasonId_title_key`)'),
    );

    await expect(
      updateTrainingSeries(TENANT_A, SERIES_ID, { title: "FF17 Thursday Training" }),
    ).rejects.toThrow(TrainingSeriesConflictError);
  });

  it("allows updating status to ACTIVE", async () => {
    vi.mocked(prisma.trainingSeries.findFirst).mockResolvedValue({
      ...baseRow,
      status: "INACTIVE",
    } as never);
    vi.mocked(prisma.trainingSeries.update).mockResolvedValue({
      ...baseRow,
      status: "ACTIVE",
    } as never);

    const result = await updateTrainingSeries(TENANT_A, SERIES_ID, { status: "ACTIVE" });
    expect(result.status).toBe("ACTIVE");
  });

  it("allows updating status to INACTIVE", async () => {
    vi.mocked(prisma.trainingSeries.findFirst).mockResolvedValue(baseRow as never);
    vi.mocked(prisma.trainingSeries.update).mockResolvedValue({
      ...baseRow,
      status: "INACTIVE",
    } as never);

    const result = await updateTrainingSeries(TENANT_A, SERIES_ID, { status: "INACTIVE" });
    expect(result.status).toBe("INACTIVE");
  });
});

// ── C. archiveTrainingSeries ──────────────────────────────────────────────────

describe("C. archiveTrainingSeries", () => {
  it("sets status to ARCHIVED and records archivedAt", async () => {
    vi.mocked(prisma.trainingSeries.findFirst).mockResolvedValue(baseRow as never);
    vi.mocked(prisma.trainingSeries.update).mockResolvedValue({
      ...baseRow,
      status: "ARCHIVED",
      archivedAt: new Date("2026-09-01"),
    } as never);

    const result = await archiveTrainingSeries(TENANT_A, SERIES_ID);

    expect(result.status).toBe("ARCHIVED");
    expect(result.archivedAt).not.toBeNull();

    const call = vi.mocked(prisma.trainingSeries.update).mock.calls[0][0];
    expect(call.data.status).toBe("ARCHIVED");
  });

  it("is idempotent — preserves existing archivedAt when already archived", async () => {
    const existingArchivedAt = new Date("2026-08-15");
    vi.mocked(prisma.trainingSeries.findFirst).mockResolvedValue({
      ...baseRow,
      status: "ARCHIVED",
      archivedAt: existingArchivedAt,
    } as never);
    vi.mocked(prisma.trainingSeries.update).mockResolvedValue({
      ...baseRow,
      status: "ARCHIVED",
      archivedAt: existingArchivedAt,
    } as never);

    await archiveTrainingSeries(TENANT_A, SERIES_ID);

    const call = vi.mocked(prisma.trainingSeries.update).mock.calls[0][0];
    expect(call.data.archivedAt).toEqual(existingArchivedAt);
  });

  it("throws TrainingSeriesNotFoundError when series not found", async () => {
    vi.mocked(prisma.trainingSeries.findFirst).mockResolvedValue(null as never);

    await expect(archiveTrainingSeries(TENANT_A, "missing-id")).rejects.toThrow(
      TrainingSeriesNotFoundError,
    );
  });

  it("rejects cross-tenant archive", async () => {
    vi.mocked(prisma.trainingSeries.findFirst).mockResolvedValue(null as never);

    await expect(archiveTrainingSeries(TENANT_B, SERIES_ID)).rejects.toThrow(
      TrainingSeriesNotFoundError,
    );
  });
});

// ── D. restoreTrainingSeries ──────────────────────────────────────────────────

describe("D. restoreTrainingSeries", () => {
  it("restores an archived series to INACTIVE and clears archivedAt", async () => {
    vi.mocked(prisma.trainingSeries.findFirst).mockResolvedValue({
      ...baseRow,
      status: "ARCHIVED",
      archivedAt: new Date("2026-09-01"),
    } as never);
    vi.mocked(prisma.trainingSeries.update).mockResolvedValue({
      ...baseRow,
      status: "INACTIVE",
      archivedAt: null,
    } as never);

    const result = await restoreTrainingSeries(TENANT_A, SERIES_ID);

    expect(result.status).toBe("INACTIVE");
    expect(result.archivedAt).toBeNull();

    const call = vi.mocked(prisma.trainingSeries.update).mock.calls[0][0];
    expect(call.data.status).toBe("INACTIVE");
    expect(call.data.archivedAt).toBeNull();
  });

  it("throws TrainingSeriesNotFoundError when series not found", async () => {
    vi.mocked(prisma.trainingSeries.findFirst).mockResolvedValue(null as never);

    await expect(restoreTrainingSeries(TENANT_A, "nonexistent-id")).rejects.toThrow(
      TrainingSeriesNotFoundError,
    );
  });

  it("rejects cross-tenant restore", async () => {
    vi.mocked(prisma.trainingSeries.findFirst).mockResolvedValue(null as never);

    await expect(restoreTrainingSeries(TENANT_B, SERIES_ID)).rejects.toThrow(
      TrainingSeriesNotFoundError,
    );
  });
});

// ── E. listTrainingSeries ─────────────────────────────────────────────────────

describe("E. listTrainingSeries", () => {
  it("returns all non-archived series for a tenant by default", async () => {
    vi.mocked(prisma.trainingSeries.findMany).mockResolvedValue([baseRow] as never);

    const result = await listTrainingSeries(TENANT_A);

    expect(result).toHaveLength(1);
    expect(result[0].tenantId).toBe(TENANT_A);
    expect(prisma.trainingSeries.findMany).toHaveBeenCalledOnce();
  });

  it("filters by teamSeasonId when provided", async () => {
    vi.mocked(prisma.trainingSeries.findMany).mockResolvedValue([baseRow] as never);

    await listTrainingSeries(TENANT_A, { teamSeasonId: TEAM_SEASON_ID });

    const call = vi.mocked(prisma.trainingSeries.findMany).mock.calls[0][0] as {
      where: { teamSeasonId?: string };
    };
    expect(call.where.teamSeasonId).toBe(TEAM_SEASON_ID);
  });

  it("excludes archived series by default", async () => {
    vi.mocked(prisma.trainingSeries.findMany).mockResolvedValue([] as never);

    await listTrainingSeries(TENANT_A);

    const call = vi.mocked(prisma.trainingSeries.findMany).mock.calls[0][0] as {
      where: { NOT?: { status: string } };
    };
    expect(call.where.NOT).toEqual({ status: "ARCHIVED" });
  });

  it("includes archived series when includeArchived = true", async () => {
    vi.mocked(prisma.trainingSeries.findMany).mockResolvedValue([
      { ...baseRow, status: "ARCHIVED", archivedAt: new Date() },
    ] as never);

    const result = await listTrainingSeries(TENANT_A, { includeArchived: true });

    expect(result[0].status).toBe("ARCHIVED");
    const call = vi.mocked(prisma.trainingSeries.findMany).mock.calls[0][0] as {
      where: { NOT?: unknown };
    };
    expect(call.where.NOT).toBeUndefined();
  });

  it("filters by status when provided", async () => {
    vi.mocked(prisma.trainingSeries.findMany).mockResolvedValue([
      { ...baseRow, status: "INACTIVE" },
    ] as never);

    await listTrainingSeries(TENANT_A, { status: "INACTIVE" });

    const call = vi.mocked(prisma.trainingSeries.findMany).mock.calls[0][0] as {
      where: { status?: string };
    };
    expect(call.where.status).toBe("INACTIVE");
  });

  it("always scopes by tenantId", async () => {
    vi.mocked(prisma.trainingSeries.findMany).mockResolvedValue([] as never);

    await listTrainingSeries(TENANT_A);

    const call = vi.mocked(prisma.trainingSeries.findMany).mock.calls[0][0] as {
      where: { tenantId: string };
    };
    expect(call.where.tenantId).toBe(TENANT_A);
  });

  it("returns empty array when no series exist", async () => {
    vi.mocked(prisma.trainingSeries.findMany).mockResolvedValue([] as never);

    const result = await listTrainingSeries(TENANT_A);
    expect(result).toEqual([]);
  });
});

// ── F. getTrainingSeries ──────────────────────────────────────────────────────

describe("F. getTrainingSeries", () => {
  it("returns the series DTO when found", async () => {
    vi.mocked(prisma.trainingSeries.findFirst).mockResolvedValue(baseRow as never);

    const result = await getTrainingSeries(TENANT_A, SERIES_ID);

    expect(result.id).toBe(SERIES_ID);
    expect(result.title).toBe("E1 Tuesday Training");
    expect(result.weekdays).toEqual(["TUESDAY"]);
  });

  it("always scopes by tenantId to prevent cross-tenant read", async () => {
    vi.mocked(prisma.trainingSeries.findFirst).mockResolvedValue(null as never);

    await expect(getTrainingSeries(TENANT_B, SERIES_ID)).rejects.toThrow(
      TrainingSeriesNotFoundError,
    );

    const call = vi.mocked(prisma.trainingSeries.findFirst).mock.calls[0][0] as {
      where: { tenantId: string };
    };
    expect(call.where.tenantId).toBe(TENANT_B);
  });

  it("throws TrainingSeriesNotFoundError when series not found", async () => {
    vi.mocked(prisma.trainingSeries.findFirst).mockResolvedValue(null as never);

    await expect(getTrainingSeries(TENANT_A, "nonexistent-id")).rejects.toThrow(
      TrainingSeriesNotFoundError,
    );
  });

  it("maps recurrenceDays to weekdays array in DTO", async () => {
    vi.mocked(prisma.trainingSeries.findFirst).mockResolvedValue({
      ...baseRow,
      recurrenceDays: [{ weekday: "MONDAY" }, { weekday: "THURSDAY" }],
    } as never);

    const result = await getTrainingSeries(TENANT_A, SERIES_ID);

    expect(result.weekdays).toEqual(["MONDAY", "THURSDAY"]);
  });

  it("maps dates to ISO-8601 strings in DTO", async () => {
    const createdAt = new Date("2026-08-01T10:00:00.000Z");
    const updatedAt = new Date("2026-08-15T12:00:00.000Z");
    vi.mocked(prisma.trainingSeries.findFirst).mockResolvedValue({
      ...baseRow,
      createdAt,
      updatedAt,
    } as never);

    const result = await getTrainingSeries(TENANT_A, SERIES_ID);

    expect(result.createdAt).toBe(createdAt.toISOString());
    expect(result.updatedAt).toBe(updatedAt.toISOString());
  });

  it("includes validFrom and validUntil as ISO strings when set", async () => {
    const validFrom = new Date("2026-08-01");
    const validUntil = new Date("2027-05-31");
    vi.mocked(prisma.trainingSeries.findFirst).mockResolvedValue({
      ...baseRow,
      validFrom,
      validUntil,
    } as never);

    const result = await getTrainingSeries(TENANT_A, SERIES_ID);

    expect(result.validFrom).toBe(validFrom.toISOString());
    expect(result.validUntil).toBe(validUntil.toISOString());
  });
});
