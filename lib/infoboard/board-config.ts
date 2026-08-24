/**
 * lib/infoboard/board-config.ts
 *
 * Converts an InboardRow from the DB into the InfoboardBoardConfig shape
 * expected by the Screen 1 live service.
 */

import type { InboardRow } from "./types";
import type { InfoboardBoardConfig } from "@/lib/publishing/infoboard/screen1-live-service";
import {
  DEFAULT_MATCH_FONT_SIZE,
  DEFAULT_TOURNAMENT_FONT_SIZE,
  DEFAULT_TRAINING_FONT_SIZE,
  DEFAULT_SCREEN1_PRESENTATION,
  resolveInfoboardFontSize,
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
    presentation: {
      trainingShowLogos:
        board.screen1TrainingShowLogos ?? DEFAULT_SCREEN1_PRESENTATION.trainingShowLogos,
      trainingLogoSize: resolveInfoboardLogoSize(board.screen1TrainingLogoSize),
      matchShowLogos: board.screen1MatchShowLogos ?? DEFAULT_SCREEN1_PRESENTATION.matchShowLogos,
      matchLogoSize: resolveInfoboardLogoSize(board.screen1MatchLogoSize),
      tournamentShowLogos:
        board.screen1TournamentShowLogos ?? DEFAULT_SCREEN1_PRESENTATION.tournamentShowLogos,
      tournamentLogoSize: resolveInfoboardLogoSize(board.screen1TournamentLogoSize),
      trainingFontSize: resolveInfoboardFontSize(
        board.screen1TrainingFontSize,
        DEFAULT_TRAINING_FONT_SIZE,
      ),
      matchFontSize: resolveInfoboardFontSize(
        board.screen1MatchFontSize,
        DEFAULT_MATCH_FONT_SIZE,
      ),
      tournamentFontSize: resolveInfoboardFontSize(
        board.screen1TournamentFontSize,
        DEFAULT_TOURNAMENT_FONT_SIZE,
      ),
    },
  };
}
