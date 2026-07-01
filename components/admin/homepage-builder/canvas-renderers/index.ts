"use client";

/**
 * components/admin/homepage-builder/canvas-renderers/index.ts
 *
 * Admin-only canvas preview renderer system for the Homepage Builder.
 *
 * Architecture:
 *   - CanvasPreviewContext  — React context for live preview data (media URLs)
 *   - CanvasSectionRenderer — main dispatcher; wraps all type-specific renderers
 *   - Type renderers        — lightweight admin-only previews per block type
 *
 * Rules:
 *   - These renderers are ADMIN-ONLY. They must NOT affect public website output.
 *   - Do NOT import or modify WebsiteSectionDispatcher or public block renderers.
 *   - Use existing layout-types tokens (THEME_TOKENS, GRADIENT_PRESETS, resolveLayout).
 *   - Previews are representative, not pixel-perfect. Focus on alignment, background,
 *     content structure, and key design choices.
 */

import { createContext } from "react";

// ---------------------------------------------------------------------------
// Canvas preview context — provides live media URLs to canvas renderers
// ---------------------------------------------------------------------------

export type CanvasPreviewState = {
  /** Maps mediaAssetId → ephemeral preview URL (session-local, not persisted). */
  previewUrls: Record<string, string>;
};

export const CanvasPreviewContext = createContext<CanvasPreviewState>({
  previewUrls: {},
});

// ---------------------------------------------------------------------------
// Renderer exports
// ---------------------------------------------------------------------------

export { CanvasSectionRenderer } from "./CanvasSectionRenderer";
export { CanvasHeroRenderer } from "./CanvasHeroRenderer";
export { CanvasCallToActionRenderer } from "./CanvasCallToActionRenderer";
export { CanvasSplitContentCardsRenderer } from "./CanvasSplitContentCardsRenderer";
export { CanvasDataDrivenRenderer } from "./CanvasDataDrivenRenderer";
