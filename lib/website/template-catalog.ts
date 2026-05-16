import { WebsitePageType } from "@prisma/client";

export type WebsiteTemplateBlock = {
  type: string;
  props?: Record<string, unknown>;
};

export type WebsiteTemplate = {
  key: string;
  pageType: WebsitePageType;
  label: string;
  description: string;
  sport: "all" | "football" | string;
  suggestedBlocks: WebsiteTemplateBlock[];
  sortOrder: number;
};

export const TEMPLATE_CATALOG: WebsiteTemplate[] = [
  {
    key: "homepage-standard",
    pageType: "HOMEPAGE",
    label: "Homepage",
    description: "Einstiegsseite mit Hero, Newsfeed, Events und Teamübersicht.",
    sport: "all",
    suggestedBlocks: [
      { type: "HERO" },
      { type: "STATS_ROW" },
      { type: "NEWS_FEED", props: { limit: 3 } },
      { type: "EVENT_LIST", props: { limit: 5 } },
      { type: "TEAM_GRID" },
      { type: "SPONSORS_BAR" },
    ],
    sortOrder: 1,
  },
  {
    key: "teams-overview",
    pageType: "TEAMS_OVERVIEW",
    label: "Teams Übersicht",
    description: "Alle aktiven Mannschaften nach Kategorie.",
    sport: "all",
    suggestedBlocks: [
      { type: "INTRO_TEXT" },
      { type: "TEAM_GRID" },
    ],
    sortOrder: 2,
  },
  {
    key: "team-detail",
    pageType: "TEAM_DETAIL",
    label: "Team-Detailseite",
    description: "Einzelne Mannschaft mit Kader, Trainer und Events.",
    sport: "all",
    suggestedBlocks: [
      { type: "INTRO_TEXT" },
      { type: "IMAGE_TEXT" },
      { type: "EVENT_LIST", props: { limit: 5 } },
    ],
    sortOrder: 3,
  },
  {
    key: "club-about",
    pageType: "CLUB_ABOUT",
    label: "Über den Verein",
    description: "Geschichte, Mission, Werte und Highlights des Vereins.",
    sport: "all",
    suggestedBlocks: [
      { type: "INTRO_TEXT" },
      { type: "RICH_TEXT" },
      { type: "IMAGE_TEXT" },
      { type: "STATS_ROW" },
    ],
    sortOrder: 4,
  },
  {
    key: "contact",
    pageType: "CONTACT",
    label: "Kontakt",
    description: "Kontaktdaten, Anfahrt und Ansprechpartner.",
    sport: "all",
    suggestedBlocks: [
      { type: "INTRO_TEXT" },
      { type: "CONTACT_INFO" },
    ],
    sortOrder: 5,
  },
  {
    key: "registration",
    pageType: "REGISTRATION",
    label: "Anmeldung",
    description: "Mitgliedschaft und Schnuppertraining beantragen.",
    sport: "all",
    suggestedBlocks: [
      { type: "INTRO_TEXT" },
      { type: "REGISTRATION_CTA" },
      { type: "RICH_TEXT" },
      { type: "CONTACT_INFO" },
    ],
    sortOrder: 6,
  },
  {
    key: "news-overview",
    pageType: "NEWS_OVERVIEW",
    label: "News Übersicht",
    description: "Alle Beiträge chronologisch aufgelistet.",
    sport: "all",
    suggestedBlocks: [
      { type: "INTRO_TEXT" },
      { type: "NEWS_FEED", props: { limit: 10 } },
    ],
    sortOrder: 7,
  },
  {
    key: "news-detail",
    pageType: "NEWS_DETAIL",
    label: "News Artikel",
    description: "Einzelner Beitrag mit Bild, Text und verwandten Artikeln.",
    sport: "all",
    suggestedBlocks: [
      { type: "FULL_WIDTH_IMAGE" },
      { type: "RICH_TEXT" },
    ],
    sortOrder: 8,
  },
  {
    key: "events-overview",
    pageType: "EVENTS_OVERVIEW",
    label: "Veranstaltungen",
    description: "Alle bevorstehenden Vereinsanlässe in der Übersicht.",
    sport: "all",
    suggestedBlocks: [
      { type: "INTRO_TEXT" },
      { type: "EVENT_LIST", props: { limit: 20 } },
    ],
    sortOrder: 9,
  },
  {
    key: "sponsors-partners",
    pageType: "SPONSORS_PARTNERS",
    label: "Sponsoren & Partner",
    description: "Alle Sponsoren und Vereinspartner mit Logos.",
    sport: "all",
    suggestedBlocks: [
      { type: "INTRO_TEXT" },
      { type: "SPONSORS_BAR" },
      { type: "REGISTRATION_CTA", props: { heading: "Werden Sie Partner", ctaLabel: "Kontakt aufnehmen" } },
    ],
    sortOrder: 10,
  },
  {
    key: "legal-imprint",
    pageType: "LEGAL",
    label: "Impressum / Datenschutz",
    description: "Rechtliche Pflichtseiten.",
    sport: "all",
    suggestedBlocks: [
      { type: "RICH_TEXT" },
    ],
    sortOrder: 11,
  },
];

export function getTemplateByKey(key: string): WebsiteTemplate | undefined {
  return TEMPLATE_CATALOG.find((t) => t.key === key);
}

export function getTemplatesByPageType(pageType: WebsitePageType): WebsiteTemplate[] {
  return TEMPLATE_CATALOG.filter((t) => t.pageType === pageType);
}

export const PAGE_TYPE_LABELS: Record<WebsitePageType, string> = {
  HOMEPAGE: "Homepage",
  TEAMS_OVERVIEW: "Teams Übersicht",
  TEAM_DETAIL: "Team-Detailseite",
  CLUB_ABOUT: "Über den Verein",
  CONTACT: "Kontakt",
  REGISTRATION: "Anmeldung",
  NEWS_OVERVIEW: "News Übersicht",
  NEWS_DETAIL: "News Artikel",
  EVENTS_OVERVIEW: "Veranstaltungen",
  SPONSORS_PARTNERS: "Sponsoren & Partner",
  LEGAL: "Impressum / Datenschutz",
  CUSTOM: "Eigene Seite",
};
