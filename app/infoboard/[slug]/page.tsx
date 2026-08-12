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
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
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
import { prisma } from "@/lib/db/prisma";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Infoboard — ${slug}` };
}

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

export default async function InfoboardSlugPage({ params }: PageProps) {
  const { slug } = await params;

  // Resolve tenant from request hostname → env var → platform default.
  // Returns null for unknown/inactive tenants.
  const tenantRow = await resolveKioskTenant();
  if (!tenantRow || !tenantRow.timezone) {
    notFound();
  }

  // Resolve board strictly by (tenantId, slug) — no cross-tenant leakage.
  const board = await getInfoboardBySlug(slug, tenantRow.id);

  // Only ACTIVE boards are publicly accessible.
  // DISABLED and DRAFT → 404 (no kiosk should display work-in-progress).
  if (!board || board.status !== "ACTIVE") {
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

  const now = new Date();
  const db = createPrismaDb();
  const loader = createCanonicalInfoboardSourceLoader(db);
  const boardConfig = buildBoardConfig(board);

  const payload = await buildScreen1LivePayload({
    tenant,
    now,
    loader,
    boardConfig,
  });

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
