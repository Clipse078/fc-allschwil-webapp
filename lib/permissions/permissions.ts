export const PERMISSIONS = {
  USERS_VIEW: "users.view",
  USERS_MANAGE: "users.manage",
  USERS_IMPERSONATE: "users.impersonate",
  USERS_INVITE: "users.invite",
  USERS_MANAGE_MEMBERSHIPS: "users.manage_memberships",

  SEASONS_VIEW: "seasons.view",
  SEASONS_MANAGE: "seasons.manage",

  TEAMS_VIEW: "teams.view",
  TEAMS_MANAGE: "teams.manage",
  // ADMIN-DELETE-01A: canonical permanent-deletion permission. Deliberately
  // separate from TEAMS_MANAGE — holding "manage" (create/edit/archive) must
  // never implicitly grant permanent deletion. Module-scoped delete
  // permissions follow this "<module>.delete" naming convention as
  // permanent-deletion support is extended to other modules.
  TEAMS_DELETE: "teams.delete",

  COMPETITIONS_VIEW: "competitions.view",
  COMPETITIONS_MANAGE: "competitions.manage",

  PEOPLE_VIEW: "people.view",
  PEOPLE_MANAGE: "people.manage",

  EVENTS_VIEW: "events.view",
  EVENTS_MANAGE: "events.manage",
  EVENTS_IMPORT: "events.import",
  EVENTS_PUBLISH_WEBSITE: "events.publish_website",
  EVENTS_PUBLISH_INFOBOARD: "events.publish_infoboard",
  // ADMIN-DELETE-02A: canonical permanent-deletion permissions for the
  // MatchCenter/TournamentCenter modules, following the "<module>.delete"
  // convention established by TEAMS_DELETE (ADMIN-DELETE-01A/01B). Both
  // target the canonical Event model (type=MATCH / type=TOURNAMENT — see
  // prisma/schema.prisma) and are deliberately separate from EVENTS_MANAGE —
  // archive/cancel/edit access must never implicitly grant permanent
  // deletion.
  MATCHES_DELETE: "matches.delete",
  TOURNAMENTS_DELETE: "tournaments.delete",

  FIXTURES_VIEW: "fixtures.view",
  FIXTURES_CREATE: "fixtures.create",
  FIXTURES_EDIT_ALL: "fixtures.edit_all",
  FIXTURES_SUBMIT_FOR_PUBLICATION: "fixtures.submit_for_publication",
  FIXTURES_PUBLISH_WEBSITE: "fixtures.publish_website",
  FIXTURES_PUBLISH_INFOBOARD: "fixtures.publish_infoboard",

  WOCHENPLAN_MANAGE: "wochenplan.manage",
  NEWS_MANAGE: "news.manage",
  WEBSITE_MANAGE: "website.manage",
  INFOBOARD_MANAGE: "infoboard.manage",
  FUNCTIONS_MANAGE: "functions.manage",

  // Strategic modules — all three now DB-backed via PermissionModule enum
  TARGETS_VIEW: "targets.view",
  TARGETS_MANAGE: "targets.manage",

  MEETINGS_VIEW: "meetings.view",
  MEETINGS_MANAGE: "meetings.manage",

  INITIATIVES_VIEW: "initiatives.view",
  INITIATIVES_MANAGE: "initiatives.manage",

  TEMPLATES_VIEW: "templates.view",
  TEMPLATES_MANAGE: "templates.manage",

  REGISTRATIONS_VIEW: "registrations.view",
  REGISTRATIONS_EDIT: "registrations.edit",

  TENANTS_VIEW: "tenants.view",
  TENANTS_MANAGE: "tenants.manage",

  ORG_VIEW: "org.view",
  ORG_MANAGE: "org.manage",

  FACILITIES_VIEW: "facilities.view",
  FACILITIES_MANAGE: "facilities.manage",

  WORKSPACE_VIEW: "workspace.view",
  WORKSPACE_MANAGE: "workspace.manage",

  TRAININGS_VIEW: "trainings.view",
  TRAININGS_MANAGE: "trainings.manage",
  // ADMIN-DELETE-02A: canonical permanent-deletion permission, following the
  // "<module>.delete" convention established by TEAMS_DELETE (ADMIN-DELETE-
  // 01A/01B). Deliberately separate from TRAININGS_MANAGE — archive/edit
  // access must never implicitly grant permanent deletion of a
  // TrainingSeries.
  TRAININGS_DELETE: "trainings.delete",

  // RPERM-02: role management permissions — defined here, not yet used in guards
  ROLES_VIEW: "roles.view",
  ROLES_MANAGE: "roles.manage",
  ROLES_ASSIGN: "roles.assign",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];