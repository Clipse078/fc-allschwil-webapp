/**
 * components/infoboard/screen1/screen1-preview-fixture.ts
 *
 * Deterministic preview fixture for Infoboard Screen 1.
 *
 * PREVIEW-ONLY — must never be imported by production feed builders or API
 * routes. All timestamps are fixed UTC ISO-8601 strings.
 *
 * Fixed display date: 2026-09-12 (Saturday, Europe/Zurich = UTC+2 in summer).
 * Tenant timezone: "Europe/Zurich".
 * Generated at:     2026-09-12T08:30:00.000Z  →  10:30 Zurich
 *
 * Zurich offset (+2h in summer):
 *   08:00Z → 10:00 Zurich
 *   09:00Z → 11:00 Zurich
 *   11:00Z → 13:00 Zurich
 *   12:00Z → 14:00 Zurich
 *   13:30Z → 15:30 Zurich
 */

import type { InfoboardScreen1Feed } from "@/lib/publishing/event-types";

export const PREVIEW_FIXTURE: InfoboardScreen1Feed = {
  generatedAt: "2026-09-12T08:30:00.000Z",
  tenant: {
    id: "tenant-preview-fca",
    key: "fc-allschwil",
    name: "FC Allschwil",
    timezone: "Europe/Zurich",
  },
  displayDate: "2026-09-12",
  isStale: false,
  wochenplanVariantBadge: null,

  // ── CURRENT — events ongoing at 10:30 Zurich ──────────────────────────────
  current: [
    {
      // Training — running now, pitch + one dressing room, no opponent
      id: "evt-cur-1",
      type: "TRAINING",
      displayTitle: "U12 Training",
      teamDisplayName: "FC Allschwil U12",
      opponentDisplayName: null,
      organizerDisplayName: null,
      competitionLabel: null,
      startAt: "2026-09-12T08:00:00.000Z",
      endAt: "2026-09-12T09:30:00.000Z",
      meetingTime: null,
      status: "LIVE",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "current",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "Platz 1",
        homeDressingRoomLabel: "Kabine A",
        awayDressingRoomLabel: null,
        refereeDressingRoomLabel: null,
      },
    },
    {
      // Match — running now, full allocation set
      id: "evt-cur-2",
      type: "MATCH",
      displayTitle: "FC Allschwil E1 – FC Binningen E1",
      teamDisplayName: "FC Allschwil E1",
      opponentDisplayName: "FC Binningen E1",
      organizerDisplayName: null,
      competitionLabel: "Meisterschaft 3. Liga",
      startAt: "2026-09-12T08:00:00.000Z",
      endAt: "2026-09-12T09:45:00.000Z",
      meetingTime: "2026-09-12T07:30:00.000Z",
      status: "LIVE",
      resultLabel: null,
      intermediateResultLabel: "1:0",
      temporalBucket: "current",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "Stadion",
        homeDressingRoomLabel: "Kabine E1",
        awayDressingRoomLabel: "Kabine E2",
        refereeDressingRoomLabel: "Kabine E3",
      },
    },
  ],

  // ── NEXT — two simultaneous events at 11:00 Zurich (09:00Z) ──────────────
  next: [
    {
      // Tournament — simultaneous, long tournament title, partial allocation
      id: "evt-nxt-1",
      type: "TOURNAMENT",
      displayTitle: "FC Allschwil Sommer-Cup Junioren 2026",
      teamDisplayName: "FC Allschwil Junioren",
      opponentDisplayName: null,
      organizerDisplayName: "FC Allschwil",
      competitionLabel: "Sommer-Cup",
      startAt: "2026-09-12T09:00:00.000Z",
      endAt: null,
      meetingTime: null,
      status: "SCHEDULED",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "next",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "Kunstrasen 2",
        homeDressingRoomLabel: "Kabine O1",
        awayDressingRoomLabel: null,
        refereeDressingRoomLabel: null,
      },
    },
    {
      // Training — simultaneous with above at same start time
      id: "evt-nxt-2",
      type: "TRAINING",
      displayTitle: "D1 Training",
      teamDisplayName: "FC Allschwil D1",
      opponentDisplayName: null,
      organizerDisplayName: null,
      competitionLabel: null,
      startAt: "2026-09-12T09:00:00.000Z",
      endAt: "2026-09-12T10:30:00.000Z",
      meetingTime: null,
      status: "SCHEDULED",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "next",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "Kunstrasen 3",
        homeDressingRoomLabel: "Kabine O2",
        awayDressingRoomLabel: null,
        refereeDressingRoomLabel: null,
      },
    },
  ],

  // ── LATER — mixed types, various allocation combinations ──────────────────
  later: [
    {
      // Match — full allocation, competition present
      id: "evt-lat-1",
      type: "MATCH",
      displayTitle: "FC Allschwil 1. Mannschaft – FC Reinach 1",
      teamDisplayName: "FC Allschwil 1. Mannschaft",
      opponentDisplayName: "FC Reinach 1",
      organizerDisplayName: null,
      competitionLabel: "Meisterschaft 2. Liga",
      startAt: "2026-09-12T11:00:00.000Z",
      endAt: "2026-09-12T12:45:00.000Z",
      meetingTime: "2026-09-12T10:30:00.000Z",
      status: "SCHEDULED",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "later",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "Stadion",
        homeDressingRoomLabel: "Kabine E1",
        awayDressingRoomLabel: "Kabine E2",
        refereeDressingRoomLabel: "Kabine C",
      },
    },
    {
      // Training — no competition, only pitch + dressing room
      id: "evt-lat-2",
      type: "TRAINING",
      displayTitle: "U8/U10 Minis Training",
      teamDisplayName: "FC Allschwil U8/U10",
      opponentDisplayName: null,
      organizerDisplayName: null,
      competitionLabel: null,
      startAt: "2026-09-12T12:00:00.000Z",
      endAt: null,
      meetingTime: null,
      status: "SCHEDULED",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "later",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "Kunstrasen 3",
        homeDressingRoomLabel: "Kabine A",
        awayDressingRoomLabel: null,
        refereeDressingRoomLabel: null,
      },
    },
    {
      // Tournament — only pitch allocation, no dressing rooms; no opponent
      id: "evt-lat-3",
      type: "TOURNAMENT",
      displayTitle: "Hallenturnier FC Allschwil",
      teamDisplayName: "FC Allschwil Damen",
      opponentDisplayName: null,
      organizerDisplayName: "FC Allschwil",
      competitionLabel: "Hallenturnier",
      startAt: "2026-09-12T13:30:00.000Z",
      endAt: null,
      meetingTime: null,
      status: "SCHEDULED",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "later",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "Kunstrasen 2",
        homeDressingRoomLabel: null,
        awayDressingRoomLabel: null,
        refereeDressingRoomLabel: null,
      },
    },
  ],

  isEmpty: false,
};

/**
 * Fixture with an empty current section but populated future sections.
 * Used to verify the restrained "no current event" message.
 */
export const PREVIEW_FIXTURE_EMPTY_CURRENT: InfoboardScreen1Feed = {
  ...PREVIEW_FIXTURE,
  current: [],
};

/**
 * Fixture with all buckets empty.
 * Used to verify the full empty-state rendering.
 */
export const PREVIEW_FIXTURE_EMPTY: InfoboardScreen1Feed = {
  ...PREVIEW_FIXTURE,
  current: [],
  next: [],
  later: [],
  isEmpty: true,
};
