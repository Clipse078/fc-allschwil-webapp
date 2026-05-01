import {
  PERMISSIONS,
  type PermissionKey,
} from "@/lib/permissions/permissions";

export type AdminNavItem = {
  label: string;
  href: string;
  parentLabel?: string;
  permissionKeys?: PermissionKey[];
};

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
  },

  { label: "Meine Aufgaben", href: "/dashboard/tasks", permissionKeys: [PERMISSIONS.USERS_MANAGE, PERMISSIONS.PEOPLE_MANAGE] },

  {
    label: "Meetings",
    href: "/vereinsleitung/meetings",
    permissionKeys: [
      PERMISSIONS.VEREINSLEITUNG_MEETINGS_VIEW,
      PERMISSIONS.VEREINSLEITUNG_MEETINGS_MANAGE,
    ],
  },
  {
    label: "Initiativen",
    href: "/vereinsleitung/initiativen",
    permissionKeys: [
      PERMISSIONS.VEREINSLEITUNG_INITIATIVES_VIEW,
      PERMISSIONS.VEREINSLEITUNG_INITIATIVES_MANAGE,
    ],
  },
  {
    label: "Organisation",
    href: "/vereinsleitung/organigramm",
    permissionKeys: [PERMISSIONS.VEREINSLEITUNG_VIEW, PERMISSIONS.USERS_MANAGE],
  },
  {
    label: "Kommunikation",
    href: "/vereinsleitung/kommunikation-hub",
    permissionKeys: [PERMISSIONS.VEREINSLEITUNG_VIEW, PERMISSIONS.USERS_MANAGE],
  },
  {
    label: "Ressourcen",
    href: "/dashboard/operations/resources",
    permissionKeys: [PERMISSIONS.USERS_MANAGE],
  },
  {
    label: "Finanzen",
    href: "/dashboard/operations/finance",
    permissionKeys: [PERMISSIONS.USERS_MANAGE],
  },
  {
    label: "Material",
    href: "/dashboard/operations/material",
    permissionKeys: [PERMISSIONS.USERS_MANAGE],
  },
  {
    label: "Media",
    href: "/dashboard/operations/media",
    permissionKeys: [PERMISSIONS.USERS_MANAGE],
  },
  {
    label: "Business Club",
    href: "/dashboard/operations/business-club",
    permissionKeys: [PERMISSIONS.USERS_MANAGE],
  },
  {
    label: "Archiv",
    href: "/dashboard/operations/archiv",
    permissionKeys: [PERMISSIONS.USERS_MANAGE],
  },

  {
    label: "Current Season",
    href: "/dashboard/current-season",
    permissionKeys: [PERMISSIONS.TEAMS_VIEW, PERMISSIONS.TEAMS_MANAGE, PERMISSIONS.WOCHENPLAN_MANAGE],
  },
  {
    label: "4.1 Teams",
    href: "/dashboard/teams",
    parentLabel: "Current Season",
    permissionKeys: [PERMISSIONS.TEAMS_VIEW, PERMISSIONS.TEAMS_MANAGE],
  },
  {
    label: "4.2 Jahresplan",
    href: "/dashboard/planner",
    parentLabel: "Current Season",
    permissionKeys: [PERMISSIONS.WOCHENPLAN_MANAGE],
  },
  {
    label: "4.3 Wochenplan",
    href: "/dashboard/planner/week",
    parentLabel: "Current Season",
    permissionKeys: [PERMISSIONS.WOCHENPLAN_MANAGE],
  },
  {
    label: "4.4 Platz reservieren",
    href: "/dashboard/planner/reserve",
    parentLabel: "Current Season",
    permissionKeys: [PERMISSIONS.WOCHENPLAN_MANAGE],
  },
  {
    label: "4.5 Infoboard",
    href: "/dashboard/infoboard",
    parentLabel: "Current Season",
    permissionKeys: [PERMISSIONS.INFOBOARD_MANAGE],
  },

  {
    label: "Next Season",
    href: "/dashboard/next-season",
    permissionKeys: [PERMISSIONS.SEASONS_VIEW, PERMISSIONS.SEASONS_MANAGE],
  },
  {
    label: "5.1 Teams",
    href: "/dashboard/next-season/teams",
    parentLabel: "Next Season",
    permissionKeys: [PERMISSIONS.SEASONS_VIEW, PERMISSIONS.SEASONS_MANAGE],
  },

  {
    label: "Personen",
    href: "/dashboard/persons",
    permissionKeys: [PERMISSIONS.PEOPLE_VIEW, PERMISSIONS.PEOPLE_MANAGE],
  },

  {
    label: "Neue Anmeldungen",
    href: "/dashboard/neu-anmeldungen",
    permissionKeys: [PERMISSIONS.USERS_MANAGE],
  },
  {
    label: "7.1 Neue Trainers",
    href: "/dashboard/neu-anmeldungen/neue-trainers",
    parentLabel: "Neue Anmeldungen",
    permissionKeys: [PERMISSIONS.USERS_MANAGE],
  },
  {
    label: "7.2 Neue Players",
    href: "/dashboard/neu-anmeldungen/neue-players",
    parentLabel: "Neue Anmeldungen",
    permissionKeys: [PERMISSIONS.USERS_MANAGE],
  },
  {
    label: "7.3 Neue Vereinsfunktionäre",
    href: "/dashboard/neu-anmeldungen/neue-vereinsfunktionaere",
    parentLabel: "Neue Anmeldungen",
    permissionKeys: [PERMISSIONS.USERS_MANAGE],
  },

  {
    label: "Users & Roles",
    href: "/dashboard/users",
    permissionKeys: [PERMISSIONS.USERS_MANAGE],
  },
];

export function getVisibleAdminNav(permissionKeys: PermissionKey[]): AdminNavItem[] {
  return ADMIN_NAV_ITEMS.filter((item) => {
    if (!item.permissionKeys || item.permissionKeys.length === 0) {
      return true;
    }

    return item.permissionKeys.some((permissionKey) =>
      permissionKeys.includes(permissionKey),
    );
  });
}








