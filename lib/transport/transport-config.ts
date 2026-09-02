/**
 * lib/transport/transport-config.ts
 *
 * Generic tenant transport configuration for Infoboard Screen 2.
 *
 * V1 uses a code/config foundation — no database migration. Future admin UI
 * can persist equivalent fields on Tenant or Infoboard records.
 */

import type { TransportCategory, TransportProviderId } from "./transport-types";

export type TransportStopConfig = {
  enabled: boolean;
  provider: TransportProviderId;
  /** Canonical provider stop/station identifier (preferred over free-text lookup). */
  stopId: string;
  /** Provider station name used only for diagnostics/fallback lookup. */
  providerStationName?: string;
  /** Display name shown on the kiosk (may differ from provider spelling). */
  stationDisplayName: string;
  coordinate?: {
    latitude: number;
    longitude: number;
  };
  allowedCategories?: TransportCategory[];
  lineFilters?: string[];
  destinationFilters?: string[];
  departureCount: number;
  /** Server/client refresh interval in seconds. */
  refreshIntervalSeconds: number;
  /** Center rotator dwell time per slide in milliseconds. */
  rotatorIntervalMs: number;
};

const FC_ALLSCHWIL_TRANSPORT: TransportStopConfig = {
  enabled: true,
  provider: "opendata.ch",
  stopId: "8578172",
  providerStationName: "Allschwil, Im Brühl",
  stationDisplayName: "Allschwil, Im Brüel",
  coordinate: {
    latitude: 47.557551,
    longitude: 7.547436,
  },
  allowedCategories: ["bus", "tram", "train"],
  departureCount: 8,
  refreshIntervalSeconds: 45,
  rotatorIntervalMs: 20_000,
};

const TENANT_TRANSPORT_CONFIG: Readonly<Record<string, TransportStopConfig>> = {
  "fc-allschwil": FC_ALLSCHWIL_TRANSPORT,
};

/**
 * Resolves transport configuration for a tenant key.
 * Returns null when transport is not configured or disabled.
 */
export function resolveTenantTransportConfig(
  tenantKey: string,
): TransportStopConfig | null {
  const config = TENANT_TRANSPORT_CONFIG[tenantKey];
  if (!config || !config.enabled) {
    return null;
  }
  return config;
}
