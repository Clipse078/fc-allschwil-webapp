"use client";

/**
 * components/admin/homepage-builder/canvas-renderers/CanvasSectionRenderer.tsx
 *
 * Admin-only canvas section dispatcher.
 *
 * Wraps the appropriate type-specific canvas renderer inside a common admin
 * chrome frame (preview badge, overflow guard). Used by HomepageCanvasSection
 * to replace the abstract card list with a real visual preview surface.
 *
 * Rules:
 *   - ADMIN-ONLY. Must not affect public website output.
 *   - Does NOT import WebsiteSectionDispatcher or public block renderers.
 *   - Receives merged config (saved + inspector draft) from the parent.
 */

import type { HomepageSectionAdminItem } from "@/lib/homepage/admin-queries";
import { CanvasHeroRenderer } from "./CanvasHeroRenderer";
import { CanvasCallToActionRenderer } from "./CanvasCallToActionRenderer";
import { CanvasSplitContentCardsRenderer } from "./CanvasSplitContentCardsRenderer";
import { CanvasDataDrivenRenderer } from "./CanvasDataDrivenRenderer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = {
  section: HomepageSectionAdminItem;
};

// ---------------------------------------------------------------------------
// CanvasSectionRenderer
// ---------------------------------------------------------------------------

export function CanvasSectionRenderer({ section }: Props) {
  const config = (section.config ?? {}) as Record<string, unknown>;

  let content: React.ReactNode;

  switch (section.type) {
    case "hero":
      content = <CanvasHeroRenderer config={config} />;
      break;
    case "callToAction":
      content = <CanvasCallToActionRenderer config={config} />;
      break;
    case "splitContentCards":
      content = <CanvasSplitContentCardsRenderer config={config} />;
      break;
    case "newsTeaser":
    case "eventsTeaser":
    case "teamsTeaser":
    case "sponsorsTeaser":
    case "weekplanTeaser":
    case "customContentPlaceholder":
    default:
      content = (
        <CanvasDataDrivenRenderer type={section.type} config={config} />
      );
      break;
  }

  return (
    <div className="relative overflow-hidden rounded-b-xl">
      {/* Preview badge */}
      <div className="absolute top-2 right-2 z-10">
        <span className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-sm px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-[var(--muted)]">
          Vorschau
        </span>
      </div>

      {content}
    </div>
  );
}
