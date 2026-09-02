/**
 * lib/transport/providers/opendata-ch-transport-provider.ts
 *
 * Swiss public transport provider backed by transport.opendata.ch.
 *
 * - No authentication required.
 * - Rate limit inherited from timetable.search.ch — be conservative.
 * - Stationboard: GET /v1/stationboard?id={stopId}
 */

import type { TransportStopConfig } from "../transport-config";
import type {
  TransportCategory,
  TransportDeparture,
  TransportProviderId,
} from "../transport-types";

const PROVIDER: TransportProviderId = "opendata.ch";
const BASE_URL = "https://transport.opendata.ch/v1";
const FETCH_TIMEOUT_MS = 20_000;

type OpendataCoordinate = {
  x?: number | null;
  y?: number | null;
};

type OpendataStop = {
  departure?: string | null;
  delay?: number | null;
  platform?: string | null;
  prognosis?: {
    departure?: string | null;
  } | null;
  station?: {
    id?: string | null;
    name?: string | null;
  } | null;
};

type OpendataPassListEntry = {
  station?: {
    id?: string | null;
    name?: string | null;
  } | null;
};

type OpendataStationboardEntry = {
  category?: string | null;
  number?: string | null;
  to?: string | null;
  operator?: string | null;
  stop?: OpendataStop | null;
  passList?: OpendataPassListEntry[] | null;
};

type OpendataStationboardResponse = {
  station?: {
    id?: string | null;
    name?: string | null;
    coordinate?: OpendataCoordinate | null;
  } | null;
  stationboard?: OpendataStationboardEntry[] | null;
};

export type OpendataChFetchResult =
  | {
      ok: true;
      departures: TransportDeparture[];
      stationId: string;
      hasRealtimeData: boolean;
    }
  | {
      ok: false;
      errorCode: "provider_error" | "malformed_response";
    };

function mapCategory(code: string | null | undefined): TransportCategory {
  const normalized = (code ?? "").trim().toUpperCase();
  if (normalized === "B") return "bus";
  if (normalized === "T") return "tram";
  if (normalized === "S" || normalized === "SN") return "train";
  if (["IC", "IR", "RE", "EC", "ICE", "R", "D", "EXT"].includes(normalized)) {
    return "train";
  }
  if (normalized === "SHIP" || normalized === "F") return "ship";
  if (normalized === "CABLE" || normalized === "LB") return "cableway";
  return "other";
}

function categoryLabel(category: TransportCategory): string {
  switch (category) {
    case "bus":
      return "BUS";
    case "tram":
      return "TRAM";
    case "train":
      return "ZUG";
    case "ship":
      return "SCHIFF";
    case "cableway":
      return "SEILBAHN";
    default:
      return "ÖV";
  }
}

function parseDelayMinutes(
  plannedDeparture: string,
  realtimeDeparture: string | null,
  rawDelay: number | null | undefined,
): number | null {
  if (typeof rawDelay === "number" && Number.isFinite(rawDelay)) {
    return Math.max(0, Math.round(rawDelay));
  }

  if (!realtimeDeparture) {
    return null;
  }

  const plannedMs = Date.parse(plannedDeparture);
  const realtimeMs = Date.parse(realtimeDeparture);
  if (!Number.isFinite(plannedMs) || !Number.isFinite(realtimeMs)) {
    return null;
  }

  const diffMinutes = Math.round((realtimeMs - plannedMs) / 60_000);
  return diffMinutes > 0 ? diffMinutes : 0;
}

function resolveNextStop(
  entry: OpendataStationboardEntry,
  stopId: string,
): { nextStopId: string | null; nextStopName: string | null } {
  const passList = Array.isArray(entry.passList) ? entry.passList : [];
  if (passList.length === 0) {
    return { nextStopId: null, nextStopName: null };
  }

  let currentIndex = passList.findIndex(
    (pass) => pass.station?.id?.trim() === stopId,
  );

  if (currentIndex === -1) {
    currentIndex = 0;
  }

  const nextEntry = passList[currentIndex + 1];
  return {
    nextStopId: nextEntry?.station?.id?.trim() || null,
    nextStopName: nextEntry?.station?.name?.trim() || null,
  };
}

function normalizeDeparture(
  entry: OpendataStationboardEntry,
  stopId: string,
): TransportDeparture | null {
  const plannedDeparture = entry.stop?.departure?.trim();
  if (!plannedDeparture) {
    return null;
  }

  const prognosisDeparture = entry.stop?.prognosis?.departure?.trim() ?? null;
  const rawDelay = entry.stop?.delay ?? null;
  const hasRealtime =
    prognosisDeparture !== null ||
    (typeof rawDelay === "number" && Number.isFinite(rawDelay));
  const realtimeDeparture = prognosisDeparture ?? plannedDeparture;
  const category = mapCategory(entry.category);
  const line = (entry.number ?? "").trim() || "—";
  const { nextStopId, nextStopName } = resolveNextStop(entry, stopId);

  return {
    line,
    category,
    categoryLabel: categoryLabel(category),
    destination: (entry.to ?? "—").trim(),
    plannedDeparture,
    realtimeDeparture: hasRealtime ? realtimeDeparture : null,
    delayMinutes: parseDelayMinutes(plannedDeparture, realtimeDeparture, rawDelay),
    platform: entry.stop?.platform?.trim() || null,
    direction: (entry.to ?? null)?.trim() || null,
    nextStopId,
    nextStopName,
    provider: PROVIDER,
    hasRealtime,
  };
}

function effectiveDepartureMs(departure: TransportDeparture): number {
  const value = departure.realtimeDeparture ?? departure.plannedDeparture;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function matchesFilters(
  departure: TransportDeparture,
  config: TransportStopConfig,
): boolean {
  if (
    config.allowedCategories &&
    config.allowedCategories.length > 0 &&
    !config.allowedCategories.includes(departure.category)
  ) {
    return false;
  }

  if (
    config.lineFilters &&
    config.lineFilters.length > 0 &&
    !config.lineFilters.includes(departure.line)
  ) {
    return false;
  }

  if (
    config.destinationFilters &&
    config.destinationFilters.length > 0 &&
    !config.destinationFilters.some((filter) =>
      departure.destination.toLowerCase().includes(filter.toLowerCase()),
    )
  ) {
    return false;
  }

  return true;
}

export function normalizeOpendataStationboard(
  payload: unknown,
  config: TransportStopConfig,
  now: Date = new Date(),
): OpendataChFetchResult {
  if (!payload || typeof payload !== "object") {
    return { ok: false, errorCode: "malformed_response" };
  }

  const response = payload as OpendataStationboardResponse;
  const entries = Array.isArray(response.stationboard) ? response.stationboard : [];
  const stationId = response.station?.id?.trim() || config.stopId;

  const departures = entries
    .map((entry) => normalizeDeparture(entry, stationId))
    .filter((departure): departure is TransportDeparture => departure !== null)
    .filter((departure) => matchesFilters(departure, config))
    .filter((departure) => effectiveDepartureMs(departure) >= now.getTime() - 60_000)
    .sort((a, b) => effectiveDepartureMs(a) - effectiveDepartureMs(b))
    .slice(0, config.departureCount);

  const hasRealtimeData = departures.some((departure) => departure.hasRealtime);

  return {
    ok: true,
    departures,
    stationId,
    hasRealtimeData,
  };
}

async function fetchWithTimeout(
  url: string,
  fetchFn: typeof fetch,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    return await fetchFn(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
      next: { revalidate: 0 },
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchOpendataChStationboard(
  config: TransportStopConfig,
  fetchFn: typeof fetch = fetch,
  now: Date = new Date(),
): Promise<OpendataChFetchResult> {
  const params = new URLSearchParams({
    id: config.stopId,
    limit: String(Math.max(config.departureCount, 8)),
  });

  if (config.allowedCategories && config.allowedCategories.length > 0) {
    for (const category of config.allowedCategories) {
      const transportations =
        category === "train"
          ? "train"
          : category === "tram"
            ? "tram"
            : category === "bus"
              ? "bus"
              : category === "ship"
                ? "ship"
                : category === "cableway"
                  ? "cableway"
                  : null;
      if (transportations) {
        params.append("transportations[]", transportations);
      }
    }
  }

  const url = `${BASE_URL}/stationboard?${params.toString()}`;

  try {
    const response = await fetchWithTimeout(url, fetchFn);
    if (!response.ok) {
      return { ok: false, errorCode: "provider_error" };
    }

    const payload: unknown = await response.json();
    return normalizeOpendataStationboard(payload, config, now);
  } catch {
    return { ok: false, errorCode: "provider_error" };
  }
}
