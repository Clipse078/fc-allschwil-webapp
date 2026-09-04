/**
 * Canonical German display metadata for tenant permission keys.
 *
 * Shared by role creation, role editing, and effective-access summaries so
 * Club Admins see human-readable wording instead of raw English DB names
 * or technical keys.
 */

import { moduleLabel } from "@/lib/roles/module-labels";

export type PermissionDisplayMeta = {
  label: string;
  description: string;
  dangerous: boolean;
};

/** Concise German descriptions for permission module groups in the matrix UI. */
export const MODULE_DESCRIPTIONS_DE: Record<string, string> = {
  ORG: "Verwaltung der Vereinsorganisation, Mitglieder und Strukturen.",
  WEBSITE: "Inhalte, Seiten und Darstellung der Vereinswebsite.",
  TRAININGS: "Trainingsplanung, Serien und Zuteilungen.",
  EVENTS: "Events, Matches, Turniere und Veranstaltungen.",
  WOCHENPLAN: "Operativer Wochenplan mit Spielfeldern und Zuteilungen.",
  FIXTURES: "Spielpläne, Termine und Veröffentlichung.",
  REGISTRATIONS: "Anmeldungen und Teilnahmeprozesse.",
  COMPETITIONS: "Wettbewerbe und Ligen.",
  INFOBOARD: "Infoboard-Inhalte und Ausspielung.",
  MEETINGS: "Sitzungen, Protokolle und Beschlüsse.",
  INITIATIVES: "Vereinsinitiativen und Entwicklungsprojekte.",
  TARGETS: "Strategische Vereinsziele und Kennzahlen.",
  TEMPLATES: "Kommunikationsvorlagen und Nachrichten.",
  NEWS: "News-Artikel und Vereinsmeldungen.",
  FUNCTIONS: "Vereinsfunktionen und Rollen im Organigramm.",
  TEAMS: "Teams, Kader und Teamverwaltung.",
  PEOPLE: "Spieler, Trainer, Mitglieder und Personenstammdaten.",
  SEASONS: "Saisons und saisonale Planung.",
  FACILITIES: "Anlagen, Ressourcen und Material.",
  WORKSPACE: "Dokumente und Vereinsarbeitsbereich.",
  USERS: "Benutzer, Einladungen und Zugänge.",
  ROLES: "Rollen, Berechtigungen und Zuweisungen.",
  TENANTS: "Mandantenverwaltung (Plattform).",
};

const PERMISSION_LABELS_DE: Record<string, string> = {
  "org.view": "Organisation ansehen",
  "org.manage": "Organisation verwalten",
  "org.delete": "Organisation dauerhaft löschen",

  "website.manage": "Website verwalten",
  "website.delete": "Website dauerhaft löschen",

  "trainings.view": "Trainingsplanung ansehen",
  "trainings.manage": "Trainingsplanung verwalten",
  "trainings.delete": "Trainingsplanung dauerhaft löschen",

  "events.view": "Events ansehen",
  "events.manage": "Events verwalten",
  "events.import": "Events importieren",
  "events.publish_website": "Events auf Website veröffentlichen",
  "events.publish_infoboard": "Events auf Infoboard veröffentlichen",
  "events.delete": "Veranstaltungen dauerhaft löschen",
  "matches.delete": "Matches dauerhaft löschen",
  "tournaments.delete": "Turniere dauerhaft löschen",

  "wochenplan.manage": "Wochenplan verwalten",

  "fixtures.view": "Spielplan ansehen",
  "fixtures.create": "Spielplan-Einträge erstellen",
  "fixtures.edit_all": "Spielplan vollständig bearbeiten",
  "fixtures.submit_for_publication": "Spielplan zur Veröffentlichung einreichen",
  "fixtures.publish_website": "Spielplan auf Website veröffentlichen",
  "fixtures.publish_infoboard": "Spielplan auf Infoboard veröffentlichen",

  "teams.view": "Teams ansehen",
  "teams.manage": "Teams verwalten",
  "teams.delete": "Teams dauerhaft löschen",

  "people.view": "Personen ansehen",
  "people.manage": "Personen verwalten",
  "people.delete": "Personen dauerhaft löschen",
  "people.development.view": "Entwicklungsdaten ansehen",
  "people.development.manage": "Entwicklungsdaten verwalten",
  "people.assessments.view": "Beurteilungen ansehen",
  "people.assessments.manage": "Beurteilungen verwalten",
  "people.health.view": "Gesundheitsdaten ansehen",
  "people.health.manage": "Gesundheitsdaten verwalten",
  "people.finance.view": "Finanzdaten ansehen",
  "people.finance.manage": "Finanzdaten verwalten",
  "people.private_documents.view": "Private Dokumente ansehen",
  "people.private_documents.manage": "Private Dokumente verwalten",
  "people.audit.view": "Änderungshistorie ansehen",
  "people.contact.view": "Kontaktbeziehungen ansehen",
  "people.contact.manage": "Kontaktbeziehungen verwalten",

  "seasons.view": "Saisons ansehen",
  "seasons.manage": "Saisons verwalten",
  "seasons.delete": "Saisons dauerhaft löschen",

  "competitions.view": "Wettbewerbe ansehen",
  "competitions.manage": "Wettbewerbe verwalten",
  "competitions.delete": "Wettbewerbe dauerhaft löschen",

  "registrations.view": "Anmeldungen ansehen",
  "registrations.edit": "Anmeldungen bearbeiten",
  "registrations.delete": "Anmeldungen dauerhaft löschen",

  "news.manage": "News verwalten",
  "news.delete": "News dauerhaft löschen",

  "infoboard.manage": "Infoboard verwalten",
  "infoboard.delete": "Infoboard dauerhaft löschen",

  "functions.manage": "Funktionen verwalten",

  "targets.view": "Ziele ansehen",
  "targets.manage": "Ziele verwalten",
  "targets.delete": "Ziele dauerhaft löschen",

  "meetings.view": "Meetings ansehen",
  "meetings.manage": "Meetings verwalten",
  "meetings.delete": "Meetings dauerhaft löschen",

  "initiatives.view": "Initiativen ansehen",
  "initiatives.manage": "Initiativen verwalten",
  "initiatives.delete": "Initiativen dauerhaft löschen",

  "templates.view": "Vorlagen ansehen",
  "templates.manage": "Vorlagen verwalten",

  "facilities.view": "Anlagen & Ressourcen ansehen",
  "facilities.manage": "Anlagen & Ressourcen verwalten",
  "facilities.delete": "Anlagen & Ressourcen dauerhaft löschen",

  "workspace.view": "Dokumente ansehen",
  "workspace.manage": "Dokumente verwalten",
  "workspace.delete": "Dokumente dauerhaft löschen",

  "users.view": "Benutzer ansehen",
  "users.invite": "Benutzer einladen",
  "users.manage_memberships": "Mitgliedschaften verwalten",

  "roles.view": "Rollen ansehen",
  "roles.manage": "Rollen verwalten",
  "roles.assign": "Rollen zuweisen",
  "roles.delete": "Rollen dauerhaft löschen",
};

const PERMISSION_DESCRIPTIONS_DE: Record<string, string> = {
  "org.view": "Organisationen und Strukturen anzeigen.",
  "org.manage": "Vereinsdaten bearbeiten und Organisationseinheiten verwalten.",
  "org.delete": "Organisationseinträge endgültig aus dem System entfernen.",

  "website.manage": "Website-Inhalte, Seiten und Navigation bearbeiten.",
  "website.delete": "Website-Inhalte endgültig aus dem System entfernen.",

  "trainings.view": "Trainingsplanung und Zuteilungen einsehen.",
  "trainings.manage": "Trainingsplanung erstellen, bearbeiten und zuweisen.",
  "trainings.delete": "Trainingsplanung endgültig aus dem System entfernen.",

  "events.view": "Events, Matches und Veranstaltungen einsehen.",
  "events.manage": "Events erstellen, bearbeiten und verwalten.",
  "events.import": "Events aus externen Quellen importieren.",
  "events.publish_website": "Events auf der Vereinswebsite veröffentlichen.",
  "events.publish_infoboard": "Events auf dem Infoboard anzeigen.",
  "events.delete": "Veranstaltungen endgültig aus dem System entfernen.",
  "matches.delete": "Matches endgültig aus dem System entfernen.",
  "tournaments.delete": "Turniere endgültig aus dem System entfernen.",

  "wochenplan.manage": "Wochenplan mit Spielfeldern, Garderoben und Zuteilungen verwalten.",

  "fixtures.view": "Spielplan und Termine einsehen.",
  "fixtures.create": "Neue Spielplan-Einträge erfassen.",
  "fixtures.edit_all": "Alle Spielplan-Einträge bearbeiten.",
  "fixtures.submit_for_publication": "Spielplan zur Freigabe einreichen.",
  "fixtures.publish_website": "Spielplan auf der Website veröffentlichen.",
  "fixtures.publish_infoboard": "Spielplan auf dem Infoboard anzeigen.",

  "teams.view": "Teams und Kader einsehen.",
  "teams.manage": "Teams erstellen, bearbeiten und verwalten.",
  "teams.delete": "Teams endgültig aus dem System entfernen.",

  "people.view": "Personenstammdaten einsehen.",
  "people.manage": "Personen erstellen, bearbeiten und verwalten.",
  "people.delete": "Personen endgültig aus dem System entfernen.",
  "people.development.view": "Entwicklungsdaten von Personen einsehen.",
  "people.development.manage": "Entwicklungsdaten von Personen bearbeiten.",
  "people.assessments.view": "Beurteilungen von Personen einsehen.",
  "people.assessments.manage": "Beurteilungen von Personen bearbeiten.",
  "people.health.view": "Gesundheitsdaten von Personen einsehen.",
  "people.health.manage": "Gesundheitsdaten von Personen bearbeiten.",
  "people.finance.view": "Finanzdaten von Personen einsehen.",
  "people.finance.manage": "Finanzdaten von Personen bearbeiten.",
  "people.private_documents.view": "Private Dokumente von Personen einsehen.",
  "people.private_documents.manage": "Private Dokumente von Personen verwalten.",
  "people.audit.view": "Änderungshistorie von Personen einsehen.",
  "people.contact.view": "Kontaktbeziehungen und Notfallkontakte einsehen.",
  "people.contact.manage": "Kontaktbeziehungen und Notfallkontakte verwalten.",

  "seasons.view": "Saisons und Saisonstatus einsehen.",
  "seasons.manage": "Saisons erstellen, bearbeiten und verwalten.",
  "seasons.delete": "Saisons endgültig aus dem System entfernen.",

  "competitions.view": "Wettbewerbe und Ligen einsehen.",
  "competitions.manage": "Wettbewerbe erstellen, bearbeiten und verwalten.",
  "competitions.delete": "Wettbewerbe endgültig aus dem System entfernen.",

  "registrations.view": "Anmeldungen und Teilnahmen einsehen.",
  "registrations.edit": "Anmeldungen bearbeiten und verwalten.",
  "registrations.delete": "Anmeldungen endgültig aus dem System entfernen.",

  "news.manage": "News-Artikel erstellen, bearbeiten und veröffentlichen.",
  "news.delete": "News-Artikel endgültig aus dem System entfernen.",

  "infoboard.manage": "Infoboard-Inhalte erstellen und bearbeiten.",
  "infoboard.delete": "Infoboards endgültig aus dem System entfernen.",

  "functions.manage": "Vereinsfunktionen im Organigramm verwalten.",

  "targets.view": "Vereinsziele und Kennzahlen einsehen.",
  "targets.manage": "Vereinsziele erstellen, bearbeiten und verwalten.",
  "targets.delete": "Vereinsziele endgültig aus dem System entfernen.",

  "meetings.view": "Meetings und Protokolle einsehen.",
  "meetings.manage": "Meetings erstellen, bearbeiten und verwalten.",
  "meetings.delete": "Meetings endgültig aus dem System entfernen.",

  "initiatives.view": "Initiativen und Projekte einsehen.",
  "initiatives.manage": "Initiativen erstellen, bearbeiten und verwalten.",
  "initiatives.delete": "Initiativen endgültig aus dem System entfernen.",

  "templates.view": "Kommunikationsvorlagen einsehen.",
  "templates.manage": "Kommunikationsvorlagen erstellen und bearbeiten.",

  "facilities.view": "Anlagen und Ressourcen einsehen.",
  "facilities.manage": "Anlagen und Ressourcen erstellen, bearbeiten und verwalten.",
  "facilities.delete": "Anlagen und Ressourcen endgültig aus dem System entfernen.",

  "workspace.view": "Dokumente und Ordner einsehen.",
  "workspace.manage": "Dokumente und Ordner erstellen, bearbeiten und verwalten.",
  "workspace.delete": "Dokumente und Ordner endgültig aus dem System entfernen.",

  "users.view": "Benutzer und Zugänge einsehen.",
  "users.invite": "Neue Benutzer zum Verein einladen.",
  "users.manage_memberships": "Vereinsmitgliedschaften verwalten.",

  "roles.view": "Rollen und Berechtigungen einsehen.",
  "roles.manage": "Rollen erstellen, bearbeiten und verwalten.",
  "roles.assign": "Rollen Benutzern zuweisen.",
  "roles.delete": "Rollen endgültig aus dem System entfernen.",
};

const ACTION_LABELS: Record<string, string> = {
  view: "ansehen",
  manage: "verwalten",
  delete: "dauerhaft löschen",
  invite: "einladen",
  assign: "zuweisen",
  import: "importieren",
  edit: "bearbeiten",
  create: "erstellen",
  edit_all: "vollständig bearbeiten",
  submit_for_publication: "zur Veröffentlichung einreichen",
  publish_website: "auf Website veröffentlichen",
  publish_infoboard: "auf Infoboard veröffentlichen",
  manage_memberships: "Mitgliedschaften verwalten",
};

export function isDangerousPermission(key: string): boolean {
  return key.endsWith(".delete") || key.includes(".delete.");
}

export function moduleDisplayDescription(module: string): string {
  return MODULE_DESCRIPTIONS_DE[module] ?? `Berechtigungen für ${moduleLabel(module)}.`;
}

function deriveLabelFromKey(key: string, module: string): string {
  const parts = key.split(".");
  const action = parts[parts.length - 1] ?? "manage";
  const mod = moduleLabel(module);
  const verb = ACTION_LABELS[action] ?? action.replace(/_/g, " ");
  return `${mod} ${verb}`;
}

function deriveDescriptionFromKey(key: string, label: string): string {
  if (isDangerousPermission(key)) {
    return `${label.replace(" dauerhaft löschen", "")} endgültig aus dem System entfernen.`;
  }
  if (key.endsWith(".view")) {
    return `${label.replace(" ansehen", "")} einsehen und anzeigen.`;
  }
  if (key.endsWith(".manage")) {
    return `${label.replace(" verwalten", "")} erstellen, bearbeiten und verwalten.`;
  }
  return `Berechtigung: ${label}.`;
}

export function permissionDisplayLabel(
  key: string,
  fallbackName: string,
  module: string,
): string {
  return PERMISSION_LABELS_DE[key] ?? deriveLabelFromKey(key, module);
}

export function permissionDisplayDescription(
  key: string,
  label: string,
): string {
  return PERMISSION_DESCRIPTIONS_DE[key] ?? deriveDescriptionFromKey(key, label);
}

export function getPermissionDisplayMeta(
  key: string,
  fallbackName: string,
  module: string,
): PermissionDisplayMeta {
  const label = permissionDisplayLabel(key, fallbackName, module);
  return {
    label,
    description: permissionDisplayDescription(key, label),
    dangerous: isDangerousPermission(key),
  };
}

export type SelectedPermissionSummaryGroup = {
  module: string;
  moduleLabel: string;
  items: Array<{ key: string; label: string; dangerous: boolean }>;
};

export function buildSelectedPermissionSummary(
  moduleGroups: Array<{
    module: string;
    permissions: Array<{ key: string; name: string; module: string }>;
  }>,
  selectedKeys: Set<string>,
): SelectedPermissionSummaryGroup[] {
  const groups: SelectedPermissionSummaryGroup[] = [];

  for (const { module, permissions } of moduleGroups) {
    const items = permissions
      .filter((p) => selectedKeys.has(p.key))
      .map((p) => {
        const meta = getPermissionDisplayMeta(p.key, p.name, p.module);
        return { key: p.key, label: meta.label, dangerous: meta.dangerous };
      })
      .sort((a, b) => a.label.localeCompare(b.label, "de"));

    if (items.length > 0) {
      groups.push({
        module,
        moduleLabel: moduleLabel(module),
        items,
      });
    }
  }

  return groups;
}
