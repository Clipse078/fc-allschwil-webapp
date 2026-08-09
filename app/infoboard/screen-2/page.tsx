/**
 * app/infoboard/screen-2/page.tsx
 *
 * Production Infoboard Screen 2 page.
 *
 * Route: /infoboard/screen-2
 *
 * Architecture:
 *   - Server component (no "use client").
 *   - Resolves the active tenant from the database.
 *   - Creates one `now` value at request time.
 *   - Calls buildScreen2LivePayload() for facility/pitch data.
 *   - Calls fetchCurrentWeather() for live weather — server-side only,
 *     cached by Next.js fetch cache (15-minute revalidation).
 *   - Renders InfoboardScreen2 with live data.
 *   - No preview fixture content is imported or used.
 *
 * Live data sources:
 *   - Tenant resolved from DB by DEFAULT_TENANT_KEY.
 *   - Pitches: all active FULL_PITCH / HALF_PITCH facility resources for tenant.
 *   - Events: eligible events per INFOBOARD_SCREEN_2 publication policy.
 *   - Weather: MeteoSwiss Open Data (SwissMetNet VQHA80, station BAS
 *     Basel/Binningen, ≈3.8 km) for Sportanlage Im Brüel, Allschwil
 *     (server-side, no API key required, 10-minute cache).
 *   - Sponsors: no canonical sponsor source exists; empty array used.
 *
 * Failure behaviour:
 *   - Tenant not found → notFound() (404).
 *   - Tenant timezone not configured → notFound().
 *   - Weather unavailable → renders "WETTER NICHT VERFÜGBAR" fallback;
 *     facility data and sponsors remain visible.
 *   - Loader/service failure → error propagates to nearest error boundary.
 *
 * Screen 2 does NOT render:
 *   - Dressing-room / cabin assignments (Screen 1 only).
 *   - Next Events panel.
 *
 * Design constraints:
 *   - No "use client", no useEffect, no browser fetch.
 *   - No preview fixture imports.
 *   - No hardcoded tenant ID or domain.
 *   - Prisma used at this composition boundary only.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { DEFAULT_TENANT_KEY } from "@/lib/tenants/queries";
import { InfoboardScreen2 } from "@/components/infoboard/screen2/InfoboardScreen2";
import {
  buildScreen2LivePayload,
  type Screen2SourceDatabase,
  type Screen2PitchRow,
} from "@/lib/publishing/infoboard/screen2-live-service";
import type { Screen2TenantContext } from "@/lib/publishing/infoboard/screen2-live-service";
import type { CanonicalInfoboardPolicyDatabase } from "@/lib/publishing/infoboard/canonical-source-loader";
import { fetchCurrentWeather } from "@/lib/weather/weather-service";

export const metadata: Metadata = {
  title: "Infoboard — Screen 2",
};

// ── Prisma adapter ────────────────────────────────────────────────────────────

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
  const tenantRow = await prisma.tenant.findFirst({
    where: { key: DEFAULT_TENANT_KEY, status: "ACTIVE" },
    select: {
      id: true,
      key: true,
      name: true,
      timezone: true,
      logoUrl: true,
    },
  });

  if (!tenantRow) {
    notFound();
  }

  if (!tenantRow.timezone) {
    notFound();
  }

  const tenant: Screen2TenantContext = {
    id: tenantRow.id,
    key: tenantRow.key,
    name: tenantRow.name,
    timezone: tenantRow.timezone,
    logoUrl: tenantRow.logoUrl,
  };

  // ── Request time ───────────────────────────────────────────────────────────
  const now = new Date();

  // ── Build live facility payload ────────────────────────────────────────────
  const database = createPrismaScreen2Db();
  const payload = await buildScreen2LivePayload({ tenant, now, database });

  // ── Fetch live weather (server-side, cached 15 min) ────────────────────────
  // Failure returns WEATHER_UNAVAILABLE; the component renders a safe fallback.
  // No production weather is hardcoded or substituted on failure.
  const weather = await fetchCurrentWeather();

  // ── Render ─────────────────────────────────────────────────────────────────
  // Sponsors: no canonical sponsor source exists in this slice.
  // The sponsor section renders with an empty array (no fake data).
  return (
    <InfoboardScreen2
      feed={payload.feed}
      branding={payload.branding}
      currentTimeIso={payload.currentTimeIso}
      weather={weather}
      sponsors={[]}
    />
  );
}
