/**
 * lib/roles/module-labels.ts
 *
 * Single source of truth for the German display label of each
 * `PermissionModule` enum value. Previously duplicated verbatim in
 * `components/admin/roles/RolePermissionEditor.tsx` and
 * `app/(admin)/dashboard/permissions/page.tsx` — extracted here so the new
 * RPERM-05 tenant permission matrix, the effective-access viewer, and the
 * existing platform permission pages all render the exact same module
 * grouping labels.
 *
 * Module grouping is presentation-only (architectural principle 2 — "module
 * access is represented by permissions"). This map never gates access; it
 * only decides how `Permission.module` values are labelled in the UI.
 */

/** Every `PermissionModule` enum value the app currently uses, German-labelled. */
export const MODULE_LABELS: Record<string, string> = {
  USERS: "Benutzer",
  SEASONS: "Saisons",
  TEAMS: "Teams",
  COMPETITIONS: "Wettbewerbe",
  TRAININGS: "Trainingsplanung",
  PEOPLE: "Personen",
  EVENTS: "Events",
  FIXTURES: "Spiele",
  WOCHENPLAN: "Wochenplan",
  NEWS: "News",
  WEBSITE: "Website",
  INFOBOARD: "Infoboard",
  FUNCTIONS: "Funktionen",
  TARGETS: "Ziele",
  MEETINGS: "Meetings",
  INITIATIVES: "Initiativen",
  TEMPLATES: "Vorlagen",
  REGISTRATIONS: "Anmeldungen",
  TENANTS: "Tenants",
  ORG: "Organisation",
  FACILITIES: "Anlagen & Ressourcen",
  WORKSPACE: "Dokumente",
  ROLES: "Rollen & Berechtigungen",
};

/**
 * Stable display order for module groups in the permission matrix.
 * Modules not listed here (should not happen — kept as a safety net) sort
 * alphabetically after the known set.
 */
export const MODULE_DISPLAY_ORDER: readonly string[] = [
  "ORG",
  "WEBSITE",
  "TRAININGS",
  "EVENTS",
  "WOCHENPLAN",
  "FIXTURES",
  "REGISTRATIONS",
  "COMPETITIONS",
  "INFOBOARD",
  "MEETINGS",
  "INITIATIVES",
  "TARGETS",
  "TEMPLATES",
  "NEWS",
  "FUNCTIONS",
  "TEAMS",
  "PEOPLE",
  "SEASONS",
  "FACILITIES",
  "WORKSPACE",
  "USERS",
  "ROLES",
  "TENANTS",
];

export function moduleLabel(module: string): string {
  return MODULE_LABELS[module] ?? module;
}

export function moduleSortIndex(module: string): number {
  const idx = MODULE_DISPLAY_ORDER.indexOf(module);
  return idx === -1 ? MODULE_DISPLAY_ORDER.length : idx;
}
