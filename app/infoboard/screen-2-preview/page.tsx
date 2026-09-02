import { notFound } from "next/navigation";

import { InfoboardAnlageplan } from "@/components/infoboard/anlageplan/InfoboardAnlageplan";
import {
  PREVIEW_CURRENT_TIME_ISO_S2,
  PREVIEW_WEATHER,
} from "@/components/infoboard/screen2/screen2-preview-fixture";
import { prisma } from "@/lib/db/prisma";
import { getInfoboardBySlug } from "@/lib/infoboard/queries";
import { resolveKioskTenant } from "@/lib/infoboard/kiosk-tenant";
import { getCanonicalKioskTransport } from "@/lib/infoboard/kiosk-transport";
import { resolveScreen2PreviewFacilities } from "@/lib/infoboard/screen2-preview-facility-resolver";
import {
  buildAnlageplanLivePayload,
  type AnlageplanSourceDatabase,
} from "@/lib/publishing/infoboard/anlageplan-live-service";
import type { CanonicalInfoboardPolicyDatabase } from "@/lib/publishing/infoboard/canonical-source-loader";
import type {
  InfoboardScreen2Feed,
  PitchEventSummary,
  PitchOccupancy,
} from "@/lib/publishing/event-types";
import type {
  Screen2DressingRoomRow,
  Screen2PitchRow,
} from "@/lib/publishing/infoboard/screen2-live-service";

const SCREEN_2_SLUG = "screen-2";

function enrichApprovedPreviewDetails(
  feed: InfoboardScreen2Feed,
): InfoboardScreen2Feed {
  return {
    ...feed,
    pitches: feed.pitches.map((pitch) => ({
      ...pitch,
      currentEvent: pitch.currentEvent
        ? {
            ...pitch.currentEvent,
            ...(pitch.currentEvent.type === "MATCH"
              ? {
                  displayTitle:
                    "FC Allschwil Junioren C2 vs. FC Therwil C Gelb",
                  teamDisplayName: "FC Allschwil Junioren C2",
                  opponentDisplayName: "FC Therwil C Gelb",
                }
              : pitch.currentEvent.type === "TOURNAMENT"
                ? {
                    displayTitle: "PlayMore Turnier",
                    teamDisplayName: "PlayMore Turnier",
                    participantTeamNames: [
                      "FC Allschwil E2",
                      "FC Binningen E3",
                      "FC Oberwil E2",
                      "FC Therwil E3",
                      "FC Aesch E2",
                      "SC Dornach E3",
                    ],
                  }
                : {
                    teamDisplayName: "Junioren F2",
                  }),
          }
        : null,
      nextEvent: pitch.nextEvent
        ? {
            ...pitch.nextEvent,
            ...(pitch.nextEvent.type === "MATCH"
              ? {
                  teamDisplayName:
                    pitch.nextEvent.teamDisplayName ??
                    "FC Allschwil Junioren C2",
                  opponentDisplayName:
                    pitch.nextEvent.opponentDisplayName ??
                    "FC Therwil C Gelb",
                }
              : {}),
          }
        : null,
    })),
  };
}
function previewAllowed(): boolean {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.VERCEL_GIT_COMMIT_REF === "STAGE"
  );
}

function createPreviewDatabase(): AnlageplanSourceDatabase {
  return {
    event: {
      findMany: (args) =>
        prisma.event.findMany(
          args as Parameters<typeof prisma.event.findMany>[0],
        ) as unknown as ReturnType<
          CanonicalInfoboardPolicyDatabase["event"]["findMany"]
        >,
    },

    trainingSession: {
      findMany: (args) =>
        prisma.trainingSession.findMany(
          args as Parameters<typeof prisma.trainingSession.findMany>[0],
        ) as unknown as ReturnType<
          CanonicalInfoboardPolicyDatabase["trainingSession"]["findMany"]
        >,
    },

    facilityResource: {
      findMany: (args) =>
        prisma.facilityResource.findMany(
          args as Parameters<typeof prisma.facilityResource.findMany>[0],
        ) as unknown as Promise<
          ReadonlyArray<Screen2PitchRow | Screen2DressingRoomRow>
        >,
    },
  };
}

function event(
  values: Omit<PitchEventSummary, "dressingRooms">,
): PitchEventSummary {
  return {
    ...values,
    dressingRooms: [],
  };
}

function buildPhysicalTvPreviewFeed(
  base: InfoboardScreen2Feed,
): InfoboardScreen2Feed {
  /*
   * CRITICAL:
   *
   * Start from the REAL configured FCA pitch inventory.
   *
   * This preserves the exact resource codes used by the persisted
   * Anlageplan map zones. We overlay occupancy only.
   *
   * The production hierarchy remains exclusively owned by
   * groupFacilityPitches() inside InfoboardAnlageplan.
   */

  const pitches = base.pitches;

  const {
    hauptfeldFull,
    kr2Full,
    kr2HalfA: kr2A,
    kr2HalfB: kr2B,
    kr3Full,
    kr3HalfA: kr3A,
    kr3HalfB: kr3B,
  } = resolveScreen2PreviewFacilities(pitches);

  const stadionMatch = event({
    eventId: "preview-tv-match-stadion",
    displayTitle: "FC Allschwil C2 – FC Therwil C Gelb",
    teamDisplayName: "FC Allschwil C2",
    opponentDisplayName: "FC Therwil C Gelb",
    startAt: "2026-09-12T15:00:00.000Z",
    endAt: "2026-09-12T16:45:00.000Z",
    status: "LIVE",
    type: "MATCH",
    temporalRelation: "current",
  });

  const kr2Training = event({
    eventId: "preview-tv-training-kr2-a",
    displayTitle: "Junioren F2",
    teamDisplayName: "Junioren F2",
    opponentDisplayName: null,
    startAt: "2026-09-12T15:00:00.000Z",
    endAt: "2026-09-12T16:30:00.000Z",
    status: "LIVE",
    type: "TRAINING",
    temporalRelation: "current",
  });

  const kr3Tournament = event({
    eventId: "preview-tv-tournament-kr3-b",
    displayTitle: "Kinderfussball E-Junioren Turnier",
    teamDisplayName: "FC Allschwil Junioren E",
    opponentDisplayName: null,
    startAt: "2026-09-12T15:00:00.000Z",
    endAt: "2026-09-12T17:00:00.000Z",
    status: "LIVE",
    type: "TOURNAMENT",
    temporalRelation: "current",
  });

  const nextStadionMatch = event({
    eventId: "preview-tv-next-stadion",
    displayTitle: "FC Allschwil B1 – FC Oberwil B1",
    teamDisplayName: "FC Allschwil B1",
    opponentDisplayName: "FC Oberwil B1",
    startAt: "2026-09-12T18:00:00.000Z",
    endAt: "2026-09-12T19:45:00.000Z",
    status: "SCHEDULED",
    type: "MATCH",
    temporalRelation: "next",
  });

  const nextKr2Training = event({
    eventId: "preview-tv-next-kr2-b",
    displayTitle: "Junioren E3",
    teamDisplayName: "Junioren E3",
    opponentDisplayName: null,
    startAt: "2026-09-12T17:00:00.000Z",
    endAt: "2026-09-12T18:30:00.000Z",
    status: "SCHEDULED",
    type: "TRAINING",
    temporalRelation: "next",
  });

  const nextKr3Training = event({
    eventId: "preview-tv-next-kr3-a",
    displayTitle: "Juniorinnen FF-17",
    teamDisplayName: "Juniorinnen FF-17",
    opponentDisplayName: null,
    startAt: "2026-09-12T17:30:00.000Z",
    endAt: "2026-09-12T19:00:00.000Z",
    status: "SCHEDULED",
    type: "TRAINING",
    temporalRelation: "next",
  });

  const previewPitches = pitches.map(
    (pitch): PitchOccupancy => {
      /*
       * Default every real resource to FREE.
       * Then overlay the exact deterministic physical-TV scenario.
       */
      let result: PitchOccupancy = {
        ...pitch,
        state: "FREE_NOW",
        hasAllocationConflict: false,
        currentEvent: null,
        nextEvent: null,
      };

      if (pitch.code === hauptfeldFull.code) {
        result = {
          ...result,
          state: "OCCUPIED_NOW",
          currentEvent: stadionMatch,
          nextEvent: nextStadionMatch,
        };
      }

      if (pitch.code === kr2A.code) {
        result = {
          ...result,
          state: "OCCUPIED_NOW",
          currentEvent: kr2Training,
        };
      }

      if (pitch.code === kr2B.code) {
        result = {
          ...result,
          state: "UPCOMING",
          nextEvent: nextKr2Training,
        };
      }

      if (pitch.code === kr3A.code) {
        result = {
          ...result,
          state: "UPCOMING",
          nextEvent: nextKr3Training,
        };
      }

      if (pitch.code === kr3B.code) {
        result = {
          ...result,
          state: "OCCUPIED_NOW",
          currentEvent: kr3Tournament,
        };
      }

      /*
       * Explicitly retain the real FULL resources in the raw feed.
       * They are intentionally FREE.
       *
       * groupFacilityPitches() must suppress KR2/KR3 FULL because
       * their halves have current events.
       */
      if (
        pitch.code === kr2Full.code ||
        pitch.code === kr3Full.code
      ) {
        result = {
          ...result,
          state: "FREE_NOW",
          currentEvent: null,
          nextEvent: null,
        };
      }

      return result;
    },
  );

  return {
    ...base,
    generatedAt: PREVIEW_CURRENT_TIME_ISO_S2,
    displayDate: "2026-09-12",
    isStale: false,
    pitches: previewPitches,

    /*
     * Avoid leaking unrelated live dressing-room/unallocated state
     * into the deterministic physical-TV preview.
     */
    dressingRooms: base.dressingRooms.map((room) => ({
      ...room,
      state: "FREE_NOW",
      current: null,
      next: null,
    })),
    unallocated: [],
  };
}

export default async function InfoboardScreen2PreviewPage() {
  if (!previewAllowed()) {
    notFound();
  }

  const tenant = await resolveKioskTenant();

  if (!tenant?.timezone) {
    notFound();
  }

  const board = await getInfoboardBySlug(
    SCREEN_2_SLUG,
    tenant.id,
  );

  if (
    !board ||
    board.status !== "ACTIVE" ||
    board.templateType !== "ANLAGENUEBERSICHT"
  ) {
    notFound();
  }

  /*
   * Load the REAL configured Anlageplan and REAL FCA facility
   * inventory using the production builder.
   *
   * Production itself is not modified.
   */
  const configuredPayload =
    await buildAnlageplanLivePayload({
      board,
      tenant: {
        id: tenant.id,
        key: tenant.key,
        name: tenant.name,
        timezone: tenant.timezone,
        logoUrl: tenant.logoUrl,
        infoboardDisplayTheme:
          tenant.infoboardDisplayTheme,
      },
      now: new Date(PREVIEW_CURRENT_TIME_ISO_S2),
      database: createPreviewDatabase(),
    });

  /*
   * Preview-only occupancy overlay.
   *
   * Crucially, this starts from configuredPayload.screen2.feed,
   * therefore all pitch identities remain the REAL ones used by
   * the persisted Anlageplan zones.
   */
  const previewFeed =
    buildPhysicalTvPreviewFeed(
      configuredPayload.screen2.feed,
    );

  const payload = {
    ...configuredPayload,
    screen2: {
      ...configuredPayload.screen2,
      feed: enrichApprovedPreviewDetails(previewFeed),
      currentTimeIso: PREVIEW_CURRENT_TIME_ISO_S2,
    },
    currentTimeIso: PREVIEW_CURRENT_TIME_ISO_S2,
  };

  const transport = await getCanonicalKioskTransport(tenant.key);

  return (
    <InfoboardAnlageplan
        payload={payload}
        weather={PREVIEW_WEATHER}
        richEventCards
        tenantKey={tenant.key}
        transport={transport}
      branding={{
        clubLogoSrc:
          tenant.logoUrl ??
          "/images/logos/fc-allschwil.png",
        productLogoSrc:
          "/images/branding/sportclubevo_logo.png",
        clubName:
          tenant.name ?? "FC ALLSCHWIL",
        facilityName:
          "SPORTANLAGE IM BRÜEL",
      }}
      />
  );
}