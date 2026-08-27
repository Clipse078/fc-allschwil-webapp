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
  /** Training KABINE column typography (training cohorts only). */
  readonly kabineFontSize?: Screen1OverrideSize;
  /** Training PLATZ column typography (training cohorts only). */
  readonly platzFontSize?: Screen1OverrideSize;
  /** Logo size where the card renders logos. */
  readonly logoSize?: Screen1OverrideSize;
  /**
   * Soft pagination preference — prefer starting this card on the next page
   * when capacity-safe and preceding active content exists. Never an absolute
   * page assignment; recomputed on every active-list change.
   */
  readonly preferNextPage?: boolean;
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
    override.preferNextPage !== true
  );
}
