import {
  PERMISSIONS,
  type PermissionKey,
} from "@/lib/permissions/permissions";

export type AdminNavItem = {
  label: string;
  href: string;
  permissionKeys?: PermissionKey[];
};

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
  },
  {
    label: "Vereinsleitung",
    href: "/vereinsleitung",
  },
  {
    label: "Meetings",
    href: "/vereinsleitung/meetings",
  },
  {
    label: "Initiativen",
    href: "/vereinsleitung/initiativen",
  },
  {
    label: "KPIs",
    href: "/vereinsleitung/kpis",
  },
  {
    label: "Saisons",
    href: "/dashboard/seasons",
    permissionKeys: [PERMISSIONS.SEASONS_VIEW, PERMISSIONS.SEASONS_MANAGE],
  },
  {
    label: "Saisonplanner",
    href: "/dashboard/planner",
    permissionKeys: [PERMISSIONS.WOCHENPLAN_MANAGE],
  },
  {
    label: "Wochenplanner",
    href: "/dashboard/planner/week",
    permissionKeys: [PERMISSIONS.WOCHENPLAN_MANAGE],
  },
  {
    label: "Tagesplanner",
    href: "/dashboard/planner/day",
    permissionKeys: [PERMISSIONS.WOCHENPLAN_MANAGE],
  },
  {
    label: "Teams",
    href: "/dashboard/teams",
    permissionKeys: [PERMISSIONS.TEAMS_VIEW, PERMISSIONS.TEAMS_MANAGE],
  },
  {
    label: "Events",
    href: "/dashboard/events",
    permissionKeys: [PERMISSIONS.EVENTS_VIEW, PERMISSIONS.EVENTS_MANAGE],
  },
  {
    label: "Personen",
    href: "/dashboard/persons",
    permissionKeys: [PERMISSIONS.PEOPLE_VIEW, PERMISSIONS.PEOPLE_MANAGE],
  },
  {
    label: "Spieler",
    href: "/dashboard/players",
    permissionKeys: [PERMISSIONS.PEOPLE_VIEW, PERMISSIONS.PEOPLE_MANAGE],
  },
  {
    label: "Trainer",
    href: "/dashboard/trainers",
    permissionKeys: [PERMISSIONS.PEOPLE_VIEW, PERMISSIONS.PEOPLE_MANAGE],
  },
  {
    label: "Benutzer",
    href: "/dashboard/users",
    permissionKeys: [PERMISSIONS.USERS_MANAGE],
  },
];

export function getVisibleAdminNav(permissionKeys: PermissionKey[]): AdminNavItem[] {
  return ADMIN_NAV_ITEMS.filter((item) => {
    if (!item.permissionKeys || item.permissionKeys.length === 0) {
      return true;
    }

    return item.permissionKeys.some(function (permissionKey) {
      return permissionKeys.includes(permissionKey);
    });
  });
}
