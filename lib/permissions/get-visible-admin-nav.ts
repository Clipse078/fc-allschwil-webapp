import {
  PERMISSIONS,
  type PermissionKey,
} from "@/lib/permissions/permissions";

export type AdminNavItem = {
  label: string;
  href: string;
  permissionKeys?: PermissionKey[];
  roleKeys?: string[];
  /** "platform" = SportClubEvo platform section; "club" / "main" = active-club section */
  section?: "main" | "club" | "platform";
  /** Renders as a non-interactive "coming soon" placeholder */
  disabled?: boolean;
};

// ── Platform section ─────────────────────────────────────────────────────────
// Shown first, product-identity items. Dashboard is intentionally in this
// section so it anchors the SportClubEvo frame, not the club frame.

const PLATFORM_ITEMS: AdminNavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    section: "platform",
  },
  {
    label: "Tenants / Clubs",
    href: "/dashboard/tenants",
    roleKeys: ["super_admin"],
    section: "platform",
  },
  {
    label: "Users & Roles",
    href: "/dashboard/users",
    permissionKeys: [PERMISSIONS.USERS_MANAGE],
    section: "platform",
  },
  {
    label: "Runtime",
    href: "/dashboard/runtime",
    roleKeys: ["super_admin"],
    section: "platform",
  },
  {
    label: "Audit Logs",
    href: "/dashboard/logs",
    roleKeys: ["super_admin"],
    section: "platform",
  },
  {
    label: "Platform Settings",
    href: "/dashboard/platform/settings",
    roleKeys: ["super_admin"],
    section: "platform",
  },
];

// ── Club / tenant section ─────────────────────────────────────────────────────
// Shown under "Active Club". Children of Vereinsleitung and Saisonplanner are
// inlined here so the sidebar can nest them.

const CLUB_ITEMS: AdminNavItem[] = [
  {
    label: "Vereinsleitung",
    href: "/vereinsleitung",
    section: "club",
  },
  {
    label: "Meetings",
    href: "/vereinsleitung/meetings",
    section: "club",
  },
  {
    label: "Initiativen",
    href: "/vereinsleitung/initiativen",
    section: "club",
  },
  {
    label: "KPIs",
    href: "/vereinsleitung/kpis",
    section: "club",
  },
  {
    label: "Saisons",
    href: "/dashboard/seasons",
    permissionKeys: [PERMISSIONS.SEASONS_VIEW, PERMISSIONS.SEASONS_MANAGE],
    section: "club",
  },
  {
    label: "Saisonplanner",
    href: "/dashboard/planner",
    permissionKeys: [PERMISSIONS.WOCHENPLAN_MANAGE],
    section: "club",
  },
  {
    label: "Wochenplanner",
    href: "/dashboard/planner/week",
    permissionKeys: [PERMISSIONS.WOCHENPLAN_MANAGE],
    section: "club",
  },
  {
    label: "Tagesplanner",
    href: "/dashboard/planner/day",
    permissionKeys: [PERMISSIONS.WOCHENPLAN_MANAGE],
    section: "club",
  },
  {
    label: "Teams",
    href: "/dashboard/teams",
    permissionKeys: [PERMISSIONS.TEAMS_VIEW, PERMISSIONS.TEAMS_MANAGE],
    section: "club",
  },
  {
    label: "Events",
    href: "/dashboard/events",
    permissionKeys: [PERMISSIONS.EVENTS_VIEW, PERMISSIONS.EVENTS_MANAGE],
    section: "club",
  },
  {
    label: "Personen",
    href: "/dashboard/persons",
    permissionKeys: [PERMISSIONS.PEOPLE_VIEW, PERMISSIONS.PEOPLE_MANAGE],
    section: "club",
  },
  {
    label: "Spieler",
    href: "/dashboard/players",
    permissionKeys: [PERMISSIONS.PEOPLE_VIEW, PERMISSIONS.PEOPLE_MANAGE],
    section: "club",
  },
  {
    label: "Trainer",
    href: "/dashboard/trainers",
    permissionKeys: [PERMISSIONS.PEOPLE_VIEW, PERMISSIONS.PEOPLE_MANAGE],
    section: "club",
  },
];

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  ...PLATFORM_ITEMS,
  ...CLUB_ITEMS,
];

function isVisible(item: AdminNavItem, permissionKeys: PermissionKey[], roleKeys: string[]) {
  if (item.disabled) {
    // Placeholders still gated by role so only superadmin sees them
    if (item.roleKeys && item.roleKeys.length > 0) {
      return item.roleKeys.some((k) => roleKeys.includes(k));
    }
    return true;
  }

  if (item.roleKeys && item.roleKeys.length > 0) {
    return item.roleKeys.some((k) => roleKeys.includes(k));
  }

  if (!item.permissionKeys || item.permissionKeys.length === 0) {
    return true;
  }

  return item.permissionKeys.some((pk) => permissionKeys.includes(pk));
}

export function getVisibleAdminNav(
  permissionKeys: PermissionKey[],
  roleKeys: string[] = [],
): AdminNavItem[] {
  return ADMIN_NAV_ITEMS.filter((item) => isVisible(item, permissionKeys, roleKeys));
}
