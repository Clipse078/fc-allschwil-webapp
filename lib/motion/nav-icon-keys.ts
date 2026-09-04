/**
 * SCE-DESIGN-04C — Canonical keys for premium sidebar nav icons.
 * One key per sidebar nav label; used by registry, CSS, and tests.
 */

export const NAV_ICON_KEYS = [
  "dashboard",
  "organisation",
  "organisationseinheiten",
  "zielgruppen",
  "teams",
  "anbieter-mapping",
  "vereine",
  "personen",
  "wettkaempfe",
  "website",
  "cms-uebersicht",
  "news",
  "seiten",
  "homepage-builder",
  "navigation",
  "block-bibliothek",
  "medien",
  "redaktion",
  "veroeffentlichungen",
  "wiederverwendbare-inhalte",
  "einstellungen",
  "planung",
  "trainingcenter",
  "matchcenter",
  "tournamentcenter",
  "veranstaltungen",
  "wochenplanner",
  "dokumente",
  "anmeldungen",
  "registrierungen",
  "warteliste",
  "archiv",
  "kommunikation",
  "email-absender",
  "infoboard",
  "uebersicht",
  "vorschau",
  "meetings",
  "club-entwicklung",
  "ziele",
  "initiativen",
  "prozesse-aufgaben",
  "material-inventar",
  "finanzen",
  "sponsoring",
  "administration",
  "rollen-berechtigungen",
  "saisons",
  "anlagen-ressourcen",
  "darstellung",
  "benutzer",
  "rollen",
  "tenants",
  "integrationen",
] as const;

export type NavIconKey = (typeof NAV_ICON_KEYS)[number];

export function isNavIconKey(value: string): value is NavIconKey {
  return (NAV_ICON_KEYS as readonly string[]).includes(value);
}
