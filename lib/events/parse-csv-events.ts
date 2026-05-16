import Papa from "papaparse";
import { EventType } from "@prisma/client";

export type ParsedEventRow = {
  title: string;
  startAt: Date;
  endAt?: Date;
  location?: string;
  type: EventType;
  teamName?: string;
  opponentName?: string;
  organizerName?: string;
  competitionLabel?: string;
  homeAway?: string;
};

export type CsvFieldKey =
  | "title"
  | "team"
  | "opponentName"
  | "organizerName"
  | "competitionLabel"
  | "homeAway"
  | "location"
  | "startAt"
  | "endAt"
  | "type";

export const CSV_FIELD_ALIASES: Record<CsvFieldKey, string[]> = {
  title: ["title", "titel", "name", "bezeichnung"],
  team: ["team", "mannschaft", "teamname", "clubteam", "heimteam"],
  opponentName: ["opponentname", "gegner", "gegnername", "awayteam", "gastteam", "gast"],
  organizerName: ["organizername", "organisator", "veranstalter"],
  competitionLabel: ["competitionlabel", "competition", "wettbewerb", "liga", "kategorie"],
  homeAway: ["homeaway", "heimaway", "heimauswaerts", "heimauswärts", "heimgast"],
  location: ["location", "ort", "platz", "sportplatz", "anlage"],
  startAt: ["startat", "datum", "date", "start", "beginn", "anstoss", "anpfiff"],
  endAt: ["endat", "ende", "end"],
  type: ["type", "typ", "eventtype", "art"],
};

export type CsvPreviewMeta = {
  delimiter: string;
  headers: string[];
  mapping: Record<CsvFieldKey, string | null>;
};

function decodeFile(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]/g, "");
}

function normalize(value?: string) {
  return value?.trim();
}

function detectDelimiter(text: string) {
  return text.includes(";") ? ";" : ",";
}

function buildHeaderLookup(headers: string[]) {
  const lookup: Record<string, string> = {};

  for (const header of headers) {
    lookup[normalizeHeader(header)] = header;
  }

  return lookup;
}

function buildMapping(headers: string[]) {
  const lookup = buildHeaderLookup(headers);

  const mapping = {} as Record<CsvFieldKey, string | null>;

  (Object.keys(CSV_FIELD_ALIASES) as CsvFieldKey[]).forEach((fieldKey) => {
    const aliases = CSV_FIELD_ALIASES[fieldKey];
    const match = aliases.find((alias) => lookup[normalizeHeader(alias)]);
    mapping[fieldKey] = match ? lookup[normalizeHeader(match)] : null;
  });

  return mapping;
}

function getMappedValue(
  row: Record<string, string>,
  mapping: Record<CsvFieldKey, string | null>,
  field: CsvFieldKey,
) {
  const header = mapping[field];
  if (!header) {
    return undefined;
  }

  const value = row[header];
  if (value === undefined || value === null) {
    return undefined;
  }

  const trimmed = String(value).trim();
  return trimmed === "" ? undefined : trimmed;
}

function parseDate(value: string | undefined, fieldName: string): Date {
  const raw = String(value ?? "").trim();

  if (!raw) {
    throw new Error("Pflichtfeld '" + fieldName + "' fehlt.");
  }

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Ungültiges Datum im Feld '" + fieldName + "': " + raw);
  }

  return date;
}

function parseType(value?: string): EventType {
  const raw = String(value ?? "").trim().toUpperCase();

  if (raw === "MATCH" || raw === "SPIEL") return EventType.MATCH;
  if (raw === "TOURNAMENT" || raw === "TURNIER") return EventType.TOURNAMENT;
  if (raw === "TRAINING") return EventType.TRAINING;
  return EventType.OTHER;
}

function parseHomeAway(value?: string): string | undefined {
  const raw = String(value ?? "").trim().toUpperCase();

  if (!raw) return undefined;
  if (["HOME", "HEIM", "H"].includes(raw)) return "HOME";
  if (["AWAY", "AUSWAERTS", "AUSWÄRTS", "GAST", "A"].includes(raw)) return "AWAY";

  return String(value ?? "").trim();
}

function buildTitleFromMappedRow(args: {
  row: Record<string, string>;
  mapping: Record<CsvFieldKey, string | null>;
  type: EventType;
}) {
  const title = getMappedValue(args.row, args.mapping, "title");
  if (title) {
    return title;
  }

  const team = getMappedValue(args.row, args.mapping, "team");
  const opponent = getMappedValue(args.row, args.mapping, "opponentName");
  const competition = getMappedValue(args.row, args.mapping, "competitionLabel");
  const organizer = getMappedValue(args.row, args.mapping, "organizerName");

  if (args.type === EventType.MATCH && team && opponent) {
    return team + " vs " + opponent;
  }

  if (args.type === EventType.TOURNAMENT && team) {
    return competition ? team + " " + competition : team + " Turnier";
  }

  if (args.type === EventType.TRAINING && team) {
    return team + " Training";
  }

  if (organizer) {
    return organizer;
  }

  if (competition) {
    return competition;
  }

  if (team) {
    return team + " Event";
  }

  return "Event";
}

export async function parseCsvEvents(file: File): Promise<ParsedEventRow[]> {
  const buffer = await file.arrayBuffer();
  const text = decodeFile(buffer);
  const delimiter = detectDelimiter(text);

  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    delimiter,
  });

  if (result.errors.length) {
    throw new Error(result.errors[0].message);
  }

  const headers = result.meta.fields ?? [];
  const mapping = buildMapping(headers);

  if (!mapping.startAt) {
    throw new Error("Keine passende Spalte für Startdatum / Startzeit gefunden.");
  }

  return result.data.map((row, index) => {
    const rowNumber = index + 2;
    const type = parseType(getMappedValue(row, mapping, "type"));
    const title = buildTitleFromMappedRow({ row, mapping, type });

    const startAt = parseDate(
      getMappedValue(row, mapping, "startAt"),
      "startAt",
    );

    const endAtRaw = getMappedValue(row, mapping, "endAt");
    const endAt = endAtRaw ? parseDate(endAtRaw, "endAt") : undefined;

    if (endAt && endAt < startAt) {
      throw new Error("Zeile " + rowNumber + ": endAt liegt vor startAt.");
    }

    return {
      title: normalize(title)!,
      location: normalize(getMappedValue(row, mapping, "location")),
      startAt,
      endAt,
      type,
      teamName: normalize(getMappedValue(row, mapping, "team")),
      opponentName: normalize(getMappedValue(row, mapping, "opponentName")),
      organizerName: normalize(getMappedValue(row, mapping, "organizerName")),
      competitionLabel: normalize(getMappedValue(row, mapping, "competitionLabel")),
      homeAway: parseHomeAway(getMappedValue(row, mapping, "homeAway")),
    };
  });
}

export async function parseCsvEventsWithMeta(file: File): Promise<{
  rows: ParsedEventRow[];
  meta: CsvPreviewMeta;
}> {
  const buffer = await file.arrayBuffer();
  const text = decodeFile(buffer);
  const delimiter = detectDelimiter(text);

  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    delimiter,
  });

  if (result.errors.length) {
    throw new Error(result.errors[0].message);
  }

  const headers = result.meta.fields ?? [];
  const mapping = buildMapping(headers);

  const rows = await parseCsvEvents(file);

  return {
    rows,
    meta: {
      delimiter,
      headers,
      mapping,
    },
  };
}