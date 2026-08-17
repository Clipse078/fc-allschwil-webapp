/**
 * MeteoSwiss E4 local forecast enrichment for Infoboards.
 *
 * Dataset:
 * ch.meteoschweiz.ogd-local-forecasting
 *
 * Parameter:
 * jww003i0 — MeteoSwiss weather type / pictogram number,
 * preceding three hours, forecast.
 *
 * Allschwil:
 * point_id = 412300
 * point_type_id = 2
 *
 * Symbol meanings below follow the official MeteoSwiss weather-symbol
 * reference. Codes outside the authoritative table intentionally return
 * unavailable so the measured VQHA80-derived condition remains the fallback.
 */

export const METEOSWISS_E4_COLLECTION =
  "ch.meteoschweiz.ogd-local-forecasting";

export const METEOSWISS_E4_POINT_ID = "412300";
export const METEOSWISS_E4_POINT_TYPE_ID = "2";

export const METEOSWISS_E4_REVALIDATE_SECONDS = 3600;

const STAC_ITEMS_URL =
  "https://data.geo.admin.ch/api/stac/v1/collections/" +
  `${METEOSWISS_E4_COLLECTION}/items?limit=100`;

const TIMEOUT_MS = 10_000;

export type MeteoSwissConditionFamily =
  | "sunny"
  | "partly-cloudy"
  | "cloudy"
  | "rain"
  | "snow"
  | "fog"
  | "storm";

export type MeteoSwissSymbolDefinition = {
  family: MeteoSwissConditionFamily;
  label: string;
};

export type MeteoSwissE4Condition = {
  symbolCode: number;
  forecastAt: string;
  conditionCode: number;
  conditionLabel: string;
};

export type MeteoSwissE4ConditionResult =
  | {
      isAvailable: true;
      value: MeteoSwissE4Condition;
    }
  | {
      isAvailable: false;
    };

type StacAsset = {
  href?: string;
};

type StacFeature = {
  id?: string;
  assets?: Record<string, StacAsset>;
};

type StacResponse = {
  features?: StacFeature[];
};

export type JsonResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

export type TextResponse = {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
};

export type FetchFn = (
  url: string,
  init?: RequestInit,
) => Promise<JsonResponse | TextResponse>;

const DAY_SYMBOLS: Record<number, MeteoSwissSymbolDefinition> = {
  1: { family: "sunny", label: "Sonnig" },
  2: { family: "sunny", label: "Ziemlich sonnig" },
  3: { family: "partly-cloudy", label: "Teilweise sonnig" },
  4: { family: "partly-cloudy", label: "Wechselnd bewölkt" },
  5: { family: "cloudy", label: "Bedeckt" },

  6: { family: "rain", label: "Einzelne Regenschauer" },
  7: { family: "rain", label: "Regen- oder Schneeschauer" },
  8: { family: "snow", label: "Einzelne Schneeschauer" },

  9: { family: "rain", label: "Einige Regenschauer" },
  10: { family: "rain", label: "Regen- oder Schneeschauer" },
  11: { family: "snow", label: "Einige Schneeschauer" },

  12: { family: "storm", label: "Leicht gewitterhaft" },
  13: { family: "storm", label: "Gewitterhaft" },

  14: { family: "rain", label: "Schwacher Regen" },
  15: { family: "rain", label: "Schwacher Regen oder Schnee" },
  16: { family: "snow", label: "Schwacher Schnee" },

  17: { family: "rain", label: "Zeitweise Regen" },
  18: { family: "rain", label: "Zeitweise Regen oder Schnee" },
  19: { family: "snow", label: "Zeitweise Schnee" },

  20: { family: "rain", label: "Anhaltender Regen" },
  21: { family: "rain", label: "Anhaltender Regen oder Schnee" },
  22: { family: "snow", label: "Anhaltender Schnee" },

  23: { family: "storm", label: "Leicht gewitterhaft" },
  24: { family: "storm", label: "Gewitterhaft" },
  25: { family: "storm", label: "Stark gewitterhaft" },

  26: { family: "cloudy", label: "Hohe Bewölkung" },
  27: { family: "fog", label: "Hochnebel" },
  28: { family: "fog", label: "Nebel" },

  29: { family: "rain", label: "Einzelne Regenschauer" },
  30: { family: "snow", label: "Leichter Schneefall" },
  31: { family: "rain", label: "Schnee- oder Regenschauer" },
  32: { family: "rain", label: "Einige Regenschauer" },
  33: { family: "rain", label: "Häufige Regenschauer" },
  34: { family: "rain", label: "Häufige Regenschauer" },
  35: { family: "cloudy", label: "Bedeckt und trocken" },
};

const NIGHT_LABELS: Record<number, string> = {
  101: "Klar",
  102: "Leicht bewölkt",
  103: "Zum Teil bewölkt",
  104: "Wechselnd bewölkt",
  105: "Bedeckt",
  106: "Einzelne Regenschauer",
  107: "Regen- oder Schneeschauer",
  108: "Einzelne Schneeschauer",
  109: "Einige Regenschauer",
  110: "Regen- oder Schneeschauer",
  111: "Einige Schneeschauer",
  112: "Leicht gewitterhaft",
  113: "Gewitterhaft",
  114: "Schwacher Regen",
  115: "Schwacher Regen oder Schnee",
  116: "Schwacher Schnee",
  117: "Zeitweise Regen",
  118: "Zeitweise Regen oder Schnee",
  119: "Zeitweise Schnee",
  120: "Anhaltender Regen",
  121: "Anhaltender Regen oder Schnee",
  122: "Anhaltender Schnee",
  123: "Leicht gewitterhaft",
  124: "Gewitterhaft",
  125: "Stark gewitterhaft",
  126: "Hohe Bewölkung",
  127: "Hochnebel",
  128: "Nebel",
  129: "Einzelne Regenschauer",
  130: "Leichter Schneefall",
  131: "Schnee- oder Regenschauer",
  132: "Einige Regenschauer",
  133: "Häufige Regenschauer",
  134: "Häufige Regenschauer",
  135: "Bedeckt und trocken",
};

export function resolveMeteoSwissSymbol(
  symbolCode: number,
): MeteoSwissSymbolDefinition | null {
  const dayDefinition =
    DAY_SYMBOLS[symbolCode];

  if (dayDefinition) {
    return dayDefinition;
  }

  if (symbolCode >= 101 && symbolCode <= 135) {
    const dayCode =
      symbolCode - 100;

    const semantic =
      DAY_SYMBOLS[dayCode];

    const label =
      NIGHT_LABELS[symbolCode];

    if (!semantic || !label) {
      return null;
    }

    return {
      family: semantic.family,
      label,
    };
  }

  return null;
}

export function conditionFamilyToCode(
  family: MeteoSwissConditionFamily,
): number {
  switch (family) {
    case "sunny":
      return 0;

    case "partly-cloudy":
      return 2;

    case "cloudy":
      return 3;

    case "fog":
      return 45;

    case "rain":
      return 61;

    case "snow":
      return 71;

    case "storm":
      return 95;
  }
}

export function parseE4Timestamp(
  raw: string,
): string | null {
  if (!/^\d{12}$/.test(raw)) {
    return null;
  }

  const year = raw.slice(0, 4);
  const month = raw.slice(4, 6);
  const day = raw.slice(6, 8);
  const hour = raw.slice(8, 10);
  const minute = raw.slice(10, 12);

  const iso =
    `${year}-${month}-${day}T${hour}:${minute}:00.000Z`;

  const parsed =
    new Date(iso);

  return Number.isNaN(parsed.getTime())
    ? null
    : iso;
}

function selectCurrentDayFeature(
  features: StacFeature[],
  now: Date,
): StacFeature | null {
  const date =
    now
      .toISOString()
      .slice(0, 10)
      .replaceAll("-", "");

  return (
    features.find(
      (feature) =>
        feature.id === `${date}-ch`,
    ) ?? null
  );
}

export function selectLatestApplicableAsset(
  feature: StacFeature,
  now: Date,
): string | null {
  const candidates: Array<{
    href: string;
    timestamp: number;
  }> = [];

  for (
    const [key, asset]
    of Object.entries(feature.assets ?? {})
  ) {
    if (
      !key.toLowerCase().endsWith(".jww003i0.csv") ||
      typeof asset.href !== "string"
    ) {
      continue;
    }

    const match =
      key.match(
        /\.(\d{12})\.jww003i0\.csv$/i,
      );

    if (!match) {
      continue;
    }

    const iso =
      parseE4Timestamp(match[1]);

    if (!iso) {
      continue;
    }

    const timestamp =
      new Date(iso).getTime();

    if (timestamp <= now.getTime()) {
      candidates.push({
        href: asset.href,
        timestamp,
      });
    }
  }

  candidates.sort(
    (a, b) =>
      b.timestamp - a.timestamp,
  );

  return candidates[0]?.href ?? null;
}

export function parseAllschwilE4Condition(
  csv: string,
  now: Date = new Date(),
): MeteoSwissE4ConditionResult {
  let best:
    | {
        timestamp: number;
        rawDate: string;
        symbolCode: number;
      }
    | undefined;

  const prefix =
    `${METEOSWISS_E4_POINT_ID};${METEOSWISS_E4_POINT_TYPE_ID};`;

  for (const rawLine of csv.split(/\r?\n/)) {
    const line =
      rawLine.trim();

    if (!line.startsWith(prefix)) {
      continue;
    }

    const columns =
      line.split(";");

    if (columns.length < 4) {
      continue;
    }

    const rawDate =
      columns[2]?.trim() ?? "";

    const symbolCode =
      Number(columns[3]?.trim());

    const iso =
      parseE4Timestamp(rawDate);

    if (
      !iso ||
      !Number.isInteger(symbolCode)
    ) {
      continue;
    }

    const timestamp =
      new Date(iso).getTime();

    if (timestamp > now.getTime()) {
      continue;
    }

    if (
      !best ||
      timestamp > best.timestamp
    ) {
      best = {
        timestamp,
        rawDate,
        symbolCode,
      };
    }
  }

  if (!best) {
    return {
      isAvailable: false,
    };
  }

  const definition =
    resolveMeteoSwissSymbol(
      best.symbolCode,
    );

  if (!definition) {
    return {
      isAvailable: false,
    };
  }

  const forecastAt =
    parseE4Timestamp(best.rawDate);

  if (!forecastAt) {
    return {
      isAvailable: false,
    };
  }

  return {
    isAvailable: true,
    value: {
      symbolCode:
        best.symbolCode,

      forecastAt,

      conditionCode:
        conditionFamilyToCode(
          definition.family,
        ),

      conditionLabel:
        definition.label,
    },
  };
}

export async function fetchMeteoSwissE4Condition(
  fetchFn: FetchFn =
    globalThis.fetch as unknown as FetchFn,

  now: Date =
    new Date(),
): Promise<MeteoSwissE4ConditionResult> {
  try {
    const itemResponse =
      await fetchFn(
        STAC_ITEMS_URL,
        {
          next: {
            revalidate:
              METEOSWISS_E4_REVALIDATE_SECONDS,
          },
          signal:
            AbortSignal.timeout(
              TIMEOUT_MS,
            ),
        } as RequestInit,
      );

    if (
      !itemResponse.ok ||
      !("json" in itemResponse)
    ) {
      return {
        isAvailable: false,
      };
    }

    const raw =
      await itemResponse.json();

    if (
      !raw ||
      typeof raw !== "object"
    ) {
      return {
        isAvailable: false,
      };
    }

    const features =
      (raw as StacResponse).features;

    if (!Array.isArray(features)) {
      return {
        isAvailable: false,
      };
    }

    const feature =
      selectCurrentDayFeature(
        features,
        now,
      );

    if (!feature) {
      return {
        isAvailable: false,
      };
    }

    const assetUrl =
      selectLatestApplicableAsset(
        feature,
        now,
      );

    if (!assetUrl) {
      return {
        isAvailable: false,
      };
    }

    const csvResponse =
      await fetchFn(
        assetUrl,
        {
          next: {
            revalidate:
              METEOSWISS_E4_REVALIDATE_SECONDS,
          },
          signal:
            AbortSignal.timeout(
              TIMEOUT_MS,
            ),
        } as RequestInit,
      );

    if (
      !csvResponse.ok ||
      !("text" in csvResponse)
    ) {
      return {
        isAvailable: false,
      };
    }

    const csv =
      await csvResponse.text();

    return parseAllschwilE4Condition(
      csv,
      now,
    );
  }
  catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    console.error(
      "[meteoswiss-e4] condition enrichment unavailable:",
      message,
    );

    return {
      isAvailable: false,
    };
  }
}
