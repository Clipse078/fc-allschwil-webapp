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
 * Tenant resolution:
 *   - Uses DEFAULT_TENANT_KEY (fc-allschwil) for single-tenant deployment.
 *   - Future: resolve from subdomain/custom domain mapping.
 *
 * Architecture:
 *   - Server component. No "use client", no effects, no fetch.
 *   - Loads Infoboard row by slug + tenantId.
 *   - Applies per-board config (theme, announcement, header settings).
 *   - Renders InfoboardScreen1 for TAGESUEBERSICHT template.
 *   - Disabled boards return notFound().
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { DEFAULT_TENANT_KEY } from "@/lib/tenants/queries";
import { getInfoboardBySlug } from "@/lib/infoboard/queries";
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

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Infoboard — ${slug}`,
  };
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

  // Resolve tenant
  const tenantRow = await prisma.tenant.findFirst({
    where: { key: DEFAULT_TENANT_KEY, status: "ACTIVE" },
    select: {
      id: true,
      key: true,
      name: true,
      timezone: true,
      logoUrl: true,
      infoboardDisplayTheme: true,
    },
  });

  if (!tenantRow || !tenantRow.timezone) {
    notFound();
  }

  // Load the specific Infoboard by slug
  const board = await getInfoboardBySlug(slug, tenantRow.id);

  // DISABLED boards are not publicly accessible
  if (!board || board.status === "DISABLED") {
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
