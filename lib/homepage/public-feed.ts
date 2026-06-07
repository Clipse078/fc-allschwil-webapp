/**
 * Homepage Blocks V1 — Public feed query.
 *
 * Only returns PUBLISHED, enabled blocks for the HOMEPAGE context.
 * No internal fields (tenantId, reviewNotes, status) are included.
 */

import { prisma } from "@/lib/db/prisma";
import type { AnyBlockConfig, PublicBlockItem, WebsiteBlockType } from "./types";

export async function getPublicHomepageBlocks(tenantId: string): Promise<PublicBlockItem[]> {
  const rows = await prisma.websiteBlockInstance.findMany({
    where: {
      tenantId,
      pageContext: "HOMEPAGE",
      enabled: true,
      block: {
        status: "PUBLISHED",
        publishedAt: { not: null },
      },
    },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      sortOrder: true,
      block: {
        select: {
          id: true,
          type: true,
          config: true,
        },
      },
    },
  });

  return rows.map((r) => ({
    id: r.block.id,
    type: r.block.type as WebsiteBlockType,
    sortOrder: r.sortOrder,
    config: (r.block.config ?? {}) as AnyBlockConfig,
  }));
}
