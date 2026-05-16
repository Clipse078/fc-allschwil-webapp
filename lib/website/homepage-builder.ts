import { getPublicSiteData, getPublicSponsors } from "@/lib/website/public-queries";
import { getPublicNewsList } from "@/lib/news/public-news-feed";
import { getPublicEvents } from "@/lib/events/public-event-feed";
import { getPublicTeamList } from "@/lib/website/team-queries";
import { resolveHomepageCTAs } from "@/lib/website/cta-system";
import type { PublicSiteData } from "@/lib/website/public-queries";
import type { ResolvedCTA } from "@/lib/website/cta-system";

export type HeroBlock = {
  type: "hero";
  name: string;
  tagline: string | null;
  primaryColor: string;
  logoUrl: string | null;
};

export type NewsBlock = {
  type: "news";
  articles: Array<{
    id: string;
    slug: string;
    siteId: string;
    locale: string;
    title: string;
    listingText: string | null;
    coverImageUrl: string | null;
    publishedAt: Date;
    authorName: string | null;
  }>;
};

export type EventsBlock = {
  type: "events";
  events: Array<{
    id: string;
    title: string;
    type: string;
    startAt: Date;
    location: string | null;
    opponentName: string | null;
    homeAway: string | null;
  }>;
};

export type TeamsBlock = {
  type: "teams";
  teams: Array<{
    id: string;
    slug: string;
    name: string;
    displayName: string | null;
    category: string;
    ageGroup: string | null;
  }>;
};

export type SponsorsBlock = {
  type: "sponsors";
  sponsors: Array<{
    id: string;
    name: string;
    logoUrl: string | null;
    websiteUrl: string | null;
    tier: string | null;
  }>;
};

export type CTAStripBlock = {
  type: "cta_strip";
  ctas: ResolvedCTA[];
};

export type HomepageBlock =
  | HeroBlock
  | NewsBlock
  | EventsBlock
  | TeamsBlock
  | SponsorsBlock
  | CTAStripBlock;

export type HomepageData = {
  tenantKey: string;
  site: PublicSiteData | null;
  blocks: HomepageBlock[];
};

export async function buildHomepageData(
  tenantKey: string
): Promise<HomepageData> {
  const [site, newsArticles, events, teams, sponsors] = await Promise.all([
    getPublicSiteData(tenantKey),
    getPublicNewsList(tenantKey, "de", 3).catch(() => []),
    getPublicEvents({
      surface: "all",
      dateFrom: new Date().toISOString().split("T")[0],
      limit: 5,
    }).catch(() => []),
    getPublicTeamList().catch(() => []),
    getPublicSponsors(tenantKey).catch(() => []),
  ]);

  const blocks: HomepageBlock[] = [];

  blocks.push({
    type: "hero",
    name: site?.name ?? tenantKey,
    tagline: site?.tagline ?? null,
    primaryColor: site?.primaryColor ?? "#0b4aa2",
    logoUrl: site?.logoUrl ?? null,
  });

  const homepageCTAs = resolveHomepageCTAs(tenantKey);
  if (homepageCTAs.length > 0) {
    blocks.push({ type: "cta_strip", ctas: homepageCTAs });
  }

  if (newsArticles.length > 0) {
    blocks.push({ type: "news", articles: newsArticles });
  }

  if (events.length > 0) {
    blocks.push({
      type: "events",
      events: events.map((e) => ({
        id: e.id,
        title: e.title,
        type: e.type,
        startAt: e.startAt,
        location: e.location,
        opponentName: e.opponentName,
        homeAway: e.homeAway,
      })),
    });
  }

  const featuredTeams = teams.slice(0, 6);
  if (featuredTeams.length > 0) {
    blocks.push({ type: "teams", teams: featuredTeams });
  }

  if (sponsors.length > 0) {
    blocks.push({ type: "sponsors", sponsors });
  }

  return { tenantKey, site, blocks };
}
