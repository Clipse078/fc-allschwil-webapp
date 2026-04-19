export const PERMISSIONS = {
  USERS_MANAGE: "users.manage",
  USERS_IMPERSONATE: "users.impersonate",

  SEASONS_VIEW: "seasons.view",
  SEASONS_MANAGE: "seasons.manage",

  TEAMS_VIEW: "teams.view",
  TEAMS_MANAGE: "teams.manage",

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

  VEREINSLEITUNG_VIEW: "vereinsleitung.view",
  VEREINSLEITUNG_KPI_VIEW: "vereinsleitung.kpi.view",
  VEREINSLEITUNG_PENDENZEN_VIEW: "vereinsleitung.pendenzen.view",
  VEREINSLEITUNG_PENDENZEN_MANAGE: "vereinsleitung.pendenzen.manage",
  VEREINSLEITUNG_MEETINGS_VIEW: "vereinsleitung.meetings.view",
  VEREINSLEITUNG_MEETINGS_MANAGE: "vereinsleitung.meetings.manage",
  VEREINSLEITUNG_INITIATIVES_VIEW: "vereinsleitung.initiatives.view",
  VEREINSLEITUNG_INITIATIVES_MANAGE: "vereinsleitung.initiatives.manage",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
