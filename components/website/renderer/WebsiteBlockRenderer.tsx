import type { WebsiteTheme } from "@/lib/website/theme-engine";
import type { PublicEventItem, PublicTeamItem } from "@/lib/website/public-queries";

import HeroBlock from "./blocks/HeroBlock";
import RichTextBlock from "./blocks/RichTextBlock";
import EventsListBlock from "./blocks/EventsListBlock";
import TeamGridBlock from "./blocks/TeamGridBlock";
import NewsGridBlock from "./blocks/NewsGridBlock";
import SponsorStripBlock from "./blocks/SponsorStripBlock";
import ContactBlock from "./blocks/ContactBlock";
import StatsBlock from "./blocks/StatsBlock";
import ImageBannerBlock from "./blocks/ImageBannerBlock";
import CtaBlock from "./blocks/CtaBlock";
import FeatureGridBlock from "./blocks/FeatureGridBlock";
import FaqBlock from "./blocks/FaqBlock";

type BlockShape = {
  id: string;
  type: string;
  props: Record<string, unknown>;
  sortOrder: number;
};

type Props = {
  blocks: BlockShape[];
  theme: WebsiteTheme;
  events: PublicEventItem[];
  teams: PublicTeamItem[];
};

export default function WebsiteBlockRenderer({ blocks, theme, events, teams }: Props) {
  return (
    <>
      {blocks.map((block) => {
        const p = block.props;
        switch (block.type) {
          case "HERO":
            return <HeroBlock key={block.id} props={p as never} theme={theme} />;
          case "RICH_TEXT":
          case "INTRO_TEXT":
            return <RichTextBlock key={block.id} props={p as never} theme={theme} />;
          case "EVENT_LIST":
          case "EVENTS_LIST":
            return (
              <EventsListBlock
                key={block.id}
                props={p as never}
                theme={theme}
                events={events.slice(0, Number(p.limit ?? 8))}
              />
            );
          case "TEAM_GRID":
            return (
              <TeamGridBlock
                key={block.id}
                props={p as never}
                theme={theme}
                teams={teams}
              />
            );
          case "NEWS_FEED":
          case "NEWS_GRID":
            return <NewsGridBlock key={block.id} props={p as never} theme={theme} />;
          case "SPONSORS_BAR":
          case "SPONSOR_STRIP":
            return <SponsorStripBlock key={block.id} props={p as never} theme={theme} />;
          case "CONTACT_INFO":
          case "CONTACT":
            return <ContactBlock key={block.id} props={p as never} theme={theme} />;
          case "STATS_ROW":
          case "STATS":
            return <StatsBlock key={block.id} props={p as never} theme={theme} />;
          case "FULL_WIDTH_IMAGE":
          case "IMAGE_BANNER":
            return <ImageBannerBlock key={block.id} props={p as never} theme={theme} />;
          case "REGISTRATION_CTA":
          case "CTA":
            return <CtaBlock key={block.id} props={p as never} theme={theme} />;
          case "FEATURE_GRID":
            return <FeatureGridBlock key={block.id} props={p as never} theme={theme} />;
          case "FAQ":
            return <FaqBlock key={block.id} props={p as never} theme={theme} />;
          case "DIVIDER":
            return (
              <hr key={block.id} className="mx-auto my-4 max-w-4xl" style={{ borderColor: theme.border }} />
            );
          default:
            return null;
        }
      })}
    </>
  );
}
