/**
 * lib/infoboard/__tests__/shared-shell-config.test.ts
 *
 * INFOBOARD-FINAL-C — Focused tests for the shared per-board shell
 * configuration contract.
 *
 * Covers:
 *   - buildSharedShellConfig correctly maps all InboardRow fields
 *   - Independent per-board config (board A does not affect board B)
 *   - Future board contract contains all required shell fields
 *   - Default values from buildBoardConfig remain unchanged
 */

import { describe, it, expect } from "vitest";
import {
  buildSharedShellConfig,
  buildBoardConfig,
  DEFAULT_HEADER_SUBTITLE,
  type SharedBoardShellConfig,
} from "@/lib/infoboard/board-config";
import type { InboardRow } from "@/lib/infoboard/types";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeBoard(overrides: Partial<InboardRow> = {}): InboardRow {
  return {
    id: "board-001",
    tenantId: "tenant-001",
    name: "Test Board",
    slug: "test-board",
    status: "ACTIVE",
    templateType: "TAGESUEBERSICHT",
    displayTheme: null,
    headerSubtitleEnabled: true,
    headerSubtitleText: "Heute auf der Sportanlage",
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
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
    ...overrides,
  };
}

// ── buildSharedShellConfig ─────────────────────────────────────────────────────

describe("buildSharedShellConfig", () => {
  it("maps headerSubtitleEnabled from board", () => {
    const board = makeBoard({ headerSubtitleEnabled: true });
    const config = buildSharedShellConfig(board);
    expect(config.headerSubtitleEnabled).toBe(true);
  });

  it("maps headerSubtitleEnabled=false from board", () => {
    const board = makeBoard({ headerSubtitleEnabled: false });
    const config = buildSharedShellConfig(board);
    expect(config.headerSubtitleEnabled).toBe(false);
  });

  it("maps headerSubtitleText from board", () => {
    const board = makeBoard({ headerSubtitleText: "SPORTANLAGE IM BRÜEL" });
    const config = buildSharedShellConfig(board);
    expect(config.headerSubtitleText).toBe("SPORTANLAGE IM BRÜEL");
  });

  it("maps null headerSubtitleText from board", () => {
    const board = makeBoard({ headerSubtitleText: null });
    const config = buildSharedShellConfig(board);
    expect(config.headerSubtitleText).toBeNull();
  });

  it("maps headerShowTime from board", () => {
    const board = makeBoard({ headerShowTime: false });
    const config = buildSharedShellConfig(board);
    expect(config.headerShowTime).toBe(false);
  });

  it("maps headerShowDate from board", () => {
    const board = makeBoard({ headerShowDate: false });
    const config = buildSharedShellConfig(board);
    expect(config.headerShowDate).toBe(false);
  });

  it("maps headerShowWeather from board", () => {
    const board = makeBoard({ headerShowWeather: true });
    const config = buildSharedShellConfig(board);
    expect(config.headerShowWeather).toBe(true);
  });

  it("maps announcementEnabled from board", () => {
    const board = makeBoard({ announcementEnabled: true, announcementText: "Test" });
    const config = buildSharedShellConfig(board);
    expect(config.announcementEnabled).toBe(true);
  });

  it("maps announcementText from board", () => {
    const board = makeBoard({
      announcementEnabled: true,
      announcementText: "Herzlich willkommen",
    });
    const config = buildSharedShellConfig(board);
    expect(config.announcementText).toBe("Herzlich willkommen");
  });

  it("maps announcementBgColor from board", () => {
    const board = makeBoard({
      announcementEnabled: true,
      announcementBgColor: "#1e3a5f",
    });
    const config = buildSharedShellConfig(board);
    expect(config.announcementBgColor).toBe("#1e3a5f");
  });

  it("maps announcementTextColor from board", () => {
    const board = makeBoard({
      announcementEnabled: true,
      announcementTextColor: "#ffffff",
    });
    const config = buildSharedShellConfig(board);
    expect(config.announcementTextColor).toBe("#ffffff");
  });

  it("maps null announcement fields when announcement is disabled", () => {
    const board = makeBoard({
      announcementEnabled: false,
      announcementText: null,
      announcementBgColor: null,
      announcementTextColor: null,
    });
    const config = buildSharedShellConfig(board);
    expect(config.announcementEnabled).toBe(false);
    expect(config.announcementText).toBeNull();
    expect(config.announcementBgColor).toBeNull();
    expect(config.announcementTextColor).toBeNull();
  });

  it("works for ANLAGENUEBERSICHT template type", () => {
    const board = makeBoard({
      templateType: "ANLAGENUEBERSICHT",
      headerSubtitleEnabled: true,
      headerSubtitleText: "ANLAGENÜBERSICHT",
      announcementEnabled: true,
      announcementText: "Orientierung Sportanlage",
    });
    const config = buildSharedShellConfig(board);
    expect(config.headerSubtitleEnabled).toBe(true);
    expect(config.headerSubtitleText).toBe("ANLAGENÜBERSICHT");
    expect(config.announcementEnabled).toBe(true);
    expect(config.announcementText).toBe("Orientierung Sportanlage");
  });
});

// ── Independent per-board config ──────────────────────────────────────────────

describe("SharedBoardShellConfig — board independence", () => {
  it("changing board A subtitle does not affect board B config", () => {
    const boardA = makeBoard({
      id: "board-A",
      headerSubtitleText: "TAGESÜBERSICHT SCREEN 1",
    });
    const boardB = makeBoard({
      id: "board-B",
      headerSubtitleText: "ANLAGENÜBERSICHT SCREEN 2",
    });

    const configA = buildSharedShellConfig(boardA);
    const configB = buildSharedShellConfig(boardB);

    expect(configA.headerSubtitleText).toBe("TAGESÜBERSICHT SCREEN 1");
    expect(configB.headerSubtitleText).toBe("ANLAGENÜBERSICHT SCREEN 2");
    // Mutating configA must not affect configB (they are separate objects)
    expect(configA).not.toBe(configB);
  });

  it("board A announcement does not affect board B", () => {
    const boardA = makeBoard({
      id: "board-A",
      announcementEnabled: true,
      announcementText: "Herzlich willkommen auf der Sportanlage im Brüel",
    });
    const boardB = makeBoard({
      id: "board-B",
      announcementEnabled: true,
      announcementText: "Orientierung Sportanlage im Brüel",
    });

    const configA = buildSharedShellConfig(boardA);
    const configB = buildSharedShellConfig(boardB);

    expect(configA.announcementText).toBe("Herzlich willkommen auf der Sportanlage im Brüel");
    expect(configB.announcementText).toBe("Orientierung Sportanlage im Brüel");
  });

  it("board A disabled announcement does not affect board B enabled", () => {
    const boardA = makeBoard({ id: "board-A", announcementEnabled: false });
    const boardB = makeBoard({ id: "board-B", announcementEnabled: true, announcementText: "Info B" });

    const configA = buildSharedShellConfig(boardA);
    const configB = buildSharedShellConfig(boardB);

    expect(configA.announcementEnabled).toBe(false);
    expect(configB.announcementEnabled).toBe(true);
  });
});

// ── SharedBoardShellConfig type contract ──────────────────────────────────────

describe("SharedBoardShellConfig — type contract", () => {
  it("config has all required shell fields", () => {
    const board = makeBoard();
    const config: SharedBoardShellConfig = buildSharedShellConfig(board);

    // KOPFZEILE fields
    expect(typeof config.headerSubtitleEnabled).toBe("boolean");
    expect(config.headerSubtitleText === null || typeof config.headerSubtitleText === "string").toBe(true);
    expect(typeof config.headerShowTime).toBe("boolean");
    expect(typeof config.headerShowDate).toBe("boolean");
    expect(typeof config.headerShowWeather).toBe("boolean");

    // HINWEISLEISTE fields
    expect(typeof config.announcementEnabled).toBe("boolean");
    expect(config.announcementText === null || typeof config.announcementText === "string").toBe(true);
    expect(config.announcementBgColor === null || typeof config.announcementBgColor === "string").toBe(true);
    expect(config.announcementTextColor === null || typeof config.announcementTextColor === "string").toBe(true);
  });

  it("future board (new templateType) inherits all shell fields automatically", () => {
    // Simulates a future Screen 3 board
    const futureBoard = makeBoard({
      id: "future-board",
      templateType: "FUTURE_SCREEN_3",
      headerSubtitleEnabled: true,
      headerSubtitleText: "Future Screen Title",
      headerShowTime: true,
      headerShowDate: false,
      headerShowWeather: true,
      announcementEnabled: true,
      announcementText: "Future announcement",
    });

    const config = buildSharedShellConfig(futureBoard);

    // All shell fields are accessible regardless of templateType
    expect(config.headerSubtitleEnabled).toBe(true);
    expect(config.headerSubtitleText).toBe("Future Screen Title");
    expect(config.headerShowTime).toBe(true);
    expect(config.headerShowDate).toBe(false);
    expect(config.headerShowWeather).toBe(true);
    expect(config.announcementEnabled).toBe(true);
    expect(config.announcementText).toBe("Future announcement");
  });
});

// ── buildBoardConfig backward compat ──────────────────────────────────────────

describe("buildBoardConfig — backward compatibility (Screen 1)", () => {
  it("DEFAULT_HEADER_SUBTITLE is the canonical fallback", () => {
    expect(DEFAULT_HEADER_SUBTITLE).toBe("Heute auf der Sportanlage");
  });

  it("buildBoardConfig returns correct headerSubtitleEnabled", () => {
    const board = makeBoard({ headerSubtitleEnabled: false });
    const config = buildBoardConfig(board);
    expect(config.headerSubtitleEnabled).toBe(false);
  });

  it("buildBoardConfig returns correct announcement when enabled", () => {
    const board = makeBoard({
      announcementEnabled: true,
      announcementText: "Test announcement",
      announcementBgColor: "#1e3a5f",
      announcementTextColor: "#ffffff",
    });
    const config = buildBoardConfig(board);
    expect(config.announcement?.enabled).toBe(true);
    expect(config.announcement?.text).toBe("Test announcement");
  });

  it("buildBoardConfig returns null announcement when disabled", () => {
    const board = makeBoard({ announcementEnabled: false });
    const config = buildBoardConfig(board);
    expect(config.announcement).toBeNull();
  });
});
