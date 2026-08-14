/**
 * lib/infoboard/anlageplan-types.ts
 *
 * Type definitions for the Anlageplan (facility map) feature.
 *
 * INFOBOARD-MAP-01
 *
 * Design goals:
 *   - Free positioning on a 16:9 canvas using normalized coords (0..1)
 *   - Canonical FacilityResource association (not loose strings)
 *   - Board-level Du bist hier (per-screen physical location)
 *   - No grid constraints — different system from widget-types.ts
 *   - Scales correctly: designer → kiosk TV (multiply by canvas pixel size)
 *
 * Storage:
 *   Infoboard.anlageplanJson — AnlageplanConfig JSON (this module's version 1)
 *   Infoboard.anlageplanBackgroundUrl — Vercel Blob CDN URL of the site plan image
 *
 * Coordinate system:
 *   All x, y, width, height values are normalized to [0, 1] relative to the
 *   canvas (16:9 aspect ratio). At render time multiply by actual canvas px.
 *   rotation is degrees (0..360), default 0.
 */

// ── Normalized position / size ─────────────────────────────────────────────

/**
 * Normalized position and size of a map element.
 * All values are in [0, 1] relative to the canvas.
 */
export type NormalizedRect = {
  /** 0 = left edge, 1 = right edge */
  x: number;
  /** 0 = top edge, 1 = bottom edge */
  y: number;
  /** fraction of canvas width */
  width: number;
  /** fraction of canvas height */
  height: number;
  /** rotation in degrees, default 0 */
  rotation?: number;
};

// ── Element types ──────────────────────────────────────────────────────────

/**
 * Resource zone — links an area on the map to a canonical FacilityResource.
 * The Infoboard live feed resolves which activities are happening on that
 * resource and renders them as compact activity cards inside the zone.
 */
export type ResourceZoneElement = {
  kind: "RESOURCE_ZONE";
  id: string;
  rect: NormalizedRect;
  /**
   * Canonical FacilityResource.code — e.g. "KR1", "KR2", "KR2-A".
   * Used to match against PitchOccupancy.code in the Screen 2 feed.
   * null = zone is not yet linked to a resource.
   */
  resourceCode: string | null;
  /**
   * Display label shown in designer sidebar + on the map.
   * Defaults to resourceCode when null.
   */
  label: string | null;
  /**
   * Zone sub-type for display hints.
   * FULL_PITCH = whole pitch; HALF_PITCH = half/field section (Feld A/B).
   */
  zoneType: "FULL_PITCH" | "HALF_PITCH";
  /**
   * Whether to show the next-activity card (more subtle than current).
   * Defaults to true.
   */
  showNextActivity: boolean;
};

/** Marker types matching the MVP palette */
export type MarkerType =
  | "DU_BIST_HIER"
  | "HAUPTEINGANG"
  | "KABINE"
  | "WC"
  | "BISTRO"
  | "PARKPLATZ"
  | "SEKRETARIAT"
  | "SPEAKERRAUM"
  | "ERSTE_HILFE"
  | "FREIER_MARKER";

/** Facility / amenity marker element */
export type MarkerElement = {
  kind: "MARKER";
  id: string;
  rect: NormalizedRect;
  markerType: MarkerType;
  /** Primary label — e.g. "Kabinen 1–8" */
  label: string | null;
  /** Optional secondary helper text — e.g. "Eingang Nord" */
  secondaryText: string | null;
};

/** Union of all map element types */
export type AnlageplanElement = ResourceZoneElement | MarkerElement;

// ── Full config object ─────────────────────────────────────────────────────

/**
 * The complete Anlageplan configuration stored in Infoboard.anlageplanJson.
 */
export type AnlageplanConfig = {
  version: 1;
  /** All map elements (zones and markers). */
  elements: AnlageplanElement[];
};

// ── Constants / display helpers ────────────────────────────────────────────

export const MARKER_LABELS: Record<MarkerType, string> = {
  DU_BIST_HIER: "Du bist hier",
  HAUPTEINGANG: "Haupteingang",
  KABINE: "Kabine",
  WC: "WC",
  BISTRO: "Bistro",
  PARKPLATZ: "Parkplatz",
  SEKRETARIAT: "Sekretariat",
  SPEAKERRAUM: "Speakerraum",
  ERSTE_HILFE: "Erste Hilfe",
  FREIER_MARKER: "Marker",
};

export const ZONE_TYPE_LABELS: Record<ResourceZoneElement["zoneType"], string> = {
  FULL_PITCH: "Spielfeld (ganzes Feld)",
  HALF_PITCH: "Teilfeld (Feld A/B)",
};

// ── Default values ─────────────────────────────────────────────────────────

export function defaultRect(): NormalizedRect {
  return { x: 0.1, y: 0.1, width: 0.2, height: 0.15, rotation: 0 };
}

export function defaultMarkerRect(): NormalizedRect {
  return { x: 0.1, y: 0.1, width: 0.05, height: 0.07, rotation: 0 };
}

export function defaultDuBistHierRect(): NormalizedRect {
  return { x: 0.45, y: 0.45, width: 0.08, height: 0.10, rotation: 0 };
}

// ── Parse / validate ──────────────────────────────────────────────────────

/**
 * Parses anlageplanJson safely.
 * Returns null if the JSON is missing, malformed, or version-mismatch.
 */
export function parseAnlageplanJson(
  json: string | null | undefined,
): AnlageplanConfig | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      (parsed as Record<string, unknown>).version !== 1 ||
      !Array.isArray((parsed as Record<string, unknown>).elements)
    ) {
      return null;
    }
    return parsed as AnlageplanConfig;
  } catch {
    return null;
  }
}

/**
 * Returns a fresh empty Anlageplan config.
 */
export function emptyAnlageplanConfig(): AnlageplanConfig {
  return { version: 1, elements: [] };
}

/**
 * Validates a NormalizedRect.
 * Returns null if valid, or an error string if invalid.
 */
export function validateNormalizedRect(rect: NormalizedRect): string | null {
  if (rect.x < 0 || rect.x > 1) return "x muss zwischen 0 und 1 liegen.";
  if (rect.y < 0 || rect.y > 1) return "y muss zwischen 0 und 1 liegen.";
  if (rect.width <= 0 || rect.width > 1) return "width muss zwischen 0 und 1 liegen.";
  if (rect.height <= 0 || rect.height > 1) return "height muss zwischen 0 und 1 liegen.";
  if (rect.rotation !== undefined && (rect.rotation < 0 || rect.rotation > 360)) {
    return "rotation muss zwischen 0 und 360 liegen.";
  }
  return null;
}

/**
 * Validates a full AnlageplanConfig.
 * Returns null if valid, or an error string if invalid.
 */
export function validateAnlageplanConfig(config: AnlageplanConfig): string | null {
  if (config.version !== 1) return "Ungültige Anlageplan-Version.";
  if (!Array.isArray(config.elements)) return "elements muss ein Array sein.";
  const ids = new Set<string>();
  for (const el of config.elements) {
    if (!el.id) return "Jedes Element benötigt eine id.";
    if (ids.has(el.id)) return `Doppelte Element-id: ${el.id}`;
    ids.add(el.id);
    const rectError = validateNormalizedRect(el.rect);
    if (rectError) return `Element ${el.id}: ${rectError}`;
    if (el.kind !== "RESOURCE_ZONE" && el.kind !== "MARKER") {
      const unknownEl = el as { id: string; kind: string };
      return `Element ${unknownEl.id}: Unbekannter kind '${unknownEl.kind}'.`;
    }
  }
  return null;
}

// ── Type guards ────────────────────────────────────────────────────────────

export function isResourceZone(el: AnlageplanElement): el is ResourceZoneElement {
  return el.kind === "RESOURCE_ZONE";
}

export function isMarker(el: AnlageplanElement): el is MarkerElement {
  return el.kind === "MARKER";
}

export function isDuBistHier(el: AnlageplanElement): el is MarkerElement {
  return el.kind === "MARKER" && el.markerType === "DU_BIST_HIER";
}
