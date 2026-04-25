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

  {
    label: "Vereinsleitung",
    href: "/vereinsleitung",
    permissionKeys: [
      PERMISSIONS.VEREINSLEITUNG_VIEW,
      PERMISSIONS.VEREINSLEITUNG_KPI_VIEW,
      PERMISSIONS.VEREINSLEITUNG_PENDENZEN_VIEW,
      PERMISSIONS.VEREINSLEITUNG_PENDENZEN_MANAGE,
    ],
  },
  {
    label: "1.1 Meetings",
    href: "/vereinsleitung/meetings",
    parentLabel: "Vereinsleitung",
    permissionKeys: [
      PERMISSIONS.VEREINSLEITUNG_MEETINGS_VIEW,
      PERMISSIONS.VEREINSLEITUNG_MEETINGS_MANAGE,
    ],
  },
  {
    label: "1.2 Initiativen",
    href: "/vereinsleitung/initiativen",
    parentLabel: "Vereinsleitung",
    permissionKeys: [
      PERMISSIONS.VEREINSLEITUNG_INITIATIVES_VIEW,
      PERMISSIONS.VEREINSLEITUNG_INITIATIVES_MANAGE,
    ],
  },
  {
    label: "1.3 Organigramm",
    href: "/vereinsleitung/organigramm",
    parentLabel: "Vereinsleitung",
    permissionKeys: [PERMISSIONS.VEREINSLEITUNG_VIEW],
  },
  {
    label: "1.4 Kommunikation HUB",
    href: "/vereinsleitung/kommunikation-hub",
    parentLabel: "Vereinsleitung",
    permissionKeys: [PERMISSIONS.VEREINSLEITUNG_VIEW],
  },

  {
    label: "Operations & Organisation",
    href: "/dashboard/operations",
    permissionKeys: [PERMISSIONS.USERS_MANAGE],
  },
  {
    label: "2.1 Finanzen",
    href: "/dashboard/operations/finance",
    parentLabel: "Operations & Organisation",
    permissionKeys: [PERMISSIONS.USERS_MANAGE],
  },
  {
    label: "2.2 Material",
    href: "/dashboard/operations/material",
    parentLabel: "Operations & Organisation",
    permissionKeys: [PERMISSIONS.USERS_MANAGE],
  },
  {
    label: "2.3 Media",
    href: "/dashboard/operations/media",
    parentLabel: "Operations & Organisation",
    permissionKeys: [PERMISSIONS.USERS_MANAGE],
  },
  {
    label: "2.4 AktivitÃ¤ten / Events",
    href: "/dashboard/operations/aktivitaeten-events",
    parentLabel: "Operations & Organisation",
    permissionKeys: [PERMISSIONS.USERS_MANAGE],
  },
  {
    label: "2.5 Business Club",
    href: "/dashboard/operations/business-club",
    parentLabel: "Operations & Organisation",
    permissionKeys: [PERMISSIONS.USERS_MANAGE],
  },
  {
    label: "2.6 Archiv",
    href: "/dashboard/operations/archiv",
    parentLabel: "Operations & Organisation",
    permissionKeys: [PERMISSIONS.USERS_MANAGE],
  },
  {
    label: "2.7 Meetings",
    href: "/dashboard/operations/meetings",
    parentLabel: "Operations & Organisation",
    permissionKeys: [PERMISSIONS.USERS_MANAGE],
  },
  {
    label: "2.8 Ressourcen",
    href: "/dashboard/operations/resources",
    parentLabel: "Operations & Organisation",
    permissionKeys: [PERMISSIONS.USERS_MANAGE],
  },
  {
    label: "2.9 Kommunikation HUB",
    href: "/dashboard/operations/kommunikation-hub",
    parentLabel: "Operations & Organisation",
    permissionKeys: [PERMISSIONS.USERS_MANAGE],
  },

  {
    label: "Technische Kommission",
    href: "/dashboard/technische-kommission",
    permissionKeys: [PERMISSIONS.USERS_MANAGE],
  },
  {
    label: "3.1 Leistungsplan Aktive",
    href: "/dashboard/technische-kommission/leistungsplan-aktive",
    parentLabel: "Technische Kommission",
    permissionKeys: [PERMISSIONS.USERS_MANAGE],
  },
  {
    label: "3.2 Jugend-Ausbildungsplan",
    href: "/dashboard/technische-kommission/jugend-ausbildungsplan",
    parentLabel: "Technische Kommission",
    permissionKeys: [PERMISSIONS.USERS_MANAGE],
  },
  {
    label: "3.3 Meetings",
    href: "/dashboard/technische-kommission/meetings",
    parentLabel: "Technische Kommission",
    permissionKeys: [PERMISSIONS.USERS_MANAGE],
  },
  {
    label: "3.4 Kommunikation HUB",
    href: "/dashboard/technische-kommission/kommunikation-hub",
    parentLabel: "Technische Kommission",
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
    label: "Persons",
    href: "/dashboard/persons",
    permissionKeys: [PERMISSIONS.PEOPLE_VIEW, PERMISSIONS.PEOPLE_MANAGE],
  },
  {
    label: "6.1 Trainers",
    href: "/dashboard/trainers",
    parentLabel: "Persons",
    permissionKeys: [PERMISSIONS.PEOPLE_VIEW, PERMISSIONS.PEOPLE_MANAGE],
  },
  {
    label: "6.2 Players",
    href: "/dashboard/players",
    parentLabel: "Persons",
    permissionKeys: [PERMISSIONS.PEOPLE_VIEW, PERMISSIONS.PEOPLE_MANAGE],
  },
  {
    label: "6.3 VereinsfunktionÃ¤re",
    href: "/dashboard/vereinsfunktionaere",
    parentLabel: "Persons",
    permissionKeys: [PERMISSIONS.PEOPLE_VIEW, PERMISSIONS.PEOPLE_MANAGE],
  },
  {
    label: "6.4 External Contacts",
    href: "/dashboard/external-contacts",
    parentLabel: "Persons",
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
    label: "7.3 Neue VereinsfunktionÃ¤re",
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



