/**
 * lib/website/public-cache-notification.ts
 *
 * SCE-CANONICAL-PUBLISHING-01 — fire-and-forget notification to external tenant
 * websites when canonical SCE public data changes.
 *
 * Configuration (no DB migration — env JSON per deployment):
 *   PUBLIC_WEBSITE_REVALIDATION_CONFIG={"fc-allschwil":{"url":"https://.../api/revalidate","secret":"..."}}
 *
 * Failure to notify NEVER rolls back the canonical SCE mutation.
 * Bounded ISR TTL on tenant websites remains the resilience fallback.
 */

import { createHmac } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import {
  buildPublicCacheTags,
  isPublicCacheDomain,
  type PublicCacheDomain,
} from "./public-cache-tags";

const NOTIFICATION_TIMEOUT_MS = 5000;

export type TenantRevalidationEndpoint = {
  url: string;
  secret: string;
};

export type PublicCacheNotificationInput = {
  tenantSlug: string;
  domains: readonly PublicCacheDomain[];
  /** Optional extra tags (already fully formed) for fine-grained invalidation. */
  extraTags?: readonly string[];
};

type RevalidationConfig = Record<string, TenantRevalidationEndpoint>;

function parseRevalidationConfig(): RevalidationConfig {
  const raw = process.env.PUBLIC_WEBSITE_REVALIDATION_CONFIG?.trim();
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as Record<string, { url?: string; secret?: string }>;
    const config: RevalidationConfig = {};

    for (const [tenantSlug, entry] of Object.entries(parsed)) {
      const url = entry?.url?.trim();
      const secret = entry?.secret?.trim();
      if (url && secret) {
        config[tenantSlug] = { url, secret };
      }
    }

    return config;
  } catch {
    console.error(
      "[public-cache-notification] Invalid PUBLIC_WEBSITE_REVALIDATION_CONFIG JSON",
    );
    return {};
  }
}

let cachedConfig: RevalidationConfig | null = null;

function getRevalidationConfig(): RevalidationConfig {
  if (!cachedConfig) {
    cachedConfig = parseRevalidationConfig();
  }
  return cachedConfig;
}

/** Test helper — resets cached env parse between test cases. */
export function resetPublicCacheNotificationConfigForTests(): void {
  cachedConfig = null;
}

function buildSignature(secret: string, body: string): string {
  const digest = createHmac("sha256", secret).update(body, "utf8").digest("hex");
  return `sha256=${digest}`;
}

function buildNotificationBody(input: PublicCacheNotificationInput): {
  tenant: string;
  domains: PublicCacheDomain[];
  tags: string[];
} {
  const tenant = input.tenantSlug.trim();
  const domains = [...new Set(input.domains)];
  const tags = [
    ...buildPublicCacheTags(tenant, domains),
    ...(input.extraTags ?? []).map((tag) => tag.trim()).filter(Boolean),
  ];

  return {
    tenant,
    domains,
    tags: [...new Set(tags)],
  };
}

/**
 * Returns configured endpoint for a tenant slug, if any.
 */
export function getTenantRevalidationEndpoint(tenantSlug: string): TenantRevalidationEndpoint | null {
  const config = getRevalidationConfig();
  return config[tenantSlug.trim()] ?? null;
}

/**
 * Sends a signed revalidation request to the tenant website endpoint.
 * Never throws — logs failures only.
 */
export async function notifyTenantPublicWebsiteCache(
  input: PublicCacheNotificationInput,
): Promise<void> {
  const endpoint = getTenantRevalidationEndpoint(input.tenantSlug);
  if (!endpoint) return;

  const bodyPayload = buildNotificationBody(input);
  const body = JSON.stringify(bodyPayload);
  const signature = buildSignature(endpoint.secret, body);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NOTIFICATION_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-SCE-Revalidation-Signature": signature,
      },
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(
        `[public-cache-notification] Revalidation failed for ${input.tenantSlug}: HTTP ${response.status}`,
      );
    }
  } catch (error) {
    console.warn(
      `[public-cache-notification] Revalidation request failed for ${input.tenantSlug}:`,
      error,
    );
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fire-and-forget wrapper — safe to call from mutation handlers.
 */
export function scheduleTenantPublicWebsiteCacheNotification(
  input: PublicCacheNotificationInput,
): void {
  void notifyTenantPublicWebsiteCache(input);
}

/**
 * Resolves tenant slug from tenantId and schedules notification.
 */
export async function scheduleTenantPublicWebsiteCacheNotificationByTenantId(
  tenantId: string,
  domains: readonly PublicCacheDomain[],
  extraTags?: readonly string[],
): Promise<void> {
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId },
    select: { key: true },
  });

  if (!tenant?.key) return;

  scheduleTenantPublicWebsiteCacheNotification({
    tenantSlug: tenant.key,
    domains,
    extraTags,
  });
}

/**
 * Parses domain strings from mutation callers — ignores unknown values.
 */
export function normalizePublicCacheDomains(
  domains: readonly string[],
): PublicCacheDomain[] {
  return domains.filter(isPublicCacheDomain);
}
