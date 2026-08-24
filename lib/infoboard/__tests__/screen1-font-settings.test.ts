/**
 * INFOBOARD-SCREEN1-URGENT-07K — persistence, defaults, and isolation.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildBoardConfig } from "../board-config";
import type { InboardRow } from "../types";

const prismaMock = vi.hoisted(() => ({
  findFirst: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    infoboard: {
      findFirst: prismaMock.findFirst,
      update: prismaMock.update,
    },
  },
}));

import { getInfoboard, updateInfoboard } from "../queries";

function board(
  id: string,
  tenantId: string,
  fontSizes: Partial<InboardRow> = {},
): InboardRow {
  return {
    id,
    tenantId,
    name: id,
    slug: id,
    status: "ACTIVE",
    templateType: "TAGESUEBERSICHT",
    displayTheme: null,
    headerSubtitleEnabled: true,
    headerSubtitleText: null,
    headerShowTime: true,
    headerShowDate: true,
    headerShowWeather: false,
    announcementEnabled: false,
    announcementText: null,
    announcementBgColor: null,
    announcementTextColor: null,
    layoutJson: null,
    anlageplanBackgroundUrl: null,
    anlageplanJson: null,
    sortOrder: 0,
    screen1TrainingShowLogos: true,
    screen1TrainingLogoSize: "MEDIUM",
    screen1MatchShowLogos: true,
    screen1MatchLogoSize: "MEDIUM",
    screen1TournamentShowLogos: true,
    screen1TournamentLogoSize: "MEDIUM",
    createdAt: new Date("2026-08-24T00:00:00.000Z"),
    updatedAt: new Date("2026-08-24T00:00:00.000Z"),
    ...fontSizes,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("font-size persistence", () => {
  it("persists Training, Match, and Tournament independently", async () => {
    const existing = board("board-1", "tenant-1");
    prismaMock.findFirst.mockResolvedValue(existing);
    prismaMock.update.mockResolvedValue({
      ...existing,
      screen1TrainingFontSize: "SMALL",
      screen1MatchFontSize: "MEDIUM",
      screen1TournamentFontSize: "XLARGE",
    });

    const updated = await updateInfoboard("board-1", "tenant-1", {
      screen1TrainingFontSize: "SMALL",
      screen1MatchFontSize: "MEDIUM",
      screen1TournamentFontSize: "XLARGE",
    });

    expect(prismaMock.update).toHaveBeenCalledWith({
      where: { id: "board-1" },
      data: {
        screen1TrainingFontSize: "SMALL",
        screen1MatchFontSize: "MEDIUM",
        screen1TournamentFontSize: "XLARGE",
      },
    });
    expect(updated).toMatchObject({
      screen1TrainingFontSize: "SMALL",
      screen1MatchFontSize: "MEDIUM",
      screen1TournamentFontSize: "XLARGE",
    });
  });

  it("uses safe defaults for boards created before the columns existed", () => {
    const config = buildBoardConfig(board("legacy", "tenant-1")).presentation;
    expect(config).toMatchObject({
      trainingFontSize: "LARGE",
      matchFontSize: "MEDIUM",
      tournamentFontSize: "LARGE",
    });
  });
});

describe("board and tenant isolation", () => {
  it("keeps board-specific values isolated", () => {
    const boardA = buildBoardConfig(
      board("a", "tenant-1", {
        screen1TrainingFontSize: "SMALL",
        screen1MatchFontSize: "MEDIUM",
        screen1TournamentFontSize: "LARGE",
      }),
    ).presentation;
    const boardB = buildBoardConfig(
      board("b", "tenant-1", {
        screen1TrainingFontSize: "XLARGE",
        screen1MatchFontSize: "SMALL",
        screen1TournamentFontSize: "MEDIUM",
      }),
    ).presentation;

    expect(boardA).not.toEqual(boardB);
    expect(boardA?.trainingFontSize).toBe("SMALL");
    expect(boardB?.trainingFontSize).toBe("XLARGE");
  });

  it("continues to scope reads by both board and tenant", async () => {
    prismaMock.findFirst.mockResolvedValue(null);
    await getInfoboard("board-1", "tenant-b");
    expect(prismaMock.findFirst).toHaveBeenCalledWith({
      where: { id: "board-1", tenantId: "tenant-b" },
    });
  });
});
