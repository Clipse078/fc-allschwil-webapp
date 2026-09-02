/**
 * lib/transport/transport-config.ts
 *
 * Generic tenant transport configuration for Infoboard Screen 2.
 *
 * V1 uses a code/config foundation — no database migration. Future admin UI
 * can persist equivalent fields on Tenant or Infoboard records.
 */

import type { TransportCategory, TransportDirectionOrientation, TransportProviderId } from "./transport-types";

export type TransportDirectionGroupConfig = {
  id: string;
  displayName: string;
  orientation: TransportDirectionOrientation;
  /** Primary matchers against the provider next-stop name after the departure stop. */
  nextStopMatchers?: string[];
  /** Matchers against the provider next-stop identifier. */
  nextStopIdMatchers?: string[];
  /** Fallback matchers against provider direction/headsign fields. */
  providerDirectionMatchers?: string[];
  /** Last-resort fallback matchers against normalized destination text. */
  destinationMatchers?: string[];
};

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
  /** Max departures shown per configured direction group. */
  departuresPerDirectionGroup?: number;
  directionGroups?: TransportDirectionGroupConfig[];
  /** Server/client refresh interval in seconds. */
  refreshIntervalSeconds: number;
};

/**
 * Physical directions from Allschwil, Im Brüel (8578172) validated via
 * transport.opendata.ch passList next-stop topology (2026-09-02):
 *   - Hagmattstrasse: south/west through Allschwil (Friedhof, Oberwil, Therwil, Basel SBB)
 *   - Kreuzstrasse: north/east towards Bachgraben and Basel city
 */
export const FC_ALLSCHWIL_DIRECTION_GROUPS: TransportDirectionGroupConfig[] = [
  {
    id: "allschwil-zentrum",
    displayName: "Richtung Allschwil Zentrum",
    orientation: "left",
    nextStopMatchers: ["Allschwil, Hagmattstrasse"],
    nextStopIdMatchers: ["8578173"],
  },
  {
    id: "bachgraben-basel",
    displayName: "Richtung Bachgraben / Basel",
    orientation: "right",
    nextStopMatchers: ["Allschwil, Kreuzstrasse"],
    nextStopIdMatchers: ["8578171"],
  },
];

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
  departuresPerDirectionGroup: 3,
  directionGroups: FC_ALLSCHWIL_DIRECTION_GROUPS,
  refreshIntervalSeconds: 45,
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
