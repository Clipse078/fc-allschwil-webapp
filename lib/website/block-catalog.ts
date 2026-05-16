export type WebsiteBlockCategory =
  | "hero"
  | "content"
  | "media"
  | "data"
  | "navigation"
  | "utility";

export type WebsiteBlockDef = {
  type: string;
  label: string;
  description: string;
  category: WebsiteBlockCategory;
  icon: string;
  defaultProps: Record<string, unknown>;
};

export const BLOCK_CATALOG: WebsiteBlockDef[] = [
  {
    type: "HERO",
    label: "Hero",
    description: "Grosser Einstiegsbereich mit Titel, Untertitel und Call-to-Action.",
    category: "hero",
    icon: "layout",
    defaultProps: {
      title: "",
      subtitle: "",
      ctaLabel: "",
      ctaHref: "",
      backgroundImage: null,
    },
  },
  {
    type: "INTRO_TEXT",
    label: "Einleitung",
    description: "Kurzer Willkommenstext oder Beschreibung für den Seitenstart.",
    category: "content",
    icon: "type",
    defaultProps: { heading: "", body: "" },
  },
  {
    type: "RICH_TEXT",
    label: "Fliesstext",
    description: "Freier Fliesstext mit Überschriften, Listen und Links.",
    category: "content",
    icon: "file-text",
    defaultProps: { html: "" },
  },
  {
    type: "IMAGE_TEXT",
    label: "Bild & Text",
    description: "Bild mit begleitendem Text, wahlweise links oder rechts.",
    category: "media",
    icon: "image",
    defaultProps: { imageSrc: "", imageAlt: "", text: "", layout: "image-left" },
  },
  {
    type: "FULL_WIDTH_IMAGE",
    label: "Vollbreites Bild",
    description: "Ganzseitiges Bannerbild mit optionaler Bildunterschrift.",
    category: "media",
    icon: "monitor",
    defaultProps: { imageSrc: "", imageAlt: "", caption: "" },
  },
  {
    type: "NEWS_FEED",
    label: "News-Feed",
    description: "Zeigt die neuesten News-Beiträge aus dem System.",
    category: "data",
    icon: "newspaper",
    defaultProps: { limit: 3, showImages: true },
  },
  {
    type: "EVENT_LIST",
    label: "Veranstaltungen",
    description: "Zeigt bevorstehende Events aus dem Saisonplanner.",
    category: "data",
    icon: "calendar",
    defaultProps: { limit: 5, showPastEvents: false },
  },
  {
    type: "TEAM_GRID",
    label: "Team-Übersicht",
    description: "Kacheldarstellung aller aktiven Teams.",
    category: "data",
    icon: "users",
    defaultProps: { showCategory: true, linkToDetail: true },
  },
  {
    type: "SPONSORS_BAR",
    label: "Sponsorenzeile",
    description: "Horizontale Logozeile für Sponsoren und Partner.",
    category: "data",
    icon: "award",
    defaultProps: { logos: [] as { name: string; imageSrc: string; href?: string }[] },
  },
  {
    type: "STATS_ROW",
    label: "Statistik-Zeile",
    description: "Kompakte Kennzahlen wie Mitglieder, Teams, Jahre.",
    category: "data",
    icon: "bar-chart-2",
    defaultProps: { stats: [] as { label: string; value: string }[] },
  },
  {
    type: "CONTACT_INFO",
    label: "Kontaktdaten",
    description: "Adresse, Telefon, E-Mail und optionale Karte.",
    category: "utility",
    icon: "map-pin",
    defaultProps: { address: "", phone: "", email: "", mapEmbedUrl: "" },
  },
  {
    type: "REGISTRATION_CTA",
    label: "Anmeldung CTA",
    description: "Call-to-Action-Bereich für Mitglied- oder Schnupperanmeldungen.",
    category: "utility",
    icon: "user-plus",
    defaultProps: { heading: "", body: "", ctaLabel: "Jetzt anmelden", ctaHref: "" },
  },
  {
    type: "DIVIDER",
    label: "Trennlinie",
    description: "Horizontale Trennlinie zwischen Abschnitten.",
    category: "utility",
    icon: "minus",
    defaultProps: { spacing: "md" },
  },
];

export function getBlockDef(type: string): WebsiteBlockDef | undefined {
  return BLOCK_CATALOG.find((b) => b.type === type);
}

export function getBlocksByCategory(
  category: WebsiteBlockCategory,
): WebsiteBlockDef[] {
  return BLOCK_CATALOG.filter((b) => b.category === category);
}
