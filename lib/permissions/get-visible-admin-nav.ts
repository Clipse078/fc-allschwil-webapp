import {
  PERMISSIONS,
  type PermissionKey,
} from "@/lib/permissions/permissions";

export type AdminNavItem = {
  label: string;
  href: string;
  permissionKeys?: PermissionKey[];
  roleKeys?: string[];
  section?: "main" | "platform";
};

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    section: "main",
  },
  {
    label: "Vereinsleitung",
    href: "/vereinsleitung",
    section: "main",
  },
  {
    label: "Meetings",
    href: "/vereinsleitung/meetings",
    section: "main",
  },
  {
    label: "Initiativen",
    href: "/vereinsleitung/initiativen",
    section: "main",
  },
  {
    label: "KPIs",
    href: "/vereinsleitung/kpis",
    section: "main",
  },
  {
    label: "Saisons",
    href: "/dashboard/seasons",
    permissionKeys: [PERMISSIONS.SEASONS_VIEW, PERMISSIONS.SEASONS_MANAGE],
    section: "main",
  },
  {
    label: "Saisonplanner",
    href: "/dashboard/planner",
    permissionKeys: [PERMISSIONS.WOCHENPLAN_MANAGE],
    section: "main",
  },
  {
    label: "Wochenplanner",
    href: "/dashboard/planner/week",
    permissionKeys: [PERMISSIONS.WOCHENPLAN_MANAGE],
    section: "main",
  },
  {
    label: "Tagesplanner",
    href: "/dashboard/planner/day",
    permissionKeys: [PERMISSIONS.WOCHENPLAN_MANAGE],
    section: "main",
  },
  {
    label: "Teams",
    href: "/dashboard/teams",
    permissionKeys: [PERMISSIONS.TEAMS_VIEW, PERMISSIONS.TEAMS_MANAGE],
    section: "main",
  },
  {
    label: "Events",
    href: "/dashboard/events",
    permissionKeys: [PERMISSIONS.EVENTS_VIEW, PERMISSIONS.EVENTS_MANAGE],
    section: "main",
  },
  {
    label: "Personen",
    href: "/dashboard/persons",
    permissionKeys: [PERMISSIONS.PEOPLE_VIEW, PERMISSIONS.PEOPLE_MANAGE],
    section: "main",
  },
  {
    label: "Spieler",
    href: "/dashboard/players",
    permissionKeys: [PERMISSIONS.PEOPLE_VIEW, PERMISSIONS.PEOPLE_MANAGE],
    section: "main",
  },
  {
    label: "Trainer",
    href: "/dashboard/trainers",
    permissionKeys: [PERMISSIONS.PEOPLE_VIEW, PERMISSIONS.PEOPLE_MANAGE],
    section: "main",
  },
  {
    label: "Benutzer",
    href: "/dashboard/users",
    permissionKeys: [PERMISSIONS.USERS_MANAGE],
    section: "main",
  },
  {
    label: "Tenants / Clubs",
    href: "/dashboard/tenants",
    roleKeys: ["super_admin"],
    section: "platform",
  },
];

export function getVisibleAdminNav(
  permissionKeys: PermissionKey[],
  roleKeys: string[] = [],
): AdminNavItem[] {
  return ADMIN_NAV_ITEMS.filter((item) => {
    if (item.roleKeys && item.roleKeys.length > 0) {
      return item.roleKeys.some((key) => roleKeys.includes(key));
    }

    if (!item.permissionKeys || item.permissionKeys.length === 0) {
      return true;
    }

    return item.permissionKeys.some((permissionKey) =>
      permissionKeys.includes(permissionKey),
    );
  });
}
