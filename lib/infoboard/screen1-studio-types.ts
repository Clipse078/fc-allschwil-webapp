/**
 * Screen-1 Studio — per-card override and soft pagination preference types.
 *
 * Persisted as JSON on Infoboard.screen1StudioJson, keyed by stable card keys
 * from screen1-studio-keys.ts.
 */

import {
  INFOBOARD_FONT_SIZES,
  isInfoboardLogoSize,
  type InfoboardFontSize,
} from "./screen1-logo-settings";

/** null = inherit from global Screen-1 presentation setting. */
export type Screen1OverrideSize = InfoboardFontSize | null;

export type Screen1CardOverride = {
  /** Team / event name typography. */
  readonly teamFontSize?: Screen1OverrideSize;
  /** KABINE column typography where the card renders dressing-room information. */
  readonly kabineFontSize?: Screen1OverrideSize;
  /** PLATZ column typography where the card renders pitch information. */
  readonly platzFontSize?: Screen1OverrideSize;
  /** Logo size where the card renders logos. */
  readonly logoSize?: Screen1OverrideSize;
  /**
   * Soft pagination preference — prefer starting this card on the next page
   * when capacity-safe and the captured predecessor context still matches.
   * Never an absolute page assignment; recomputed on every active-list change.
   */
  readonly preferNextPage?: boolean;
  /**
   * Stable keys of active predecessors at the time `preferNextPage` was set.
   * Keys follow `resolveDisplayItemKey()` — training cohorts remain date/time
   * scoped; event cards use canonical event ids. No page numbers or indices.
   */
  readonly softBreakAfterKeys?: readonly string[];
};

export type Screen1StudioConfig = {
  readonly cardOverrides: Readonly<Record<string, Screen1CardOverride>>;
};

export const EMPTY_SCREEN1_STUDIO_CONFIG: Screen1StudioConfig = {
  cardOverrides: {},
};

export function isScreen1OverrideSize(
  value: unknown,
): value is InfoboardFontSize {
  return typeof value === "string" && (INFOBOARD_FONT_SIZES as readonly string[]).includes(value);
}

function normalizeOverrideSize(value: unknown): Screen1OverrideSize | undefined {
  if (value === null) return null;
  if (isScreen1OverrideSize(value)) return value;
  return undefined;
}

function normalizeCardOverride(raw: unknown): Screen1CardOverride | null {
  if (raw == null || typeof raw !== "object") return null;
  const input = raw as Record<string, unknown>;
  const override: {
    teamFontSize?: Screen1OverrideSize;
    kabineFontSize?: Screen1OverrideSize;
    platzFontSize?: Screen1OverrideSize;
    logoSize?: Screen1OverrideSize;
    preferNextPage?: boolean;
    softBreakAfterKeys?: readonly string[];
  } = {};

  const teamFontSize = normalizeOverrideSize(input.teamFontSize);
  if (teamFontSize !== undefined) override.teamFontSize = teamFontSize;

  const kabineFontSize = normalizeOverrideSize(input.kabineFontSize);
  if (kabineFontSize !== undefined) override.kabineFontSize = kabineFontSize;

  const platzFontSize = normalizeOverrideSize(input.platzFontSize);
  if (platzFontSize !== undefined) override.platzFontSize = platzFontSize;

  const logoSize = normalizeOverrideSize(input.logoSize);
  if (logoSize !== undefined) override.logoSize = logoSize;

  if (typeof input.preferNextPage === "boolean") {
    override.preferNextPage = input.preferNextPage;
  }

  const rawSoftBreak = input.softBreakAfterKeys;
  if (Array.isArray(rawSoftBreak)) {
    const keys = rawSoftBreak.filter(
      (key): key is string => typeof key === "string" && key.trim() !== "",
    );
    if (keys.length > 0) {
      override.softBreakAfterKeys = keys;
    } else if (rawSoftBreak.length === 0) {
      override.softBreakAfterKeys = [];
    }
  }

  return Object.keys(override).length > 0 ? override : null;
}

/**
 * Parses persisted JSON into a validated Screen1StudioConfig.
 * Unknown keys and invalid values are dropped.
 */
export function parseScreen1StudioJson(
  value: string | null | undefined,
): Screen1StudioConfig {
  if (value == null || value.trim() === "") return EMPTY_SCREEN1_STUDIO_CONFIG;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed == null || typeof parsed !== "object") {
      return EMPTY_SCREEN1_STUDIO_CONFIG;
    }
    const rawOverrides = (parsed as { cardOverrides?: unknown }).cardOverrides;
    if (rawOverrides == null || typeof rawOverrides !== "object") {
      return EMPTY_SCREEN1_STUDIO_CONFIG;
    }
    const cardOverrides: Record<string, Screen1CardOverride> = {};
    for (const [key, raw] of Object.entries(rawOverrides)) {
      if (typeof key !== "string" || key.trim() === "") continue;
      const normalized = normalizeCardOverride(raw);
      if (normalized != null) cardOverrides[key] = normalized;
    }
    return { cardOverrides };
  } catch {
    return EMPTY_SCREEN1_STUDIO_CONFIG;
  }
}

export function serializeScreen1StudioConfig(
  config: Screen1StudioConfig,
): string {
  return JSON.stringify(config);
}

/** Returns true when the override has no effective properties. */
export function isEmptyCardOverride(override: Screen1CardOverride | undefined): boolean {
  if (override == null) return true;
  return (
    override.teamFontSize === undefined &&
    override.kabineFontSize === undefined &&
    override.platzFontSize === undefined &&
    override.logoSize === undefined &&
    override.preferNextPage !== true &&
    (override.softBreakAfterKeys == null || override.softBreakAfterKeys.length === 0)
  );
}

/** Removes soft pagination fields while preserving typography overrides. */
export function clearSoftPaginationOverride(
  override: Screen1CardOverride | undefined,
): Screen1CardOverride | undefined {
  if (override == null) return undefined;
  const {
    preferNextPage: _preferNextPage,
    softBreakAfterKeys: _softBreakAfterKeys,
    ...rest
  } = override;
  return Object.keys(rest).length > 0 ? rest : undefined;
}
