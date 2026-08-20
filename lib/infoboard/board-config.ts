/**
 * lib/infoboard/board-config.ts
 *
 * Converts an InboardRow from the DB into the InfoboardBoardConfig shape
 * expected by the Screen 1 live service, and exports the shared per-board
 * shell configuration contract used by ALL Infoboard renderers.
 */

import type { InboardRow } from "./types";
import type { InfoboardBoardConfig } from "@/lib/publishing/infoboard/screen1-live-service";

/** Default announcement header subtitle text. */
export const DEFAULT_HEADER_SUBTITLE = "Heute auf der Sportanlage";

// ── Shared per-board shell configuration ──────────────────────────────────────

/**
 * Canonical shared shell settings for any Infoboard instance.
 *
 * Every board type (TAGESUEBERSICHT, ANLAGENUEBERSICHT, and future types)
 * carries these fields. They are stored as flat columns on the Infoboard
 * model — no separate table or JSON config required.
 *
 * Shell regions covered:
 *   KOPFZEILE  — subtitle on/off, subtitle text, time, date, weather
 *   HINWEIS    — announcement bar on/off, text, colors
 */
export type SharedBoardShellConfig = {
  readonly headerSubtitleEnabled: boolean;
  readonly headerSubtitleText: string | null;
  readonly headerShowTime: boolean;
  readonly headerShowDate: boolean;
  readonly headerShowWeather: boolean;
  readonly announcementEnabled: boolean;
  readonly announcementText: string | null;
  readonly announcementBgColor: string | null;
  readonly announcementTextColor: string | null;
};

/**
 * Extract shared shell configuration from any InboardRow.
 *
 * This is the single canonical mapping from DB columns to the shared shell
 * config interface. All board types (Screen 1, Screen 2, Anlageplan, and
 * future screens) must use this function to read their shell settings.
 */
export function buildSharedShellConfig(board: InboardRow): SharedBoardShellConfig {
  return {
    headerSubtitleEnabled: board.headerSubtitleEnabled,
    headerSubtitleText: board.headerSubtitleText,
    headerShowTime: board.headerShowTime,
    headerShowDate: board.headerShowDate,
    headerShowWeather: board.headerShowWeather,
    announcementEnabled: board.announcementEnabled,
    announcementText: board.announcementText,
    announcementBgColor: board.announcementBgColor,
    announcementTextColor: board.announcementTextColor,
  };
}

/**
 * Builds the per-board configuration overlay for the Screen 1 live service.
 */
export function buildBoardConfig(board: InboardRow): InfoboardBoardConfig {
  const announcement =
    board.announcementEnabled && board.announcementText
      ? {
          enabled: true,
          text: board.announcementText,
          backgroundColor: board.announcementBgColor ?? "#1e3a5f",
          textColor: board.announcementTextColor ?? "#ffffff",
        }
      : board.announcementEnabled
        ? {
            enabled: true,
            text: null,
            backgroundColor: board.announcementBgColor ?? "#1e3a5f",
            textColor: board.announcementTextColor ?? "#ffffff",
          }
        : null;

  return {
    displayTheme: board.displayTheme,
    announcement,
    headerSubtitleEnabled: board.headerSubtitleEnabled,
    headerSubtitleText: board.headerSubtitleText,
    headerShowTime: board.headerShowTime,
    headerShowDate: board.headerShowDate,
    headerShowWeather: board.headerShowWeather,
  };
}
