"use client";

/**
 * components/website/WebsiteSectionDispatcher.tsx
 *
 * Central dispatcher that maps CMS section types to their renderer components.
 *
 * PURPOSE
 *   The WebsiteSectionDispatcher is the single entry point for rendering any
 *   CMS section on the public website. Given a section object (from the homepage
 *   or page-layout API) and optional live data props, it routes to the correct
 *   renderer component.
 *
 * USAGE (public website)
 *
 *   import WebsiteSectionDispatcher from "@/components/website/WebsiteSectionDispatcher";
 *
 *   // sections from GET /api/public/{tenant}/website/homepage
 *   sections.map((section) => (
 *     <WebsiteSectionDispatcher
 *       key={section.id}
 *       section={section}
 *       articles={newsData?.articles}
 *       teams={teamsData?.teams}
 *       events={eventsData?.events}
 *       weekplan={weekplanData}
 *     />
 *   ))
 *
 * DATA-DRIVEN BLOCKS
 *   For data-driven block types, the public website must fetch live data from
 *   the corresponding API endpoint and pass it via the matching prop:
 *   - newsTeaser    → articles  (GET .../website/news)
 *   - teamsTeaser   → teams     (GET .../website/teams)
 *   - sponsorsTeaser→ sponsors  (GET .../website/sponsors)
 *   - eventsTeaser  → events    (GET .../website/events?surface=...)
 *   - weekplanTeaser→ weekplan  (GET .../website/weekplan?weekId=...)
 *
 * RENDERER MAPPING
 *   hero              → HeroRenderer
 *   newsTeaser        → NewsTeaserRenderer
 *   teamsTeaser       → TeamsTeaserRenderer
 *   sponsorsTeaser    → SponsorsTeaserRenderer
 *   splitContentCards → SplitContentCardsRenderer
 *   callToAction      → CallToActionRenderer
 *   eventsTeaser      → EventsTeaserRenderer
 *   weekplanTeaser    → WeekplanTeaserRenderer
 *   (all others)      → null (unknown block types render nothing)
 *
 * SAFETY
 *   Unknown block types are silently skipped (return null).
 *   The `previewMode` prop is forwarded to every renderer for admin previews.
 */

import HeroRenderer from "@/components/website/blocks/HeroRenderer";
import NewsTeaserRenderer, {
  type NewsArticle,
} from "@/components/website/blocks/NewsTeaserRenderer";
import TeamsTeaserRenderer, {
  type TeamItem,
} from "@/components/website/blocks/TeamsTeaserRenderer";
import SponsorsTeaserRenderer, {
  type SponsorItem,
} from "@/components/website/blocks/SponsorsTeaserRenderer";
import SplitContentCardsRenderer from "@/components/website/blocks/SplitContentCardsRenderer";
import CallToActionRenderer from "@/components/website/blocks/CallToActionRenderer";
import EventsTeaserRenderer, {
  type EventTeaserItem,
} from "@/components/website/blocks/EventsTeaserRenderer";
import WeekplanTeaserRenderer, {
  type WeekplanTeaserData,
} from "@/components/website/blocks/WeekplanTeaserRenderer";

// ---------------------------------------------------------------------------
// Section shape (matches WebsitePublicSection from integration-contract.ts)
// ---------------------------------------------------------------------------

type DispatchSection = {
  id: string;
  type: string;
  config: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type WebsiteSectionDispatcherProps = {
  /** CMS section from the homepage or page-layout API. */
  section: DispatchSection;
  /** Live news articles — required for newsTeaser blocks. */
  articles?: NewsArticle[];
  /** Live team list — required for teamsTeaser blocks. */
  teams?: TeamItem[];
  /** Live sponsor list — required for sponsorsTeaser blocks. */
  sponsors?: SponsorItem[];
  /** Live events — required for eventsTeaser blocks. */
  events?: EventTeaserItem[];
  /** Live weekplan — required for weekplanTeaser blocks. */
  weekplan?: WeekplanTeaserData;
  /** When true, renders admin preview borders and block-type labels. */
  previewMode?: boolean;
};

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export default function WebsiteSectionDispatcher({
  section,
  articles,
  teams,
  sponsors,
  events,
  weekplan,
  previewMode = false,
}: WebsiteSectionDispatcherProps) {
  const { type, config } = section;

  switch (type) {
    case "hero":
      return <HeroRenderer config={config} previewMode={previewMode} />;

    case "newsTeaser":
      return (
        <NewsTeaserRenderer
          config={config}
          articles={articles}
          previewMode={previewMode}
        />
      );

    case "teamsTeaser":
      return (
        <TeamsTeaserRenderer
          config={config}
          teams={teams}
          previewMode={previewMode}
        />
      );

    case "sponsorsTeaser":
      return (
        <SponsorsTeaserRenderer
          config={config}
          sponsors={sponsors}
          previewMode={previewMode}
        />
      );

    case "splitContentCards":
      return (
        <SplitContentCardsRenderer config={config} previewMode={previewMode} />
      );

    case "callToAction":
      return (
        <CallToActionRenderer config={config} previewMode={previewMode} />
      );

    case "eventsTeaser":
      return (
        <EventsTeaserRenderer
          config={config}
          events={events}
          previewMode={previewMode}
        />
      );

    case "weekplanTeaser":
      return (
        <WeekplanTeaserRenderer
          config={config}
          weekplan={weekplan}
          previewMode={previewMode}
        />
      );

    default:
      return null;
  }
}
