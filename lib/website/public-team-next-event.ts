import type {
  PublicTeamMatch,
  PublicTeamNextEvent,
  PublicTeamPublication,
  PublicWebsiteTournamentItem,
} from "@/lib/website/types";

type ResolvePublicTeamNextEventInput = {
  publication: PublicTeamPublication;
  nextMatch: PublicTeamMatch | null;
  nextTournament: PublicWebsiteTournamentItem | null;
};

/**
 * Resolves the public team page's single next-event position.
 *
 * This is deliberately preference-based, not chronological: an enabled match
 * always wins when present, even when an enabled tournament starts earlier.
 */
export function resolvePublicTeamNextEvent({
  publication,
  nextMatch,
  nextTournament,
}: ResolvePublicTeamNextEventInput): PublicTeamNextEvent {
  if (publication.showNextMatch && nextMatch) {
    return { type: "MATCH", match: nextMatch };
  }

  if (publication.showNextTournament && nextTournament) {
    return { type: "TOURNAMENT", tournament: nextTournament };
  }

  return null;
}
