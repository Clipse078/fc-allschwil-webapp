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

// ── Marker size preset ────────────────────────────────────────────────────

/**
 * Constrained marker size enum.
 *   S  — compact, secondary wayfinding
 *   M  — standard (default)
 *   L  — prominent, primary wayfinding
 *   XL — dominant TV-distance visibility
 *
 * Controls the entire marker treatment proportionally (icon, label, padding).
 */
export type MarkerSize = "S" | "M" | "L" | "XL";

/**
 * Scale multipliers applied to the base marker dimensions per size preset.
 * Each value is a CSS clamp() scale factor relative to the base.
 */
export const MARKER_SIZE_PRESETS: Record<
  MarkerSize,
  {
    iconVh: string;
    labelVh: string;
    paddingVh: string;
    paddingVw: string;
    borderRadiusVh: string;
    gap: string;
  }
> = {
  S: {
    iconVh: "clamp(7px, 0.9vh, 13px)",
    labelVh: "clamp(4px, 0.55vh, 8px)",
    paddingVh: "clamp(1px, 0.2vh, 3px)",
    paddingVw: "clamp(3px, 0.35vw, 6px)",
    borderRadiusVh: "clamp(2px, 0.3vh, 5px)",
    gap: "1px",
  },
  M: {
    iconVh: "clamp(10px, 1.6vh, 22px)",
    labelVh: "clamp(6px, 0.85vh, 12px)",
    paddingVh: "clamp(3px, 0.4vh, 6px)",
    paddingVw: "clamp(6px, 0.7vw, 12px)",
    borderRadiusVh: "clamp(4px, 0.5vh, 9px)",
    gap: "2px",
  },
  L: {
    iconVh: "clamp(14px, 2.0vh, 28px)",
    labelVh: "clamp(8px, 1.05vh, 15px)",
    paddingVh: "clamp(4px, 0.55vh, 8px)",
    paddingVw: "clamp(7px, 0.85vw, 14px)",
    borderRadiusVh: "clamp(5px, 0.65vh, 11px)",
    gap: "3px",
  },
  XL: {
    iconVh: "clamp(20px, 2.8vh, 40px)",
    labelVh: "clamp(11px, 1.4vh, 20px)",
    paddingVh: "clamp(6px, 0.8vh, 12px)",
    paddingVw: "clamp(10px, 1.2vw, 20px)",
    borderRadiusVh: "clamp(7px, 0.9vh, 14px)",
    gap: "4px",
  },
};

export function defaultMarkerSize(): MarkerSize {
  return "M";
}

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
  /**
   * Optional card background color override (CSS hex, e.g. "#0a1828").
   * Falls back to canonical Infoboard dark card default when null/absent.
   */
  backgroundColor?: string | null;
  /**
   * Optional card text color override (CSS hex, e.g. "#ffffff").
   * Falls back to canonical Infoboard white text default when null/absent.
   */
  textColor?: string | null;
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
  /**
   * Constrained size preset. Controls icon + label + padding proportionally.
   * Defaults to "M" when absent — backward-compatible with existing markers.
   */
  markerSize?: MarkerSize;
  /**
   * Optional background color override (CSS hex).
   * Falls back to canonical dark semi-transparent default when null/absent.
   */
  backgroundColor?: string | null;
  /**
   * Optional text/icon label color override (CSS hex).
   * Falls back to canonical rgba(255,255,255,0.75) when null/absent.
   */
  textColor?: string | null;
};

/** Union of all map element types */
export type AnlageplanElement = ResourceZoneElement | MarkerElement;

// ── Background transform ───────────────────────────────────────────────────

/**
 * Framing transform for the background site-plan image.
 *
 * The entire map scene (background image + all resource zone overlays +
 * all markers) is rendered inside a shared transformed container so that
 * zones and markers always stay visually aligned with the image.
 *
 * Coordinate convention (CSS transform with transform-origin center):
 *   scale  — zoom factor; 1.0 = fill/fit, >1 = zoomed in.
 *   offsetX — horizontal translation as a fraction of the canvas width;
 *              0 = centred, −0.5 = shifted half a canvas width left.
 *   offsetY — vertical translation as a fraction of the canvas height;
 *              0 = centred, −0.5 = shifted half a canvas height up.
 *
 * Designer and public kiosk apply the same transform so the configured
 * framing is pixel-identical at render time.
 */
export type BackgroundTransform = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

export function defaultBackgroundTransform(): BackgroundTransform {
  return { scale: 1, offsetX: 0, offsetY: 0 };
}

// ── Full config object ─────────────────────────────────────────────────────

/**
 * The complete Anlageplan configuration stored in Infoboard.anlageplanJson.
 */
export type AnlageplanConfig = {
  version: 1;
  /** All map elements (zones and markers). */
  elements: AnlageplanElement[];
  /**
   * Background framing transform — zoom/pan applied to the whole map scene
   * (background image + overlays together). Optional: defaults to
   * defaultBackgroundTransform() when absent.
   */
  backgroundTransform?: BackgroundTransform;
  /**
   * Infoboard-scoped display name overrides for teams / events.
   *
   * Key  : canonical teamDisplayName or displayTitle from the live feed.
   * Value: visitor-friendly override label shown on this Infoboard only.
   *
   * Empty string values are ignored (treated as "no override").
   * Canonical Team.displayName is never mutated.
   *
   * Example: { "FC Allschwil Junioren F2": "F2 Training" }
   */
  displayNameOverrides?: Record<string, string>;
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

/**
 * Canonical marker icon map — single source of truth for both designer and kiosk.
 *
 * Uses emoji because they render identically in server (kiosk) and client
 * (designer) contexts with no bundling overhead.
 *
 * INFOBOARD-MAP-01B — imported by:
 *   - AnlageplanDesignerClient (palette + placed canvas markers)
 *   - InfoboardAnlageplan (public kiosk FacilityMarker / DuBistHierMarker)
 */
export const MARKER_ICONS: Record<MarkerType, string> = {
  DU_BIST_HIER: "📍",
  HAUPTEINGANG: "🚪",
  KABINE: "👕",
  WC: "🚻",
  BISTRO: "☕",
  PARKPLATZ: "🅿️",
  SEKRETARIAT: "📋",
  SPEAKERRAUM: "🔊",
  ERSTE_HILFE: "🏥",
  FREIER_MARKER: "📌",
};

// ── Canonical facility option type (for Anlageplan resource picker) ──────────

/**
 * Serialisable resource entry used by the Anlageplan designer's canonical
 * FacilityResource picker.
 *
 * INFOBOARD-MAP-01B — passed from the server page to AnlageplanDesignerClient.
 */
export type AnlageplanResourceOption = {
  /** FacilityResource.code — stored in ResourceZoneElement.resourceCode */
  code: string;
  /** FacilityResource.name — e.g. "Feld A" */
  name: string;
  /** FacilityResourceType: "FULL_PITCH" | "HALF_PITCH" */
  type: "FULL_PITCH" | "HALF_PITCH";
  /** Parent Facility.name — e.g. "Kunstrasen 2" */
  facilityName: string;
};

/**
 * Human-readable picker label for an AnlageplanResourceOption.
 *
 * Examples:
 *   Kunstrasen 2 (FULL_PITCH, resource.name === facility.name) → "Kunstrasen 2"
 *   Kunstrasen 2 · Feld A                                       → "Kunstrasen 2 · Feld A"
 */
export function anlageplanResourceLabel(opt: AnlageplanResourceOption): string {
  if (opt.name === opt.facilityName) return opt.facilityName;
  return `${opt.facilityName} · ${opt.name}`;
}

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
  return { version: 1, elements: [], backgroundTransform: defaultBackgroundTransform() };
}

/**
 * Resolves the background transform from a config, falling back to the default.
 */
export function resolveBackgroundTransform(config: AnlageplanConfig): BackgroundTransform {
  const t = config.backgroundTransform;
  if (!t) return defaultBackgroundTransform();
  return {
    scale: typeof t.scale === "number" && t.scale > 0 ? t.scale : 1,
    offsetX: typeof t.offsetX === "number" ? t.offsetX : 0,
    offsetY: typeof t.offsetY === "number" ? t.offsetY : 0,
  };
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
