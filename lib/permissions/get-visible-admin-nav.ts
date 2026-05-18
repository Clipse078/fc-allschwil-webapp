import {
  PERMISSIONS,
  type PermissionKey,
} from "@/lib/permissions/permissions";
import type { Messages } from "@/messages/types";

/** Key within the "nav" messages namespace, used by AdminSidebar for i18n. */
export type NavTranslationKey = keyof Messages["nav"];

export type AdminNavItem = {
  /** Fallback display label (used when translationKey is absent or i18n not active) */
  label: string;
  href: string;
  permissionKeys?: PermissionKey[];
  /**
   * Key in the "nav" message namespace.
   * AdminSidebar uses this with useTranslations("nav") when present,
   * falling back to label otherwise.
   */
  translationKey?: NavTranslationKey;
};

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { label: "Dashboard",      href: "/dashboard",                  translationKey: "dashboard"    },
  { label: "Vereinsleitung", href: "/vereinsleitung",             translationKey: "vereinsleitung" },
  // href updated to canonical /meetings route (redirects from /vereinsleitung/meetings are live)
  {
    label: "Meetings",
    href: "/meetings",
    translationKey: "meetings",
    permissionKeys: [PERMISSIONS.MEETINGS_VIEW, PERMISSIONS.MEETINGS_MANAGE],
  },
  // href updated to canonical /initiatives route (redirect from /vereinsleitung/initiativen is live)
  {
    label: "Initiativen",
    href: "/initiatives",
    translationKey: "initiativen",
    permissionKeys: [PERMISSIONS.INITIATIVES_VIEW, PERMISSIONS.INITIATIVES_MANAGE],
  },
  // TODO(decoupling — KPI Module): href will move to KPI_ROUTE_BASE ("/kpis") when
  // the standalone KPI module is built with a real data model and canonical routes.
  // Until then, no permissionKeys gate — access is implicitly via Vereinsleitung session.
  { label: "KPIs",           href: "/vereinsleitung/kpis",        translationKey: "kpis"         },
  {
    label: "Saisons",
    href: "/dashboard/seasons",
    translationKey: "saisons",
    permissionKeys: [PERMISSIONS.SEASONS_VIEW, PERMISSIONS.SEASONS_MANAGE],
  },
  {
    label: "Saisonplanner",
    href: "/dashboard/planner",
    translationKey: "saisonplanner",
    permissionKeys: [PERMISSIONS.WOCHENPLAN_MANAGE],
  },
  {
    label: "Wochenplanner",
    href: "/dashboard/planner/week",
    translationKey: "wochenplanner",
    permissionKeys: [PERMISSIONS.WOCHENPLAN_MANAGE],
  },
  {
    label: "Tagesplanner",
    href: "/dashboard/planner/day",
    translationKey: "tagesplanner",
    permissionKeys: [PERMISSIONS.WOCHENPLAN_MANAGE],
  },
  {
    label: "Teams",
    href: "/dashboard/teams",
    translationKey: "teams",
    permissionKeys: [PERMISSIONS.TEAMS_VIEW, PERMISSIONS.TEAMS_MANAGE],
  },
  {
    label: "Events",
    href: "/dashboard/events",
    translationKey: "events",
    permissionKeys: [PERMISSIONS.EVENTS_VIEW, PERMISSIONS.EVENTS_MANAGE],
  },
  {
    label: "Personen",
    href: "/dashboard/persons",
    translationKey: "personen",
    permissionKeys: [PERMISSIONS.PEOPLE_VIEW, PERMISSIONS.PEOPLE_MANAGE],
  },
  {
    label: "Spieler",
    href: "/dashboard/players",
    translationKey: "spieler",
    permissionKeys: [PERMISSIONS.PEOPLE_VIEW, PERMISSIONS.PEOPLE_MANAGE],
  },
  {
    label: "Trainer",
    href: "/dashboard/trainers",
    translationKey: "trainer",
    permissionKeys: [PERMISSIONS.PEOPLE_VIEW, PERMISSIONS.PEOPLE_MANAGE],
  },
  {
    label: "Benutzer",
    href: "/dashboard/users",
    translationKey: "benutzer",
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
