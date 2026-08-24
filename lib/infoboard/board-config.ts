/**
 * lib/infoboard/board-config.ts
 *
 * Converts an InboardRow from the DB into the InfoboardBoardConfig shape
 * expected by the Screen 1 live service.
 */

import type { InboardRow } from "./types";
import type { InfoboardBoardConfig } from "@/lib/publishing/infoboard/screen1-live-service";
import {
  DEFAULT_SCREEN1_LOGO_PRESENTATION,
  resolveInfoboardLogoSize,
} from "./screen1-logo-settings";

/** Default announcement header subtitle text. */
export const DEFAULT_HEADER_SUBTITLE = "Heute auf der Sportanlage";

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
    logoPresentation: {
      matchShowLogos: board.screen1MatchShowLogos ?? DEFAULT_SCREEN1_LOGO_PRESENTATION.matchShowLogos,
      matchLogoSize: resolveInfoboardLogoSize(board.screen1MatchLogoSize),
      tournamentShowLogos:
        board.screen1TournamentShowLogos ?? DEFAULT_SCREEN1_LOGO_PRESENTATION.tournamentShowLogos,
      tournamentLogoSize: resolveInfoboardLogoSize(board.screen1TournamentLogoSize),
    },
  };
}
