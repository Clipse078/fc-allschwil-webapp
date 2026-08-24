/**
 * lib/infoboard/types.ts
 *
 * Shared type definitions for the Infoboard V2 module.
 *
 * These mirror the Prisma Infoboard model shape but are plain TypeScript
 * so they can be used in both server and client contexts without importing
 * Prisma types directly.
 */

export type InfoboardStatusValue = "ACTIVE" | "DISABLED" | "DRAFT";
export type InfoboardTemplateType = "TAGESUEBERSICHT" | "ANLAGENUEBERSICHT";

export type InboardRow = {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  status: InfoboardStatusValue;
  templateType: string;
  displayTheme: string | null;
  headerSubtitleEnabled: boolean;
  headerSubtitleText: string | null;
  headerShowTime: boolean;
  headerShowDate: boolean;
  headerShowWeather: boolean;
  announcementEnabled: boolean;
  announcementText: string | null;
  announcementBgColor: string | null;
  announcementTextColor: string | null;
  /** Designer layout JSON (InboardLayout v1). null = use default derived from flat fields. */
  layoutJson: string | null;
  /** Anlageplan: Vercel Blob CDN URL of the background site-plan image. null = not uploaded. */
  anlageplanBackgroundUrl: string | null;
  /** Anlageplan: AnlageplanConfig v1 JSON. null = no config yet. */
  anlageplanJson: string | null;
  sortOrder: number;
  /** Screen 1 Training logo visibility. Independent from Match/Tournament. */
  screen1TrainingShowLogos?: boolean;
  /** Screen 1 Training logo size preset: SMALL | MEDIUM | LARGE | XLARGE. */
  screen1TrainingLogoSize?: string;
  /** Screen 1 Match logo visibility. Default true when absent (backward compat). */
  screen1MatchShowLogos?: boolean;
  /** Screen 1 Match logo size preset: SMALL | MEDIUM | LARGE | XLARGE. */
  screen1MatchLogoSize?: string;
  /** Screen 1 Tournament logo visibility. Independent from Match. */
  screen1TournamentShowLogos?: boolean;
  /** Screen 1 Tournament logo size preset. */
  screen1TournamentLogoSize?: string;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Subset returned by the list query (no heavy fields like layoutJson).
 */
export type InfoboardListItem = Pick<
  InboardRow,
  | "id"
  | "tenantId"
  | "name"
  | "slug"
  | "status"
  | "templateType"
  | "displayTheme"
  | "headerSubtitleEnabled"
  | "announcementEnabled"
  | "sortOrder"
  | "createdAt"
  | "updatedAt"
  /** Anlageplan preview: board-specific map configuration. */
  | "anlageplanJson"
  | "anlageplanBackgroundUrl"
>;

/**
 * Input for creating a new Infoboard.
 */
export type CreateInfoboardInput = {
  tenantId: string;
  name: string;
  slug: string;
  templateType?: string;
  sortOrder?: number;
};

/**
 * Input for updating an existing Infoboard.
 * All fields are optional — only provided fields are updated.
 */
export type UpdateInfoboardInput = {
  name?: string;
  status?: InfoboardStatusValue;
  templateType?: string;
  displayTheme?: string | null;
  headerSubtitleEnabled?: boolean;
  headerSubtitleText?: string | null;
  headerShowTime?: boolean;
  headerShowDate?: boolean;
  headerShowWeather?: boolean;
  announcementEnabled?: boolean;
  announcementText?: string | null;
  announcementBgColor?: string | null;
  announcementTextColor?: string | null;
  /** Designer layout JSON (InboardLayout v1). */
  layoutJson?: string | null;
  /** Anlageplan: Vercel Blob CDN URL of uploaded background image. */
  anlageplanBackgroundUrl?: string | null;
  /** Anlageplan: AnlageplanConfig v1 JSON. */
  anlageplanJson?: string | null;
  sortOrder?: number;
  screen1TrainingShowLogos?: boolean;
  screen1TrainingLogoSize?: string;
  screen1MatchShowLogos?: boolean;
  screen1MatchLogoSize?: string;
  screen1TournamentShowLogos?: boolean;
  screen1TournamentLogoSize?: string;
};

/**
 * Kiosk public URL for a given slug.
 */
export function infoboardKioskUrl(slug: string): string {
  return `/infoboard/${slug}`;
}

/**
 * Template display labels (German).
 */
export const TEMPLATE_LABELS: Record<string, string> = {
  TAGESUEBERSICHT: "Tagesübersicht",
  ANLAGENUEBERSICHT: "Anlagenübersicht",
  LEER: "Leer",
};

/**
 * Status display labels and colors (German).
 */
export const STATUS_META: Record<
  InfoboardStatusValue,
  { label: string; color: "green" | "gray" | "amber" }
> = {
  ACTIVE: { label: "Aktiv", color: "green" },
  DISABLED: { label: "Deaktiviert", color: "gray" },
  DRAFT: { label: "Entwurf", color: "amber" },
};
