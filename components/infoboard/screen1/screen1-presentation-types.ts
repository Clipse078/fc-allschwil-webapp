/**
 * components/infoboard/screen1/screen1-presentation-types.ts
 *
 * Presentation-only extension types for Infoboard Screen 1.
 *
 * These types are visual composition inputs only. They bridge a temporary UI
 * need for multi-team tournament allocation display and tenant-configurable
 * announcement bar content until canonical data contracts are added to the
 * Publishing Platform feed in a future slice (PP-02C or later).
 *
 * LIMITATIONS (to be resolved in a future feed slice):
 *   - participantAllocations data is not sourced from the publishing feed.
 *     It must be supplied separately by the preview fixture or a future API.
 *   - These types must not be confused with canonical publishing DTOs.
 *   - The announcement configuration has no persistence — it must be supplied
 *     as a prop until a tenant settings API is wired in a future slice.
 *
 * Constraints:
 *   - No any.
 *   - No Prisma imports.
 *   - No duplication of feed DTOs.
 *   - No broad index signatures.
 *   - All fields readonly.
 *   - No database semantics.
 *   - No methods.
 *   - No color fields beyond announcement presentation.
 */

/**
 * Tenant-configurable announcement bar presentation inputs.
 *
 * Persistence of these settings is deferred to a future tenant settings API.
 * The reusable component must not hardcode any club-specific text.
 */
export type InfoboardAnnouncementPresentation = {
  readonly enabled: boolean;
  readonly text: string | null;
  readonly backgroundColor: string | null;
  readonly textColor: string | null;
};

/**
 * Explicit team-to-dressing-room allocation for a single tournament participant.
 *
 * Used when the event has three or more participating teams and each team must
 * be paired with its assigned dressing room in the display.
 */
export type InfoboardTeamAllocationPresentation = {
  readonly id: string;
  readonly teamDisplayName: string;
  readonly dressingRoomLabel: string | null;
  readonly isHomeTeam?: boolean;
};

/**
 * Presentation extension for a single event in the Screen 1 feed.
 *
 * Identified by eventId matching InfoboardScreen1Event.id. When multiple
 * entries share the same eventId, the first matching entry is used.
 * Unknown eventIds are ignored safely.
 *
 * participantAllocations:
 *   - undefined or length < 3 → render standard card
 *   - length ≥ 3             → render multi-team allocation matrix
 */
export type InfoboardEventPresentationExtension = {
  readonly eventId: string;
  readonly participantAllocations?: readonly InfoboardTeamAllocationPresentation[];
};
