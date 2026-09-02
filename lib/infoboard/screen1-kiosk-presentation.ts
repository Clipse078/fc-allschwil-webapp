/**
 * lib/infoboard/screen1-kiosk-presentation.ts
 *
 * Shared Screen 1 presentation contract for Dashboard Preview and kiosk routes.
 * Both hosts must receive identical payload, weather, and InfoboardScreen1 props
 * for the same tenant/board/time so weather visibility and shell config match.
 */

import type { InfoboardScreen1Props } from "@/components/infoboard/screen1/InfoboardScreen1";
import type { InboardRow } from "@/lib/infoboard/types";
import { buildBoardConfig } from "@/lib/infoboard/board-config";
import type { PublicationEventLoader } from "@/lib/publishing/policy/event-selection";
import {
  buildScreen1LivePayload,
  type InfoboardBoardConfig,
  type InfoboardScreen1LivePayload,
  type Screen1TenantContext,
} from "@/lib/publishing/infoboard/screen1-live-service";
import type { Screen1SourceEvent } from "@/lib/publishing/infoboard/screen1-event-mapper";
import type { Screen1TournamentPresentationDatabase } from "@/lib/publishing/infoboard/screen1-tournament-presentation";
import type { ResolvedOrganizerClub } from "@/lib/tournaments/club-identity";
import type { WeatherResult } from "@/lib/weather/weather-types";
import { getCanonicalKioskWeather } from "@/lib/infoboard/kiosk-weather";
import {
  createScreen1TournamentPresentationDatabase,
  resolveScreen1OrganizerClubsByName,
} from "@/lib/infoboard/screen1-tournament-composition";

export type Screen1KioskPresentation = {
  readonly payload: InfoboardScreen1LivePayload;
  readonly weather: WeatherResult;
  readonly infoboardScreen1Props: Omit<
    InfoboardScreen1Props,
    "liveClock" | "previewPagination"
  >;
};

export async function buildScreen1KioskPresentation(params: {
  readonly tenant: Screen1TenantContext;
  readonly now: Date;
  readonly loader: PublicationEventLoader<Screen1SourceEvent>;
  readonly board?: InboardRow | null;
  readonly boardConfig?: InfoboardBoardConfig | null;
  readonly tournamentPresentationDatabase?: Screen1TournamentPresentationDatabase | null;
  readonly resolveOrganizerClubsByName?: (
    organizerNames: readonly string[],
  ) => Promise<ReadonlyMap<string, ResolvedOrganizerClub>>;
  readonly weather?: WeatherResult;
}): Promise<Screen1KioskPresentation> {
  const boardConfig =
    params.boardConfig ??
    (params.board != null ? buildBoardConfig(params.board) : null);

  const tournamentPresentationDatabase =
    params.tournamentPresentationDatabase ??
    createScreen1TournamentPresentationDatabase();

  const resolveOrganizerClubsByName =
    params.resolveOrganizerClubsByName ??
    ((organizerNames) =>
      resolveScreen1OrganizerClubsByName(params.tenant.id, organizerNames));

  const payload = await buildScreen1LivePayload({
    tenant: params.tenant,
    now: params.now,
    loader: params.loader,
    boardConfig,
    tournamentPresentationDatabase,
    resolveOrganizerClubsByName,
  });

  const weather = params.weather ?? (await getCanonicalKioskWeather());

  return {
    payload,
    weather,
    infoboardScreen1Props: {
      feed: payload.feed,
      branding: payload.branding,
      currentTimeIso: payload.currentTimeIso,
      weather,
      announcement: payload.announcement ?? undefined,
      eventPresentation: payload.eventPresentation,
      theme: payload.theme,
      headerConfig: payload.headerConfig ?? undefined,
      presentation: payload.presentation ?? undefined,
      studio: payload.studio ?? undefined,
    },
  };
}
