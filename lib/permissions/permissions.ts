export const PERMISSIONS = {
  USERS_VIEW: "users.view",
  USERS_MANAGE: "users.manage",
  USERS_IMPERSONATE: "users.impersonate",
  USERS_INVITE: "users.invite",
  USERS_MANAGE_MEMBERSHIPS: "users.manage_memberships",

  SEASONS_VIEW: "seasons.view",
  SEASONS_MANAGE: "seasons.manage",
  // ADMIN-DELETE-SEASON-01: canonical permanent-deletion permission. Deliberately
  // separate from SEASONS_MANAGE — holding "manage" (create/edit) must never
  // implicitly grant permanent deletion. Follows the "<module>.delete" convention
  // established by TEAMS_DELETE (ADMIN-DELETE-01A) and extended by ADMIN-DELETE-02A.
  SEASONS_DELETE: "seasons.delete",

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
  // PERSONS-01: canonical permanent-deletion permission for Person master
  // data. Deliberately separate from PEOPLE_MANAGE — create/edit/archive
  // access must never implicitly grant permanent deletion. Follows the
  // "<module>.delete" convention established by TEAMS_DELETE (ADMIN-DELETE-01A).
  PEOPLE_DELETE: "people.delete",

  EVENTS_VIEW: "events.view",
  EVENTS_MANAGE: "events.manage",
  EVENTS_IMPORT: "events.import",
  EVENTS_PUBLISH_WEBSITE: "events.publish_website",
  EVENTS_PUBLISH_INFOBOARD: "events.publish_infoboard",
  // CLUB-EVENTS-01-C1: canonical permanent-deletion permission for tenant-managed
  // Veranstaltungen (EventType.OTHER). Deliberately separate from EVENTS_MANAGE —
  // create/edit/archive/restore access must never implicitly grant permanent
  // deletion. Follows the "<module>.delete" convention established by
  // TEAMS_DELETE (ADMIN-DELETE-01A) and extended through ADMIN-DELETE-02A.
  EVENTS_DELETE: "events.delete",
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
  // ADMIN-DELETE-03B: canonical permanent-deletion permission for
  // Registrations (Anmeldungen). Deliberately separate from
  // REGISTRATIONS_EDIT — managing/archiving a registration must never
  // implicitly grant permanent deletion. Follows the "<module>.delete"
  // convention established by TEAMS_DELETE (ADMIN-DELETE-01A) and
  // extended through all subsequent ADMIN-DELETE slices.
  REGISTRATIONS_DELETE: "registrations.delete",

  TENANTS_VIEW: "tenants.view",
  TENANTS_MANAGE: "tenants.manage",

  ORG_VIEW: "org.view",
  ORG_MANAGE: "org.manage",
  // ADMIN-DELETE-ORG-01: canonical permanent-deletion permission for OrgUnit
  // records. Deliberately separate from ORG_MANAGE — create/edit/archive
  // must never implicitly grant permanent deletion. Follows the "<module>.delete"
  // convention established by TEAMS_DELETE (ADMIN-DELETE-01A).
  ORG_DELETE: "org.delete",

  FACILITIES_VIEW: "facilities.view",
  FACILITIES_MANAGE: "facilities.manage",
  // ADMIN-DELETE-FACILITIES-01: canonical permanent-deletion permission for
  // Facility and FacilityResource records. Deliberately separate from
  // FACILITIES_MANAGE. Follows the "<module>.delete" convention.
  FACILITIES_DELETE: "facilities.delete",

  // ADMIN-DELETE-TENANT-01: SCE Super Admin only. Tenant permanent deletion is
  // the highest-impact operation in the platform. Separate from TENANTS_MANAGE
  // to require explicit, elevated authority. Tenant-local Club Admins do NOT
  // hold this permission — only the platform super_admin role carries it.
  TENANTS_DELETE: "tenants.delete",

  WORKSPACE_VIEW: "workspace.view",
  WORKSPACE_MANAGE: "workspace.manage",
  // ADMIN-DELETE-03A / ADMIN-DELETE-WORKSPACE-01: canonical permanent-deletion
  // permission for Workspace content (documents and folders). Deliberately
  // separate from WORKSPACE_MANAGE — holding "manage" (upload/archive/restore)
  // must never implicitly grant permanent deletion. Follows the
  // "<module>.delete" convention established by TEAMS_DELETE (ADMIN-DELETE-01A)
  // and extended through ADMIN-DELETE-02A/ADMIN-DELETE-SEASON-01.
  WORKSPACE_DELETE: "workspace.delete",

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
  // ADMIN-HARD-DELETE-UI — permanent deletion of non-system tenant roles.
  // Deliberately separate from ROLES_MANAGE — archiving/editing a role must
  // never implicitly grant permanent deletion. Follows the "<module>.delete"
  // convention established by TEAMS_DELETE (ADMIN-DELETE-01A).
  ROLES_DELETE: "roles.delete",

  // ADMIN-HARD-DELETE-UI — permanent deletion of Meetings, Initiatives, and Targets.
  // These are cross-cutting Vereinsleitung entities (no tenant FK). Permanent
  // deletion requires a dedicated permission separate from *.manage so that
  // routine editorial access never implies destructive authority.
  MEETINGS_DELETE: "meetings.delete",
  INITIATIVES_DELETE: "initiatives.delete",
  TARGETS_DELETE: "targets.delete",

  // ADMIN-HARD-DELETE-UI — platform-level global User account deletion.
  // scope=PLATFORM — only the SCE super_admin role carries this permission.
  // Never grantable by club admins. Deliberately separate from USERS_MANAGE.
  USERS_DELETE: "users.delete",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];