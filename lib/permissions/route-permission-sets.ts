import { PERMISSIONS, type PermissionKey } from "@/lib/permissions/permissions";

export const ROUTE_PERMISSION_SETS = {
  EVENTS_READ: [
    PERMISSIONS.EVENTS_VIEW,
    PERMISSIONS.EVENTS_MANAGE,
  ] satisfies PermissionKey[],

  PEOPLE_SEARCH: [
    PERMISSIONS.PEOPLE_VIEW,
    PERMISSIONS.TEAMS_MANAGE,
  ] satisfies PermissionKey[],

  SEASONS_READ: [
    PERMISSIONS.SEASONS_VIEW,
    PERMISSIONS.SEASONS_MANAGE,
    PERMISSIONS.TEAMS_VIEW,
    PERMISSIONS.TEAMS_MANAGE,
  ] satisfies PermissionKey[],

  TEAMS_READ: [
    PERMISSIONS.TEAMS_VIEW,
    PERMISSIONS.TEAMS_MANAGE,
    PERMISSIONS.EVENTS_VIEW,
    PERMISSIONS.EVENTS_MANAGE,
  ] satisfies PermissionKey[],
} as const;
