/**
 * app/infoboard/[slug]/page.tsx
 *
 * Public Infoboard kiosk page — INFOBOARD-V2
 *
 * Route: /infoboard/[slug]
 *
 * Serves any tenant Infoboard by its stable kiosk URL slug.
 * The slug was set at creation time and never changes on rename.
 *
 * Tenant resolution (resolveKioskTenant):
 *   1. Subdomain of the Host request header
 *   2. KIOSK_DEFAULT_TENANT_KEY env var
 *   3. DEFAULT_TENANT_KEY platform constant (local/dev fallback)
 *
 * The same slug resolves correctly per tenant — lookups are always
 * scoped to (tenantId, slug). No cross-tenant leakage.
 *
 * Only ACTIVE boards are served. DRAFT and DISABLED → 404.
 *
 * INFOBOARD-MAP-01:
 *   Boards with templateType ANLAGENUEBERSICHT render InfoboardAnlageplan
 *   instead of InfoboardScreen1.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getInfoboardBySlug } from "@/lib/infoboard/queries";
import { resolveKioskTenant } from "@/lib/infoboard/kiosk-tenant";
import { buildBoardConfig } from "@/lib/infoboard/board-config";
import { InfoboardScreen1 } from "@/components/infoboard/screen1/InfoboardScreen1";
import { PhysicalInfoboardViewport } from "@/components/infoboard/shared/PhysicalInfoboardViewport";
import { InfoboardAnlageplan, type InfoboardAnlageplanShellConfig } from "@/components/infoboard/anlageplan/InfoboardAnlageplan";
import {
  createCanonicalInfoboardSourceLoader,
  type CanonicalInfoboardPolicyDatabase,
} from "@/lib/publishing/infoboard/canonical-source-loader";
import { buildScreen1KioskPresentation } from "@/lib/infoboard/screen1-kiosk-presentation";
import {
  buildAnlageplanLivePayload,
} from "@/lib/publishing/infoboard/anlageplan-live-service";
import type { Screen2TenantContext } from "@/lib/publishing/infoboard/screen2-live-service";
import { getCanonicalKioskWeather } from "@/lib/infoboard/kiosk-weather";
import { getCanonicalKioskTransport } from "@/lib/infoboard/kiosk-transport";
import { prisma } from "@/lib/db/prisma";

// ── FCA branding constants ─────────────────────────────────────────────────────

const FC_ALLSCHWIL_TENANT_KEY = "fc-allschwil";
const FC_ALLSCHWIL_LOGO_SRC = "/images/logos/fc-allschwil.png";
const PRODUCT_LOGO_SRC = "/images/branding/sportclubevo_logo.png";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Infoboard — ${slug}` };
}

function createPrismaDb(): CanonicalInfoboardPolicyDatabase & {
  facilityResource: {
    findMany: (args: {
      where: Record<string, unknown>;
      orderBy?: ReadonlyArray<Record<string, unknown>>;
      select: Record<string, unknown>;
    }) => Promise<ReadonlyArray<Record<string, unknown>>>;
  };
} {
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
        ) as unknown as ReturnType<CanonicalInfoboardPolicyDatabase["trainingSession"]["findMany"]>,
    },
    facilityResource: {
      findMany: (args) =>
        prisma.facilityResource.findMany(
          args as Parameters<typeof prisma.facilityResource.findMany>[0],
        ) as unknown as Promise<ReadonlyArray<Record<string, unknown>>>,
    },
  };
}

export default async function InfoboardSlugPage({ params }: PageProps) {
  const { slug } = await params;

  // Resolve tenant from request hostname → env var → platform default.
  const tenantRow = await resolveKioskTenant();
  if (!tenantRow || !tenantRow.timezone) {
    notFound();
  }

  // Resolve board strictly by (tenantId, slug) — no cross-tenant leakage.
  const board = await getInfoboardBySlug(slug, tenantRow.id);

  // Only ACTIVE boards are publicly accessible.
  if (!board || board.status !== "ACTIVE") {
    notFound();
  }

  const now = new Date();
  const db = createPrismaDb();
  const weather = await getCanonicalKioskWeather();

  // ── ANLAGENUEBERSICHT branch ───────────────────────────────────────────────
  if (board.templateType === "ANLAGENUEBERSICHT") {
    const anlageplanTenant: Screen2TenantContext = {
      id: tenantRow.id,
      key: tenantRow.key,
      name: tenantRow.name,
      timezone: tenantRow.timezone,
      logoUrl: tenantRow.logoUrl,
      infoboardDisplayTheme: tenantRow.infoboardDisplayTheme,
    };

    const payload = await buildAnlageplanLivePayload({
      board,
      tenant: anlageplanTenant,
      now,
      database: db as unknown as import("@/lib/publishing/infoboard/anlageplan-live-service").AnlageplanSourceDatabase,
    });

    const clubLogoSrc = tenantRow.logoUrl
      ? tenantRow.logoUrl
      : tenantRow.key === FC_ALLSCHWIL_TENANT_KEY
        ? FC_ALLSCHWIL_LOGO_SRC
        : null;

    const boardConfig = buildBoardConfig(board);
    const shellConfig: InfoboardAnlageplanShellConfig = {
      subtitleEnabled: boardConfig.headerSubtitleEnabled,
      subtitleText: boardConfig.headerSubtitleText,
      showTime: boardConfig.headerShowTime,
      showDate: boardConfig.headerShowDate,
      showWeather: boardConfig.headerShowWeather,
      announcement: boardConfig.announcement
        ? {
            enabled: boardConfig.announcement.enabled,
            text: boardConfig.announcement.text,
            backgroundColor: boardConfig.announcement.backgroundColor,
            textColor: boardConfig.announcement.textColor,
          }
        : null,
    };

    const transport = await getCanonicalKioskTransport(tenantRow.key);

    return (
      <PhysicalInfoboardViewport>
        <InfoboardAnlageplan
          payload={payload}
          weather={weather}
          shellConfig={shellConfig}
          tenantKey={tenantRow.key}
          transport={transport}
          branding={{
            clubLogoSrc,
            productLogoSrc: PRODUCT_LOGO_SRC,
            clubName: tenantRow.key === FC_ALLSCHWIL_TENANT_KEY ? "FC ALLSCHWIL" : tenantRow.name,
            facilityName:
              tenantRow.key === FC_ALLSCHWIL_TENANT_KEY
                ? "SPORTANLAGE IM BRÜEL"
                : undefined,
          }}
        />
      </PhysicalInfoboardViewport>
    );
  }

  // ── TAGESUEBERSICHT branch (default) ──────────────────────────────────────
  const tenant: import("@/lib/publishing/infoboard/screen1-live-service").Screen1TenantContext = {
    id: tenantRow.id,
    key: tenantRow.key,
    name: tenantRow.name,
    timezone: tenantRow.timezone,
    logoUrl: tenantRow.logoUrl,
    infoboardDisplayTheme: tenantRow.infoboardDisplayTheme,
  };

  const loader = createCanonicalInfoboardSourceLoader(db);
  const presentation = await buildScreen1KioskPresentation({
    tenant,
    now,
    loader,
    board,
    weather,
  });

  return (
    <PhysicalInfoboardViewport>
      <InfoboardScreen1 {...presentation.infoboardScreen1Props} />
    </PhysicalInfoboardViewport>
  );
}
