import { prisma } from "@/lib/db/prisma";
import { buildBoardConfig } from "@/lib/infoboard/board-config";
import { getInfoboardBySlug } from "@/lib/infoboard/queries";
import type { InfoboardAnlageplanShellConfig } from "@/components/infoboard/anlageplan/InfoboardAnlageplan";
import {
  createCanonicalInfoboardSourceLoader,
  type CanonicalInfoboardPolicyDatabase,
} from "@/lib/publishing/infoboard/canonical-source-loader";
import {
  buildScreen1KioskPresentation,
} from "@/lib/infoboard/screen1-kiosk-presentation";
import type { Screen1TenantContext } from "@/lib/publishing/infoboard/screen1-live-service";
import {
  createScreen1TournamentPresentationDatabase,
  resolveScreen1OrganizerClubsByName,
} from "@/lib/infoboard/screen1-tournament-composition";
import {
  buildScreen2LivePayload,
  type Screen2PitchRow,
  type Screen2SourceDatabase,
  type Screen2TenantContext,
} from "@/lib/publishing/infoboard/screen2-live-service";
import { buildAnlageplanLivePayload } from "@/lib/publishing/infoboard/anlageplan-live-service";
import { getCanonicalKioskWeather } from "@/lib/infoboard/kiosk-weather";

const FC_ALLSCHWIL_TENANT_KEY = "fc-allschwil";
const FC_ALLSCHWIL_LOGO_SRC = "/images/logos/fc-allschwil.png";
const PRODUCT_LOGO_SRC = "/images/branding/sportclubevo_logo.png";

export type PreviewTenant = {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly timezone: string;
  readonly logoUrl?: string | null;
  readonly infoboardDisplayTheme?: string | null;
};

function createPreviewDatabase(): Screen2SourceDatabase {
  return {
    event: {
      findMany: (args) =>
        prisma.event.findMany(
          args as Parameters<typeof prisma.event.findMany>[0],
        ) as unknown as ReturnType<CanonicalInfoboardPolicyDatabase["event"]["findMany"]>,
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
        ) as unknown as Promise<Screen2PitchRow[]>,
    },
  };
}

export async function buildScreen1PreviewData(tenant: PreviewTenant, now: Date) {
  const database = createPreviewDatabase();
  const board = await getInfoboardBySlug("screen-1", tenant.id);
  const presentation = await buildScreen1KioskPresentation({
    tenant: tenant as Screen1TenantContext,
    now,
    loader: createCanonicalInfoboardSourceLoader(database),
    board,
    tournamentPresentationDatabase: createScreen1TournamentPresentationDatabase(),
    resolveOrganizerClubsByName: (organizerNames) =>
      resolveScreen1OrganizerClubsByName(tenant.id, organizerNames),
  });
  return {
    payload: presentation.payload,
    weather: presentation.weather,
    infoboardScreen1Props: presentation.infoboardScreen1Props,
  };
}

export async function buildScreen2PreviewData(tenant: PreviewTenant, now: Date) {
  const database = createPreviewDatabase();
  const board = await getInfoboardBySlug("screen-2", tenant.id);
  const screen2Tenant = tenant as Screen2TenantContext;
  const weather = await getCanonicalKioskWeather();

  if (board?.status === "ACTIVE" && board.templateType === "ANLAGENUEBERSICHT") {
    const payload = await buildAnlageplanLivePayload({
      board,
      tenant: screen2Tenant,
      now,
      database,
    });
    const boardConfig = buildBoardConfig(board);
    const shellConfig: InfoboardAnlageplanShellConfig = {
      subtitleEnabled: boardConfig.headerSubtitleEnabled,
      subtitleText: boardConfig.headerSubtitleText,
      showTime: boardConfig.headerShowTime,
      showDate: boardConfig.headerShowDate,
      showWeather: boardConfig.headerShowWeather,
      announcement: boardConfig.announcement,
    };
    return {
      renderer: "anlageplan" as const,
      payload,
      weather,
      shellConfig,
      branding: {
        clubLogoSrc:
          tenant.logoUrl ??
          (tenant.key === FC_ALLSCHWIL_TENANT_KEY ? FC_ALLSCHWIL_LOGO_SRC : null),
        productLogoSrc: PRODUCT_LOGO_SRC,
        clubName:
          tenant.key === FC_ALLSCHWIL_TENANT_KEY ? "FC ALLSCHWIL" : tenant.name,
        facilityName:
          tenant.key === FC_ALLSCHWIL_TENANT_KEY
            ? "SPORTANLAGE IM BRÜEL"
            : undefined,
      },
    };
  }

  return {
    renderer: "screen2" as const,
    payload: await buildScreen2LivePayload({
      tenant: screen2Tenant,
      now,
      database,
    }),
    weather,
  };
}
