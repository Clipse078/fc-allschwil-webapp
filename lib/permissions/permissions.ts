export const PERMISSIONS = {
  USERS_MANAGE: "users.manage",
  USERS_IMPERSONATE: "users.impersonate",

  SEASONS_VIEW: "seasons.view",
  SEASONS_MANAGE: "seasons.manage",

  TEAMS_VIEW: "teams.view",
  TEAMS_MANAGE: "teams.manage",

  COMPETITIONS_VIEW: "competitions.view",
  COMPETITIONS_MANAGE: "competitions.manage",

  PEOPLE_VIEW: "people.view",
  PEOPLE_MANAGE: "people.manage",

  EVENTS_VIEW: "events.view",
  EVENTS_MANAGE: "events.manage",
  EVENTS_IMPORT: "events.import",
  EVENTS_PUBLISH_WEBSITE: "events.publish_website",
  EVENTS_PUBLISH_INFOBOARD: "events.publish_infoboard",

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
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];