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
 *   - Tenant resolved via resolveKioskTenant() (hostname → env → default).
 *   - Prisma used at this boundary only for the canonical event loader adapter.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getInfoboardBySlug } from "@/lib/infoboard/queries";
import { resolveKioskTenant } from "@/lib/infoboard/kiosk-tenant";
import { buildBoardConfig } from "@/lib/infoboard/board-config";
import { InfoboardScreen1 } from "@/components/infoboard/screen1/InfoboardScreen1";
import {
  createCanonicalInfoboardSourceLoader,
  type CanonicalInfoboardPolicyDatabase,
} from "@/lib/publishing/infoboard/canonical-source-loader";
import {
  buildScreen1LivePayload,
  type Screen1TenantContext,
} from "@/lib/publishing/infoboard/screen1-live-service";

export const metadata: Metadata = {
  title: "Infoboard — Screen 1",
};

// ── Prisma adapter ────────────────────────────────────────────────────────────

function createPrismaDb(): CanonicalInfoboardPolicyDatabase {
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
  };
}

// ── Page component ────────────────────────────────────────────────────────────

export default async function InfoboardScreen1Page() {
  // ── Resolve tenant ─────────────────────────────────────────────────────────
  // Resolves from request hostname → KIOSK_DEFAULT_TENANT_KEY → DEFAULT_TENANT_KEY.
  const tenantRow = await resolveKioskTenant();

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
    infoboardDisplayTheme: tenantRow.infoboardDisplayTheme,
  };

  // ── Request time ───────────────────────────────────────────────────────────
  // Created once at the page render boundary.
  const now = new Date();

  // ── Build live payload ─────────────────────────────────────────────────────
  // Load per-board config from DB (slug "screen-1") when available.
  const board = await getInfoboardBySlug("screen-1", tenant.id);
  const boardConfig = board ? buildBoardConfig(board) : null;

  const db = createPrismaDb();
  const loader = createCanonicalInfoboardSourceLoader(db);
  const payload = await buildScreen1LivePayload({ tenant, now, loader, boardConfig });

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <InfoboardScreen1
      feed={payload.feed}
      branding={payload.branding}
      currentTimeIso={payload.currentTimeIso}
      announcement={payload.announcement ?? undefined}
      eventPresentation={payload.eventPresentation}
      theme={payload.theme}
      headerConfig={payload.headerConfig ?? undefined}
    />
  );
}
