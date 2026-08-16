import { notFound } from "next/navigation";

import { InfoboardAnlageplan } from "@/components/infoboard/anlageplan/InfoboardAnlageplan";
import {
  PREVIEW_CURRENT_TIME_ISO_S2,
  PREVIEW_FIXTURE_SCREEN2_PHYSICAL_TV,
  PREVIEW_WEATHER,
} from "@/components/infoboard/screen2/screen2-preview-fixture";
import { prisma } from "@/lib/db/prisma";
import { getInfoboardBySlug } from "@/lib/infoboard/queries";
import { resolveKioskTenant } from "@/lib/infoboard/kiosk-tenant";
import {
  buildAnlageplanLivePayload,
  type AnlageplanSourceDatabase,
} from "@/lib/publishing/infoboard/anlageplan-live-service";
import type { CanonicalInfoboardPolicyDatabase } from "@/lib/publishing/infoboard/canonical-source-loader";
import type {
  Screen2DressingRoomRow,
  Screen2PitchRow,
} from "@/lib/publishing/infoboard/screen2-live-service";

const SCREEN_2_SLUG = "screen-2";

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

export default async function InfoboardScreen2PreviewPage() {
  if (!previewAllowed()) {
    notFound();
  }

  const tenant = await resolveKioskTenant();

  if (!tenant?.timezone) {
    notFound();
  }

  const board = await getInfoboardBySlug(SCREEN_2_SLUG, tenant.id);

  if (
    !board ||
    board.status !== "ACTIVE" ||
    board.templateType !== "ANLAGENUEBERSICHT"
  ) {
    notFound();
  }

  /*
   * Load the REAL configured Anlageplan:
   *
   *   - persisted map zones
   *   - persisted background image
   *   - persisted background transform
   *   - current production component contract
   *
   * The resulting live occupancy is discarded below and replaced
   * only for this deterministic physical-TV preview.
   */
  const configuredPayload = await buildAnlageplanLivePayload({
    board,
    tenant: {
      id: tenant.id,
      key: tenant.key,
      name: tenant.name,
      timezone: tenant.timezone,
      logoUrl: tenant.logoUrl,
      infoboardDisplayTheme: tenant.infoboardDisplayTheme,
    },
    now: new Date(PREVIEW_CURRENT_TIME_ISO_S2),
    database: createPreviewDatabase(),
  });

  const payload = {
    ...configuredPayload,

    /*
     * Keep every production/configuration field from Screen 2,
     * replacing only the deterministic occupancy feed.
     */
    screen2: {
      ...configuredPayload.screen2,
      feed: PREVIEW_FIXTURE_SCREEN2_PHYSICAL_TV,
      currentTimeIso: PREVIEW_CURRENT_TIME_ISO_S2,
    },

    currentTimeIso: PREVIEW_CURRENT_TIME_ISO_S2,
  };

  return (
    <InfoboardAnlageplan
      payload={payload}
      weather={PREVIEW_WEATHER}
      branding={{
        clubLogoSrc:
          tenant.logoUrl ?? "/images/logos/fc-allschwil.png",
        productLogoSrc:
          "/images/branding/sportclubevo_logo.png",
        clubName: tenant.name ?? "FC ALLSCHWIL",
        facilityName: "SPORTANLAGE IM BRÜEL",
      }}
    />
  );
}