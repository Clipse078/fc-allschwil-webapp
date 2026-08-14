/**
 * app/infoboard/screen-2/page.tsx
 *
 * Production Infoboard Screen 2 page.
 *
 * Route: /infoboard/screen-2
 *
 * INFOBOARD-MAP-01C: This static route must respect the stored templateType
 * of the Infoboard record whose slug is "screen-2". If that board is
 * configured as ANLAGENUEBERSICHT it renders InfoboardAnlageplan; for all
 * other cases it falls back to the legacy InfoboardScreen2 renderer.
 *
 * Root-cause fix: this static route previously shadowed the dynamic
 * /infoboard/[slug] route, so visiting /infoboard/screen-2 always rendered
 * the legacy Screen-2 Feldbelegung grid regardless of the board's
 * templateType. Now it performs the same slug-based templateType check.
 *
 * Architecture:
 *   - Server component (no "use client").
 *   - Resolves the active tenant from the database.
 *   - Looks up the Infoboard by slug "screen-2" (ACTIVE boards only).
 *   - If templateType === ANLAGENUEBERSICHT → InfoboardAnlageplan.
 *   - Otherwise → legacy InfoboardScreen2 (preserves existing kiosk behaviour).
 *   - Creates one `now` value at request time.
 *
 * Live data sources:
 *   - Tenant resolved from DB by DEFAULT_TENANT_KEY.
 *   - Pitches: all active FULL_PITCH / HALF_PITCH facility resources for tenant.
 *   - Events: eligible events per INFOBOARD_SCREEN_2 publication policy.
 *   - Weather: MeteoSwiss Open Data (server-side, no API key required,
 *     10-minute cache). Screen2 only — Anlageplan does not show weather.
 *
 * Failure behaviour:
 *   - Tenant not found → notFound() (404).
 *   - Tenant timezone not configured → notFound().
 *   - No ACTIVE board with slug "screen-2" → falls back to legacy renderer.
 *   - Weather unavailable (Screen2 path only) → safe fallback.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { DEFAULT_TENANT_KEY } from "@/lib/tenants/queries";
import { getInfoboardBySlug } from "@/lib/infoboard/queries";
import { resolveKioskTenant } from "@/lib/infoboard/kiosk-tenant";
import { InfoboardScreen2 } from "@/components/infoboard/screen2/InfoboardScreen2";
import { InfoboardAnlageplan } from "@/components/infoboard/anlageplan/InfoboardAnlageplan";
import {
  buildScreen2LivePayload,
  type Screen2SourceDatabase,
  type Screen2PitchRow,
} from "@/lib/publishing/infoboard/screen2-live-service";
import type { Screen2TenantContext } from "@/lib/publishing/infoboard/screen2-live-service";
import {
  buildAnlageplanLivePayload,
} from "@/lib/publishing/infoboard/anlageplan-live-service";
import type { CanonicalInfoboardPolicyDatabase } from "@/lib/publishing/infoboard/canonical-source-loader";
import { fetchCurrentWeather } from "@/lib/weather/weather-service";

export const metadata: Metadata = {
  title: "Infoboard — Screen 2",
};

// ── FCA branding constants ─────────────────────────────────────────────────────

const FC_ALLSCHWIL_TENANT_KEY = "fc-allschwil";
const FC_ALLSCHWIL_LOGO_SRC = "/images/logos/fc-allschwil.png";
const PRODUCT_LOGO_SRC = "/images/branding/sportclubevo_logo.png";

const SCREEN_2_SLUG = "screen-2";

// ── Prisma adapters ────────────────────────────────────────────────────────────

function createPrismaScreen2Db(): Screen2SourceDatabase {
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
        ) as unknown as Promise<Screen2PitchRow[]>,
    },
  };
}

// ── Page component ────────────────────────────────────────────────────────────

export default async function InfoboardScreen2Page() {
  // ── Resolve tenant ─────────────────────────────────────────────────────────
  // Use resolveKioskTenant (hostname-aware) consistent with [slug]/page.tsx.
  // Fall back to DEFAULT_TENANT_KEY lookup for the legacy direct DB path.
  const tenantRow = await resolveKioskTenant();

  if (!tenantRow) {
    notFound();
  }

  if (!tenantRow.timezone) {
    notFound();
  }

  // ── Request time ───────────────────────────────────────────────────────────
  const now = new Date();

  const database = createPrismaScreen2Db();

  const tenant: Screen2TenantContext = {
    id: tenantRow.id,
    key: tenantRow.key,
    name: tenantRow.name,
    timezone: tenantRow.timezone,
    logoUrl: tenantRow.logoUrl,
    infoboardDisplayTheme: tenantRow.infoboardDisplayTheme,
  };

  // ── Look up the board by slug to honour its templateType ──────────────────
  // Only ACTIVE boards are served. DRAFT / DISABLED fall through to legacy.
  const board = await getInfoboardBySlug(SCREEN_2_SLUG, tenantRow.id);

  // ── ANLAGENUEBERSICHT branch ───────────────────────────────────────────────
  if (board?.status === "ACTIVE" && board.templateType === "ANLAGENUEBERSICHT") {
    const payload = await buildAnlageplanLivePayload({
      board,
      tenant,
      now,
      database: database as unknown as import("@/lib/publishing/infoboard/anlageplan-live-service").AnlageplanSourceDatabase,
    });

    const clubLogoSrc = tenantRow.logoUrl
      ? tenantRow.logoUrl
      : tenantRow.key === FC_ALLSCHWIL_TENANT_KEY
        ? FC_ALLSCHWIL_LOGO_SRC
        : null;

    return (
      <InfoboardAnlageplan
        payload={payload}
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
    );
  }

  // ── Legacy Screen2 / TAGESUEBERSICHT branch ────────────────────────────────
  // Used when:
  //   - No ACTIVE board with slug "screen-2" exists, OR
  //   - The board's templateType is not ANLAGENUEBERSICHT.
  const payload = await buildScreen2LivePayload({ tenant, now, database });

  const weather = await fetchCurrentWeather();

  return (
    <InfoboardScreen2
      feed={payload.feed}
      branding={payload.branding}
      currentTimeIso={payload.currentTimeIso}
      weather={weather}
      theme={payload.theme}
    />
  );
}
