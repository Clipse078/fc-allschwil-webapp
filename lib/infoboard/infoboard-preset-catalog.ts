export type InfoboardMode = "LIGHT" | "DARK" | "AUTO";
export type SponsorVisibility = "none" | "subtle" | "standard" | "prominent";
export type ScheduleDensity = "minimal" | "compact" | "full";

export type InfoboardPreset = {
  key: string;
  name: string;
  mode: InfoboardMode;
  description: string;
  bestUseCase: string;
  recommendedScreens: string[];
  layoutRhythm: string;
  sponsorVisibilityLevel: SponsorVisibility;
  scheduleDensity: ScheduleDensity;
  alertAnnouncementSupport: boolean;
  previewTokens?: Record<string, string>;
};

export const INFOBOARD_PRESETS: InfoboardPreset[] = [
  {
    key: "clean-light",
    name: "Clean Light",
    mode: "LIGHT",
    description: "Helles, übersichtliches Layout für gut beleuchtete Räume und Eingangsbereiche.",
    bestUseCase: "Reception, club house entrance, bright rooms",
    recommendedScreens: ["schedule", "news", "sponsors"],
    layoutRhythm: "header → today-schedule → upcoming-events → news-ticker",
    sponsorVisibilityLevel: "standard",
    scheduleDensity: "compact",
    alertAnnouncementSupport: true,
    previewTokens: { bg: "#ffffff", text: "#1e293b", accent: "#0b4aa2" },
  },
  {
    key: "clean-dark",
    name: "Clean Dark",
    mode: "DARK",
    description: "Dunkles, elegantes Layout für Trainingsräume und abgedunkelte Bildschirme.",
    bestUseCase: "Gym, training hall, low-light areas",
    recommendedScreens: ["schedule", "next-training", "team-info"],
    layoutRhythm: "header → next-event → today-schedule → news-ticker",
    sponsorVisibilityLevel: "subtle",
    scheduleDensity: "compact",
    alertAnnouncementSupport: true,
    previewTokens: { bg: "#0f172a", text: "#f1f5f9", accent: "#38bdf8" },
  },
  {
    key: "matchday-dark",
    name: "Matchday Dark",
    mode: "DARK",
    description: "Dramatisches dunkles Layout für Spieltage mit Fokus auf Match-Infos und Ergebnisse.",
    bestUseCase: "Stadium, match venue, fan areas",
    recommendedScreens: ["matchday-schedule", "live-score", "lineup", "sponsors"],
    layoutRhythm: "fullscreen-hero → match-details → score → lineups → sponsors-bar",
    sponsorVisibilityLevel: "prominent",
    scheduleDensity: "minimal",
    alertAnnouncementSupport: true,
    previewTokens: { bg: "#0a0a0a", text: "#ffffff", accent: "#22c55e" },
  },
  {
    key: "sponsor-premium",
    name: "Sponsor Premium",
    mode: "AUTO",
    description: "Hochwertiges Layout mit prominenter Sponsorenpräsenz für Business-Club-Umgebungen.",
    bestUseCase: "VIP lounge, hospitality area, sponsor events",
    recommendedScreens: ["sponsors", "schedule", "news", "stats"],
    layoutRhythm: "logo-bar → split-schedule-sponsor → news-ticker → full-sponsor-screen",
    sponsorVisibilityLevel: "prominent",
    scheduleDensity: "compact",
    alertAnnouncementSupport: false,
    previewTokens: { bg: "#1c1c1c", text: "#f5f5f5", accent: "#c9a227" },
  },
  {
    key: "youth-friendly",
    name: "Youth Friendly",
    mode: "LIGHT",
    description: "Farbenfroher, kinderfreundlicher Auftritt für Juniorenräume und Trainingsbereiche.",
    bestUseCase: "Youth training room, school club, kids area",
    recommendedScreens: ["schedule", "team-news", "next-training"],
    layoutRhythm: "colourful-header → today-schedule → team-of-the-week → news",
    sponsorVisibilityLevel: "none",
    scheduleDensity: "compact",
    alertAnnouncementSupport: false,
    previewTokens: { bg: "#fffbeb", text: "#1c1917", accent: "#f59e0b" },
  },
  {
    key: "operations-board",
    name: "Operations Board",
    mode: "LIGHT",
    description: "Informationsdichtes Layout für Betriebsräume mit vollständiger Tagesagenda.",
    bestUseCase: "Admin office, operations room, staff area",
    recommendedScreens: ["full-schedule", "pitch-allocation", "roles", "announcements"],
    layoutRhythm: "date-header → full-day-schedule → pitch-grid → staff-notes",
    sponsorVisibilityLevel: "none",
    scheduleDensity: "full",
    alertAnnouncementSupport: true,
    previewTokens: { bg: "#f8fafc", text: "#0f172a", accent: "#334155" },
  },
  {
    key: "minimal-schedule",
    name: "Minimal Schedule",
    mode: "AUTO",
    description: "Maximal reduziertes Layout das nur die wichtigsten Termininfos zeigt.",
    bestUseCase: "Corridor screen, secondary display, kiosk",
    recommendedScreens: ["next-3-events", "date-time"],
    layoutRhythm: "large-clock → next-events-list",
    sponsorVisibilityLevel: "none",
    scheduleDensity: "minimal",
    alertAnnouncementSupport: false,
    previewTokens: { bg: "#ffffff", text: "#111827", accent: "#6b7280" },
  },
  {
    key: "club-tv",
    name: "Club TV",
    mode: "DARK",
    description: "TV-ähnliches Layout mit automatischer Rotation für Eingangsbereiche und Lounges.",
    bestUseCase: "Main display, entrance TV, waiting area",
    recommendedScreens: ["schedule", "news", "sponsors", "team-highlights", "stats"],
    layoutRhythm: "rotating-hero → news-panel → schedule-strip → sponsor-ticker",
    sponsorVisibilityLevel: "standard",
    scheduleDensity: "compact",
    alertAnnouncementSupport: true,
    previewTokens: { bg: "#111827", text: "#f9fafb", accent: "#3b82f6" },
  },
  {
    key: "tournament-mode",
    name: "Tournament Mode",
    mode: "AUTO",
    description: "Turnieroptimiertes Layout mit Bracket-Support und Gruppenstand.",
    bestUseCase: "Tournament venue, multiple courts, event day",
    recommendedScreens: ["bracket", "group-standings", "next-matches", "results"],
    layoutRhythm: "tournament-header → bracket-display → results-stream → sponsors-bar",
    sponsorVisibilityLevel: "standard",
    scheduleDensity: "full",
    alertAnnouncementSupport: true,
    previewTokens: { bg: "#0c1a2e", text: "#e2e8f0", accent: "#f59e0b" },
  },
  {
    key: "emergency-announcement",
    name: "Emergency / Announcement Mode",
    mode: "AUTO",
    description: "Auffälliges Layout für Notfallmeldungen und wichtige Vereinsmitteilungen.",
    bestUseCase: "Club-wide announcements, emergency info, urgent updates",
    recommendedScreens: ["alert-message", "contact-info"],
    layoutRhythm: "fullscreen-alert → message-body → contact-strip",
    sponsorVisibilityLevel: "none",
    scheduleDensity: "minimal",
    alertAnnouncementSupport: true,
    previewTokens: { bg: "#7f1d1d", text: "#fef2f2", accent: "#ef4444" },
  },
];

export function getInfoboardPresetByKey(key: string): InfoboardPreset | undefined {
  return INFOBOARD_PRESETS.find((p) => p.key === key);
}

export const INFOBOARD_MODE_LABELS: Record<InfoboardMode, string> = {
  LIGHT: "Hell",
  DARK: "Dunkel",
  AUTO: "Automatisch",
};
