/**
 * lib/website/public-events-mapper.ts
 *
 * Shared mapper from the internal PublicEventItem (used by lib/events/public-event-feed)
 * to the website-safe PublicWebsiteEventItem type declared in lib/website/types.
 *
 * Used by:
 *   - /api/public/[tenant]/website/events
 *   - /api/public/[tenant]/website/matches
 *   - /api/public/[tenant]/website/weekplan (via day-grouped events)
 *
 * Do NOT duplicate this mapper — import it from this module.
 */

import type { PublicEventItem } from "@/lib/events/public-event-feed";
import type { PublicWebsiteEventItem } from "@/lib/website/types";

/**
 * Maps a full internal PublicEventItem to the slim website-safe shape.
 *
 * Intentionally drops: visibility flags, allocation codes (pitchCode,
 * dressing-room codes), remarks, sortOrder, and the source field which
 * carries internal import metadata.
 */
export function toPublicWebsiteEvent(event: PublicEventItem): PublicWebsiteEventItem {
  return {
    id: event.id,
    title: event.title,
    type: event.type,
    status: event.status,
    startAt: event.startAt,
    endAt: event.endAt,
    location: event.location,
    description: event.description,
    opponentName: event.opponentName,
    organizerName: event.organizerName,
    competitionLabel: event.competitionLabel,
    homeAway: event.homeAway,
    resultLabel: event.resultLabel,
    meetingTime: event.meetingTime,
    team: event.team
      ? {
          id: event.team.id,
          name: event.team.name,
          slug: event.team.slug,
          category: event.team.category,
          genderGroup: event.team.genderGroup,
          ageGroup: event.team.ageGroup,
        }
      : null,
    // season may be null when Event.seasonId was set null by Season deletion.
    season: event.season
      ? { key: event.season.key, name: event.season.name }
      : null,
  };
}
