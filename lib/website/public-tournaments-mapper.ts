/**
 * lib/website/public-tournaments-mapper.ts
 *
 * TOURNAMENT-LOGOS-01A — maps canonical tournament Event rows to the public
 * website tournament contract with organizer/participant club logos.
 */

import type { TournamentDto } from "@/lib/tournaments/types";
import { toPublicWebsiteEvent } from "@/lib/website/public-events-mapper";
import type {
  PublicWebsiteTournamentItem,
  PublicWebsiteTournamentOrganizer,
  PublicWebsiteTournamentParticipant,
} from "@/lib/website/types";
import type { PublicEventItem } from "@/lib/events/public-event-feed";

function toPublicOrganizer(tournament: TournamentDto): PublicWebsiteTournamentOrganizer | null {
  const displayName = tournament.organizerName?.trim();
  if (!displayName) return null;

  return {
    displayName,
    logoUrl: tournament.organizerLogoUrl,
    externalClubId: tournament.organizerExternalClubId,
  };
}

function toPublicParticipant(
  participant: TournamentDto["participants"][number],
): PublicWebsiteTournamentParticipant {
  return {
    id: participant.id,
    displayName: participant.displayName,
    logoUrl: participant.logoUrl,
    kind: participant.kind,
    teamId: participant.team?.id ?? null,
    externalClubId: participant.externalClub?.club.id ?? null,
  };
}

/**
 * Enriches a public event feed row with canonical tournament club identity.
 */
export function toPublicWebsiteTournament(
  event: PublicEventItem,
  tournament: TournamentDto,
): PublicWebsiteTournamentItem {
  return {
    ...toPublicWebsiteEvent(event),
    organizer: toPublicOrganizer(tournament),
    participants: tournament.participants.map(toPublicParticipant),
  };
}

/**
 * Maps feed events to tournament DTOs keyed by event id.
 */
export function indexTournamentsByEventId(
  tournaments: readonly TournamentDto[],
): ReadonlyMap<string, TournamentDto> {
  return new Map(tournaments.map((tournament) => [tournament.id, tournament]));
}
