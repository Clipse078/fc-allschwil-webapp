/**
 * SCE-DESIGN-04C — Sidebar nav label → premium animated icon key registry.
 */

import { NAV_SECTIONS } from "@/lib/nav/nav-config";
import type { NavIconKey } from "./nav-icon-keys";

/** Maps every sidebar nav label to its animated icon key. */
const NAV_LABEL_TO_ICON_KEY: Record<string, NavIconKey> = {
  Dashboard: "dashboard",
  Organisation: "organisation",
  Organisationseinheiten: "organisationseinheiten",
  Zielgruppen: "zielgruppen",
  Teams: "teams",
  "Anbieter-Mapping": "anbieter-mapping",
  Vereine: "vereine",
  Personen: "personen",
  Wettkämpfe: "wettkaempfe",
  Website: "website",
  "CMS Übersicht": "cms-uebersicht",
  News: "news",
  Seiten: "seiten",
  "Homepage Builder": "homepage-builder",
  Navigation: "navigation",
  "Block-Bibliothek": "block-bibliothek",
  Medien: "medien",
  Redaktion: "redaktion",
  Veröffentlichungen: "veroeffentlichungen",
  "Wiederverwendbare Inhalte": "wiederverwendbare-inhalte",
  Einstellungen: "einstellungen",
  Planung: "planung",
  TrainingCenter: "trainingcenter",
  MatchCenter: "matchcenter",
  TournamentCenter: "tournamentcenter",
  Veranstaltungen: "veranstaltungen",
  Wochenplanner: "wochenplanner",
  Dokumente: "dokumente",
  Anmeldungen: "anmeldungen",
  Registrierungen: "registrierungen",
  Warteliste: "warteliste",
  Archiv: "archiv",
  Kommunikation: "kommunikation",
  "E-Mail-Absender": "email-absender",
  Infoboard: "infoboard",
  Übersicht: "uebersicht",
  Vorschau: "vorschau",
  Meetings: "meetings",
  "Club Entwicklung": "club-entwicklung",
  Ziele: "ziele",
  Initiativen: "initiativen",
  "Prozesse & Aufgaben": "prozesse-aufgaben",
  "Material & Inventar": "material-inventar",
  Finanzen: "finanzen",
  Sponsoring: "sponsoring",
  Administration: "administration",
  "Rollen & Berechtigungen": "rollen-berechtigungen",
  Saisons: "saisons",
  "Anlagen & Ressourcen": "anlagen-ressourcen",
  Darstellung: "darstellung",
  Benutzer: "benutzer",
  "Personen & Zugänge": "benutzer",
  Rollen: "rollen",
  Tenants: "tenants",
  Integrationen: "integrationen",
};

/** Nav icon keys that use the SCE copper-flow motif. */
export const COPPER_FLOW_ICON_KEYS = new Set<NavIconKey>([
  "dashboard",
  "organisation",
  "anbieter-mapping",
  "website",
  "cms-uebersicht",
  "veroeffentlichungen",
  "kommunikation",
  "email-absender",
  "dokumente",
  "planung",
]);

export function getNavIconKey(label: string): NavIconKey {
  const key = NAV_LABEL_TO_ICON_KEY[label];
  if (!key) {
    throw new Error(
      `[nav-icon-registry] Missing animated icon for sidebar label: "${label}"`,
    );
  }
  return key;
}

export function getAllSidebarNavLabels(): string[] {
  return NAV_SECTIONS.flatMap((section) =>
    section.items.flatMap((item) => [
      item.label,
      ...(item.children?.map((child) => child.label) ?? []),
    ]),
  );
}

export function getAllSidebarNavIconKeys(): NavIconKey[] {
  return getAllSidebarNavLabels().map(getNavIconKey);
}
