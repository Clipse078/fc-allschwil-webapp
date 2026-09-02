/**
 * lib/infoboard/kiosk-transport.ts
 *
 * Canonical kiosk transport resolution for Infoboard Screen 2.
 *
 * Server-side cache aligned with provider rate limits (~45 s).
 */

import { unstable_cache } from "next/cache";
import { resolveTenantTransportConfig } from "@/lib/transport/transport-config";
import { fetchTransportForConfig } from "@/lib/transport/transport-service";
import type { TransportResult } from "@/lib/transport/transport-types";

export const CANONICAL_KIOSK_TRANSPORT_CACHE_TAG = "infoboard-canonical-kiosk-transport";

export const DEFAULT_KIOSK_TRANSPORT_REVALIDATE_SECONDS = 45;

function cacheTagForTenant(tenantKey: string): string {
  return `${CANONICAL_KIOSK_TRANSPORT_CACHE_TAG}:${tenantKey}`;
}

function getCachedTransportForTenant(tenantKey: string) {
  const config = resolveTenantTransportConfig(tenantKey);
  const revalidateSeconds =
    config?.refreshIntervalSeconds ?? DEFAULT_KIOSK_TRANSPORT_REVALIDATE_SECONDS;

  return unstable_cache(
    async (): Promise<TransportResult | null> => {
      if (!config) {
        return null;
      }
      return fetchTransportForConfig(config);
    },
    ["infoboard-canonical-kiosk-transport", tenantKey],
    {
      revalidate: revalidateSeconds,
      tags: [cacheTagForTenant(tenantKey)],
    },
  );
}

/**
 * Returns normalized transport departures for a tenant when configured.
 */
export async function getCanonicalKioskTransport(
  tenantKey: string,
): Promise<TransportResult | null> {
  const config = resolveTenantTransportConfig(tenantKey);
  if (!config) {
    return null;
  }

  return getCachedTransportForTenant(tenantKey)();
}

export function getKioskTransportRefreshSeconds(tenantKey: string): number {
  const config = resolveTenantTransportConfig(tenantKey);
  return config?.refreshIntervalSeconds ?? DEFAULT_KIOSK_TRANSPORT_REVALIDATE_SECONDS;
}
