/**
 * lib/website/config-queries.ts
 *
 * Database queries for WebsiteConfig — per-tenant website settings.
 */

import { prisma } from "@/lib/db/prisma";

const configSelect = {
  websiteTitle: true,
  websiteDescription: true,
  heroTagline: true,
  contactEmail: true,
  contactPhone: true,
  addressStreet: true,
  addressCity: true,
  addressCountry: true,
  googleMapsUrl: true,
  facebookUrl: true,
  instagramUrl: true,
  youtubeUrl: true,
  twitterUrl: true,
  tiktokUrl: true,
} as const;

export type WebsiteConfigData = {
  websiteTitle: string | null;
  websiteDescription: string | null;
  heroTagline: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  addressStreet: string | null;
  addressCity: string | null;
  addressCountry: string | null;
  googleMapsUrl: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  youtubeUrl: string | null;
  twitterUrl: string | null;
  tiktokUrl: string | null;
};

export async function getWebsiteConfig(tenantId: string): Promise<WebsiteConfigData | null> {
  return prisma.websiteConfig.findUnique({
    where: { tenantId },
    select: configSelect,
  });
}

export async function upsertWebsiteConfig(
  tenantId: string,
  data: Partial<WebsiteConfigData>,
): Promise<WebsiteConfigData> {
  return prisma.websiteConfig.upsert({
    where: { tenantId },
    update: data,
    create: {
      tenantId,
      websiteTitle: data.websiteTitle ?? null,
      websiteDescription: data.websiteDescription ?? null,
      heroTagline: data.heroTagline ?? null,
      contactEmail: data.contactEmail ?? null,
      contactPhone: data.contactPhone ?? null,
      addressStreet: data.addressStreet ?? null,
      addressCity: data.addressCity ?? null,
      addressCountry: data.addressCountry ?? null,
      googleMapsUrl: data.googleMapsUrl ?? null,
      facebookUrl: data.facebookUrl ?? null,
      instagramUrl: data.instagramUrl ?? null,
      youtubeUrl: data.youtubeUrl ?? null,
      twitterUrl: data.twitterUrl ?? null,
      tiktokUrl: data.tiktokUrl ?? null,
    },
    select: configSelect,
  });
}
