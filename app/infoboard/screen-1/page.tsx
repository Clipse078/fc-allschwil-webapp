/**
 * app/infoboard/screen-1/page.tsx
 *
 * Production Infoboard Screen 1 page.
 *
 * Route: /infoboard/screen-1
 * Production URL: https://fcallschwil.sportclubevo.com/infoboard/screen-1
 *
 * Architecture:
 *   - Server component (no "use client").
 *   - Resolves the active tenant from the database.
 *   - Creates one `now` value at request time and passes it through.
 *   - Calls buildScreen1LivePayload() directly — no HTTP fetch to own API.
 *   - Renders InfoboardScreen1 with live tenant data.
 *   - No preview fixture content is imported or used.
 *
 * Failure behaviour:
 *   - Tenant not found → notFound() (standard Next.js 404).
 *   - Tenant timezone not configured → notFound() (prevents RangeError).
 *   - Loader/service failure → error propagates to the nearest error boundary.
 *
 * Design constraints:
 *   - No "use client", no useEffect, no fetch.
 *   - No preview fixture imports.
 *   - No hardcoded tenant ID or domain.
 *   - Prisma used at this composition boundary only.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { DEFAULT_TENANT_KEY } from "@/lib/tenants/queries";
import { InfoboardScreen1 } from "@/components/infoboard/screen1/InfoboardScreen1";
import {
  createScreen1SourceLoader,
  type Screen1SourceDatabase,
  type Screen1DbEventRow,
  type Screen1FacilityResourceRow,
} from "@/lib/publishing/infoboard/screen1-source-loader";
import {
  buildScreen1LivePayload,
  type Screen1TenantContext,
} from "@/lib/publishing/infoboard/screen1-live-service";

export const metadata: Metadata = {
  title: "Infoboard — Screen 1",
};

// ── Prisma adapter ────────────────────────────────────────────────────────────

function createPrismaDb(): Screen1SourceDatabase {
  return {
    event: {
      findMany: (args) =>
        prisma.event.findMany(
          args as Parameters<typeof prisma.event.findMany>[0],
        ) as unknown as Promise<Screen1DbEventRow[]>,
    },
    facilityResource: {
      findMany: (args) =>
        prisma.facilityResource.findMany(
          args as Parameters<typeof prisma.facilityResource.findMany>[0],
        ) as unknown as Promise<Screen1FacilityResourceRow[]>,
    },
  };
}

// ── Page component ────────────────────────────────────────────────────────────

export default async function InfoboardScreen1Page() {
  // ── Resolve tenant ─────────────────────────────────────────────────────────
  // Uses the default tenant key for the single-tenant kiosk deployment.
  // Future: resolve from subdomain/custom domain once the domain→tenant
  // mapping table is introduced (see resolveTenantFromRequest TODO).
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
    // Timezone is required for temporal grouping. A misconfigured tenant
    // renders the board unusable; treat as not found rather than a 500.
    notFound();
  }

  const tenant: Screen1TenantContext = {
    id: tenantRow.id,
    key: tenantRow.key,
    name: tenantRow.name,
    timezone: tenantRow.timezone,
    logoUrl: tenantRow.logoUrl,
  };

  // ── Request time ───────────────────────────────────────────────────────────
  // Created once at the page render boundary.
  const now = new Date();

  // ── Build live payload ─────────────────────────────────────────────────────
  const db = createPrismaDb();
  const loader = createScreen1SourceLoader(db);
  const payload = await buildScreen1LivePayload({ tenant, now, loader });

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <InfoboardScreen1
      feed={payload.feed}
      branding={payload.branding}
      currentTimeIso={payload.currentTimeIso}
      announcement={payload.announcement ?? undefined}
      eventPresentation={payload.eventPresentation}
    />
  );
}
