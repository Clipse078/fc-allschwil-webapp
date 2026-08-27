/**
 * Resolves effective per-card Screen-1 presentation from global settings
 * and optional Studio card overrides.
 *
 * effectiveValue = cardOverride ?? relevantGlobalPresentationSetting
 */

import type { DisplayItem } from "@/components/infoboard/screen1/InfoboardScreen1";
import {
  DEFAULT_MATCH_FONT_SIZE,
  DEFAULT_TOURNAMENT_FONT_SIZE,
  DEFAULT_TRAINING_FONT_SIZE,
  FONT_SIZE_CAPACITY_SCALE,
  LOGO_SIZE_CAPACITY_SCALE,
  type InfoboardFontSize,
  type InfoboardLogoSize,
  type Screen1PresentationConfig,
} from "./screen1-logo-settings";
import { resolveDisplayItemKey } from "./screen1-studio-keys";
import type { Screen1CardOverride, Screen1StudioConfig } from "./screen1-studio-types";

export type ResolvedTrainingCardPresentation = {
  readonly teamFontSize: InfoboardFontSize;
  readonly kabineFontSize: InfoboardFontSize;
  readonly platzFontSize: InfoboardFontSize;
  readonly logoSize: InfoboardLogoSize;
  readonly showLogos: boolean;
};

export type ResolvedMatchCardPresentation = {
  readonly teamFontSize: InfoboardFontSize;
  readonly logoSize: InfoboardLogoSize;
  readonly showLogos: boolean;
};

export type ResolvedTournamentCardPresentation = {
  readonly teamFontSize: InfoboardFontSize;
  readonly logoSize: InfoboardLogoSize;
  readonly showLogos: boolean;
};

export type ResolvedCardPresentation =
  | { readonly kind: "training"; readonly presentation: ResolvedTrainingCardPresentation }
  | { readonly kind: "match"; readonly presentation: ResolvedMatchCardPresentation }
  | { readonly kind: "tournament"; readonly presentation: ResolvedTournamentCardPresentation }
  | { readonly kind: "other"; readonly presentation: ResolvedMatchCardPresentation };

function resolveSize(
  override: InfoboardFontSize | null | undefined,
  global: InfoboardFontSize,
): InfoboardFontSize {
  return override ?? global;
}

function getCardOverride(
  item: DisplayItem,
  studio: Screen1StudioConfig | null | undefined,
): Screen1CardOverride | undefined {
  if (studio == null) return undefined;
  return studio.cardOverrides[resolveDisplayItemKey(item)];
}

export function resolveTrainingCardPresentation(
  global: Screen1PresentationConfig,
  override: Screen1CardOverride | undefined,
): ResolvedTrainingCardPresentation {
  return {
    teamFontSize: resolveSize(override?.teamFontSize, global.trainingFontSize),
    kabineFontSize: resolveSize(override?.kabineFontSize, global.trainingFontSize),
    platzFontSize: resolveSize(override?.platzFontSize, global.trainingFontSize),
    logoSize: resolveSize(override?.logoSize, global.trainingLogoSize),
    showLogos: global.trainingShowLogos,
  };
}

export function resolveMatchCardPresentation(
  global: Screen1PresentationConfig,
  override: Screen1CardOverride | undefined,
): ResolvedMatchCardPresentation {
  return {
    teamFontSize: resolveSize(override?.teamFontSize, global.matchFontSize),
    logoSize: resolveSize(override?.logoSize, global.matchLogoSize),
    showLogos: global.matchShowLogos,
  };
}

export function resolveTournamentCardPresentation(
  global: Screen1PresentationConfig,
  override: Screen1CardOverride | undefined,
): ResolvedTournamentCardPresentation {
  return {
    teamFontSize: resolveSize(override?.teamFontSize, global.tournamentFontSize),
    logoSize: resolveSize(override?.logoSize, global.tournamentLogoSize),
    showLogos: global.tournamentShowLogos,
  };
}

export function resolveCardPresentation(
  item: DisplayItem,
  global: Screen1PresentationConfig,
  studio: Screen1StudioConfig | null | undefined,
): ResolvedCardPresentation {
  const override = getCardOverride(item, studio);
  if (item.kind === "training-group") {
    return {
      kind: "training",
      presentation: resolveTrainingCardPresentation(global, override),
    };
  }
  const eventType = item.item.event.type;
  if (eventType === "MATCH") {
    return {
      kind: "match",
      presentation: resolveMatchCardPresentation(global, override),
    };
  }
  if (eventType === "TOURNAMENT") {
    return {
      kind: "tournament",
      presentation: resolveTournamentCardPresentation(global, override),
    };
  }
  return {
    kind: "other",
    presentation: resolveMatchCardPresentation(global, override),
  };
}

/**
 * Scales semantic card demand based on effective font/logo overrides.
 * Larger typography increases demand so pagination accommodates presentation.
 */
export function resolveCardDemandScale(
  item: DisplayItem,
  global: Screen1PresentationConfig,
  studio: Screen1StudioConfig | null | undefined,
): number {
  const resolved = resolveCardPresentation(item, global, studio);
  const scales: number[] = [];

  if (resolved.kind === "training") {
    const p = resolved.presentation;
    scales.push(FONT_SIZE_CAPACITY_SCALE[p.teamFontSize]);
    scales.push(FONT_SIZE_CAPACITY_SCALE[p.kabineFontSize]);
    scales.push(FONT_SIZE_CAPACITY_SCALE[p.platzFontSize]);
    if (p.showLogos) scales.push(LOGO_SIZE_CAPACITY_SCALE[p.logoSize]);
    return Math.max(...scales);
  }

  if (resolved.kind === "match" || resolved.kind === "other") {
    const p = resolved.presentation;
    scales.push(FONT_SIZE_CAPACITY_SCALE[p.teamFontSize]);
    if (p.showLogos) scales.push(LOGO_SIZE_CAPACITY_SCALE[p.logoSize]);
    return Math.max(...scales);
  }

  if (resolved.kind === "tournament") {
    const p = resolved.presentation;
    scales.push(FONT_SIZE_CAPACITY_SCALE[p.teamFontSize]);
    if (p.showLogos) scales.push(LOGO_SIZE_CAPACITY_SCALE[p.logoSize]);
    return Math.max(...scales);
  }

  return 1;
}

/** Baseline global defaults for tests without a full presentation object. */
export const BASELINE_GLOBAL_FONT_DEFAULTS = {
  training: DEFAULT_TRAINING_FONT_SIZE,
  match: DEFAULT_MATCH_FONT_SIZE,
  tournament: DEFAULT_TOURNAMENT_FONT_SIZE,
} as const;
