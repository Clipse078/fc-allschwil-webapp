/**
 * lib/transport/transport-types.ts
 *
 * Provider-neutral public transport DTO types for Infoboard Screen 2.
 *
 * Design constraints:
 *   - No framework imports, no Prisma, no DB access, no I/O.
 *   - Pure type definitions and sentinel values.
 */

export type TransportProviderId = "opendata.ch";

export type TransportCategory =
  | "bus"
  | "tram"
  | "train"
  | "ship"
  | "cableway"
  | "other";

export type TransportDeparture = {
  /** Line number or short designation (e.g. "33", "48"). */
  line: string;
  category: TransportCategory;
  /** Uppercase display label (e.g. BUS, TRAM). */
  categoryLabel: string;
  destination: string;
  /** Planned timetable departure (ISO-8601). */
  plannedDeparture: string;
  /** Estimated/realtime departure when supplied by the provider. */
  realtimeDeparture: string | null;
  /** Delay in whole minutes when supplied or derivable. */
  delayMinutes: number | null;
  platform: string | null;
  direction: string | null;
  provider: TransportProviderId;
  /** True when the provider supplied realtime/prognosis data for this row. */
  hasRealtime: boolean;
};

export type TransportAvailableResult = {
  isAvailable: true;
  stationDisplayName: string;
  stationId: string;
  departures: TransportDeparture[];
  fetchedAt: string;
  /** True when the payload is served from a previous successful fetch. */
  isStale: boolean;
  /** True when at least one departure includes realtime information. */
  hasRealtimeData: boolean;
};

export type TransportUnavailableResult = {
  isAvailable: false;
  stationDisplayName: string;
  errorCode: "disabled" | "not_configured" | "provider_error" | "malformed_response";
  fetchedAt: string;
  /** Last known departures retained after a transient provider failure. */
  cachedDepartures?: TransportDeparture[];
};

export type TransportResult = TransportAvailableResult | TransportUnavailableResult;

export const TRANSPORT_UNAVAILABLE: TransportUnavailableResult = {
  isAvailable: false,
  stationDisplayName: "",
  errorCode: "provider_error",
  fetchedAt: new Date(0).toISOString(),
};
