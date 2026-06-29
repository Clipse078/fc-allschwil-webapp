"use client";

/**
 * components/website/blocks/index.ts
 *
 * Block renderer registry — maps every block type key to its React renderer.
 *
 * This is the single dispatch table for rendering CMS sections in:
 *   - Admin Live Preview Canvas
 *   - Public website (imports these components directly)
 *   - Any future preview surface
 *
 * Rules:
 *   - All renderer components must accept { config, previewMode? } props.
 *   - Only add renderers that are safe for both admin preview AND public website.
 *   - Never import admin-only modules here.
 *   - When a full renderer replaces a generic one, update the map here only.
 */

import type { ComponentType } from "react";
import SplitContentCardsRenderer from "./SplitContentCardsRenderer";
import {
  HeroRenderer,
  NewsTeaserRenderer,
  EventsTeaserRenderer,
  TeamsTeaserRenderer,
  WeekplanTeaserRenderer,
  CallToActionRenderer,
  SponsorsTeaserRenderer,
  CustomContentPlaceholderRenderer,
} from "./GenericBlockRenderer";

export type BlockRendererProps = {
  config: Record<string, unknown>;
  previewMode?: boolean;
};

export type BlockRendererComponent = ComponentType<BlockRendererProps>;

/**
 * Map from block type key → renderer component.
 * Keyed by the same type strings stored in HomepageSection.type / WebsitePageSection.type.
 */
export const BLOCK_RENDERERS: Record<string, BlockRendererComponent> = {
  hero: HeroRenderer,
  newsTeaser: NewsTeaserRenderer,
  eventsTeaser: EventsTeaserRenderer,
  teamsTeaser: TeamsTeaserRenderer,
  weekplanTeaser: WeekplanTeaserRenderer,
  callToAction: CallToActionRenderer,
  sponsorsTeaser: SponsorsTeaserRenderer,
  splitContentCards: SplitContentCardsRenderer,
  customContentPlaceholder: CustomContentPlaceholderRenderer,
};

/**
 * Resolves the renderer component for a given block type.
 * Returns null when no renderer is registered (unknown type).
 */
export function getBlockRenderer(type: string): BlockRendererComponent | null {
  return BLOCK_RENDERERS[type] ?? null;
}
