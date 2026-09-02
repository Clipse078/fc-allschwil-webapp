/**
 * lib/transport/transport-service.ts
 *
 * Provider-neutral transport orchestration for Infoboard Screen 2.
 */

import { resolveTenantTransportConfig, type TransportStopConfig } from "./transport-config";
import { fetchOpendataChStationboard } from "./providers/opendata-ch-transport-provider";
import type { TransportDeparture, TransportResult, TransportUnavailableResult } from "./transport-types";

type TransportCacheEntry = {
  result: TransportResult;
};

const inMemoryTransportCache = new Map<string, TransportCacheEntry>();

function cacheKeyForConfig(config: TransportStopConfig): string {
  return `${config.provider}:${config.stopId}`;
}

function readCachedDepartures(
  config: TransportStopConfig,
): TransportDeparture[] | undefined {
  const cached = inMemoryTransportCache.get(cacheKeyForConfig(config));
  if (!cached) {
    return undefined;
  }

  if (cached.result.isAvailable) {
    return cached.result.departures;
  }

  return cached.result.cachedDepartures;
}

function storeCache(config: TransportStopConfig, result: TransportResult): void {
  inMemoryTransportCache.set(cacheKeyForConfig(config), { result });
}

function unavailableResult(
  config: TransportStopConfig,
  errorCode: TransportUnavailableResult["errorCode"],
  fetchedAt: string,
  cachedDepartures?: TransportDeparture[],
): TransportUnavailableResult {
  return {
    isAvailable: false,
    stationDisplayName: config.stationDisplayName,
    errorCode,
    fetchedAt,
    ...(cachedDepartures && cachedDepartures.length > 0
      ? { cachedDepartures }
      : {}),
  };
}

export async function fetchTransportForConfig(
  config: TransportStopConfig,
  fetchFn: typeof fetch = fetch,
  now: Date = new Date(),
): Promise<TransportResult> {
  const fetchedAt = now.toISOString();

  if (!config.enabled) {
    return unavailableResult(config, "disabled", fetchedAt);
  }

  if (config.provider !== "opendata.ch") {
    return unavailableResult(config, "not_configured", fetchedAt);
  }

  const providerResult = await fetchOpendataChStationboard(config, fetchFn, now);

  if (!providerResult.ok) {
    const cachedDepartures = readCachedDepartures(config);
    if (cachedDepartures && cachedDepartures.length > 0) {
      const staleResult: TransportResult = {
        isAvailable: true,
        stationDisplayName: config.stationDisplayName,
        stationId: config.stopId,
        departures: cachedDepartures,
        fetchedAt,
        isStale: true,
        hasRealtimeData: cachedDepartures.some((departure) => departure.hasRealtime),
      };
      storeCache(config, staleResult);
      return staleResult;
    }

    const unavailable = unavailableResult(
      config,
      providerResult.errorCode,
      fetchedAt,
      cachedDepartures,
    );
    storeCache(config, unavailable);
    return unavailable;
  }

  const result: TransportResult = {
    isAvailable: true,
    stationDisplayName: config.stationDisplayName,
    stationId: providerResult.stationId,
    departures: providerResult.departures,
    fetchedAt,
    isStale: false,
    hasRealtimeData: providerResult.hasRealtimeData,
  };

  storeCache(config, result);
  return result;
}

export async function fetchTransportForTenant(
  tenantKey: string,
  fetchFn: typeof fetch = fetch,
  now: Date = new Date(),
): Promise<TransportResult | null> {
  const config = resolveTenantTransportConfig(tenantKey);
  if (!config) {
    return null;
  }

  return fetchTransportForConfig(config, fetchFn, now);
}

/** Test helper — clears the in-process fallback cache. */
export function clearTransportServiceCache(): void {
  inMemoryTransportCache.clear();
}
