import type { MotionIntent } from "./types";

/**
 * Maps sidebar navigation labels to standardized motion intents.
 * Labels not listed fall back to "hover" (subtle settle response).
 */
const NAV_LABEL_INTENTS: Record<string, MotionIntent> = {
  Dashboard: "hover",
  Organisation: "group",
  Organisationseinheiten: "group",
  Teams: "group",
  Funktionen: "group",
  Personen: "group",
  Spieler: "group",
  Trainer: "group",
  Benutzer: "group",
  "Personen & Zugänge": "group",
  Website: "globe",
  "CMS Übersicht": "globe",
  Tenants: "globe",
  Planung: "schedule",
  TrainingCenter: "schedule",
  Trainingsplaner: "schedule",
  Veranstaltungen: "schedule",
  Events: "schedule",
  Saisons: "schedule",
  Saisonplanung: "schedule",
  Saisonplanner: "schedule",
  Wochenplanner: "schedule",
  Tagesplanner: "schedule",
  MatchCenter: "direction",
  TournamentCenter: "lift",
  Dokumente: "open",
  Workspace: "open",
  Anmeldungen: "communicate",
  Registrierungen: "communicate",
  Kommunikation: "communicate",
  "E-Mail-Absender": "communicate",
  Mail: "communicate",
  Veröffentlichungen: "publish",
  Einstellungen: "gear",
  Administration: "gear",
  Admin: "gear",
};

export function getNavMotionIntent(label: string): MotionIntent {
  return NAV_LABEL_INTENTS[label] ?? "hover";
}
