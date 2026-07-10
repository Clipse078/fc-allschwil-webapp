/**
 * Single source of truth for navigation, module definitions, and permission mapping.
 *
 * All other nav/module files derive from this config.
 * Do not hardcode routes, permissions, or module descriptions elsewhere.
 */

import { PERMISSIONS, type PermissionKey } from "@/lib/permissions/permissions";

// ── Types ────────────────────────────────────────────────────────────────────

export type NavItemChild = {
  key: string;
  label: string;
  href: string;
  permissionKeys?: PermissionKey[];
};

export type NavItem = {
  key: string;
  label: string;
  href: string;
  permissionKeys?: PermissionKey[];
  /** Whether the active season query param should propagate to this href. */
  carrySeason?: boolean;
  /** Sub-items rendered as indented children in the sidebar. */
  children?: NavItemChild[];
};

export type NavSection = {
  /**
   * Label shown as a sidebar section divider.
   * Undefined = no divider (top-level item such as Dashboard).
   */
  sectionLabel?: string;
  items: NavItem[];
};

export type ModuleDefinition = {
  key: string;
  label: string;
  description: string;
  href: string;
  permissionKeys?: PermissionKey[];
  carrySeason?: boolean;
};

// ── Navigation sections ───────────────────────────────────────────────────────
//
// Primary structure: Dashboard · Organisation · Website · Betrieb · Führung · System
//
// Vereinsleitung, Wochenplaner, and Tagesplaner are NOT top-level modules.
// Their routes remain intact — only the sidebar presentation changes.

export const NAV_SECTIONS: NavSection[] = [
  // ── Dashboard ──────────────────────────────────────────────────────────────
  {
    items: [
      {
        key: "dashboard",
        label: "Dashboard",
        href: "/dashboard",
        carrySeason: true,
      },
    ],
  },

  // ── Core modules (Organisation + Website) ─────────────────────────────────
  {
    items: [
      {
        key: "organisation",
        label: "Organisation",
        href: "/dashboard/org-units",
        permissionKeys: [
          PERMISSIONS.ORG_VIEW,
          PERMISSIONS.ORG_MANAGE,
          PERMISSIONS.TEAMS_VIEW,
          PERMISSIONS.TEAMS_MANAGE,
          PERMISSIONS.PEOPLE_VIEW,
          PERMISSIONS.PEOPLE_MANAGE,
        ],
        children: [
          {
            key: "org-units",
            label: "Organisationseinheiten",
            href: "/dashboard/org-units",
            permissionKeys: [PERMISSIONS.ORG_VIEW, PERMISSIONS.ORG_MANAGE],
          },
          {
            key: "target-groups",
            label: "Zielgruppen",
            href: "/dashboard/target-groups",
            permissionKeys: [PERMISSIONS.ORG_VIEW, PERMISSIONS.ORG_MANAGE],
          },
          {
            key: "teams",
            label: "Teams",
            href: "/dashboard/teams",
            permissionKeys: [PERMISSIONS.TEAMS_VIEW, PERMISSIONS.TEAMS_MANAGE],
          },
          {
            key: "personen",
            label: "Personen",
            href: "/dashboard/persons",
            permissionKeys: [PERMISSIONS.PEOPLE_VIEW, PERMISSIONS.PEOPLE_MANAGE],
          },
        ],
      },
      {
        key: "website",
        label: "Website",
        href: "/dashboard/website",
        permissionKeys: [PERMISSIONS.NEWS_MANAGE, PERMISSIONS.WEBSITE_MANAGE],
        children: [
          {
            key: "website-overview",
            label: "CMS Übersicht",
            href: "/dashboard/website",
            permissionKeys: [PERMISSIONS.NEWS_MANAGE, PERMISSIONS.WEBSITE_MANAGE],
          },
          {
            key: "website-news",
            label: "News",
            href: "/dashboard/website/news",
            permissionKeys: [PERMISSIONS.NEWS_MANAGE, PERMISSIONS.WEBSITE_MANAGE],
          },
          {
            key: "website-pages",
            label: "Seiten",
            href: "/dashboard/website/pages",
            permissionKeys: [PERMISSIONS.WEBSITE_MANAGE],
          },
          {
            key: "website-homepage",
            label: "Homepage Builder",
            href: "/dashboard/website/homepage",
            permissionKeys: [PERMISSIONS.WEBSITE_MANAGE],
          },
          {
            key: "website-navigation",
            label: "Navigation",
            href: "/dashboard/website/navigation",
            permissionKeys: [PERMISSIONS.WEBSITE_MANAGE],
          },
          {
            key: "website-blocks",
            label: "Block-Bibliothek",
            href: "/dashboard/website/blocks",
            permissionKeys: [PERMISSIONS.WEBSITE_MANAGE],
          },
          {
            key: "website-media",
            label: "Medien",
            href: "/dashboard/website/media",
            permissionKeys: [PERMISSIONS.NEWS_MANAGE, PERMISSIONS.WEBSITE_MANAGE],
          },
          {
            key: "website-editorial",
            label: "Redaktion",
            href: "/dashboard/website/editorial",
            permissionKeys: [PERMISSIONS.WEBSITE_MANAGE],
          },
          {
            key: "website-publishing",
            label: "Veröffentlichungen",
            href: "/dashboard/website/publishing",
            permissionKeys: [PERMISSIONS.NEWS_MANAGE, PERMISSIONS.WEBSITE_MANAGE],
          },
          {
            key: "website-components",
            label: "Wiederverwendbare Inhalte",
            href: "/dashboard/website/components",
            permissionKeys: [PERMISSIONS.WEBSITE_MANAGE],
          },
          {
            key: "website-settings",
            label: "Einstellungen",
            href: "/dashboard/website/settings",
            permissionKeys: [PERMISSIONS.WEBSITE_MANAGE],
          },
        ],
      },
    ],
  },

  // ── Betrieb ────────────────────────────────────────────────────────────────
  {
    sectionLabel: "Betrieb",
    items: [
      {
        key: "planung",
        label: "Planung",
        href: "/dashboard/planner",
        carrySeason: true,
        permissionKeys: [
          PERMISSIONS.WOCHENPLAN_MANAGE,
          PERMISSIONS.SEASONS_VIEW,
          PERMISSIONS.SEASONS_MANAGE,
          PERMISSIONS.EVENTS_VIEW,
          PERMISSIONS.EVENTS_MANAGE,
        ],
        children: [
          {
            key: "saisons",
            label: "Saisons",
            href: "/dashboard/seasons",
            permissionKeys: [PERMISSIONS.SEASONS_VIEW, PERMISSIONS.SEASONS_MANAGE],
          },
          {
            key: "saisonplanung",
            label: "Saisonplanung",
            href: "/dashboard/planner",
            permissionKeys: [PERMISSIONS.WOCHENPLAN_MANAGE],
          },
          {
            key: "events",
            label: "Events",
            href: "/dashboard/events",
            permissionKeys: [PERMISSIONS.EVENTS_VIEW, PERMISSIONS.EVENTS_MANAGE],
          },
          {
            key: "feldressourcen",
            label: "Feld & Ressourcen",
            href: "/dashboard/wochenplan",
            permissionKeys: [PERMISSIONS.WOCHENPLAN_MANAGE],
          },
        ],
      },
      {
        key: "anmeldungen",
        label: "Anmeldungen",
        href: "/dashboard/registrations",
        permissionKeys: [PERMISSIONS.REGISTRATIONS_VIEW, PERMISSIONS.REGISTRATIONS_EDIT],
      },
      {
        key: "infoboard",
        label: "Infoboard",
        href: "/dashboard/infoboard",
        permissionKeys: [PERMISSIONS.INFOBOARD_MANAGE, PERMISSIONS.EVENTS_PUBLISH_INFOBOARD],
      },
    ],
  },

  // ── Führung ────────────────────────────────────────────────────────────────
  {
    sectionLabel: "Führung",
    items: [
      {
        key: "meetings",
        label: "Meetings",
        href: "/vereinsleitung/meetings",
      },
      {
        key: "initiativen",
        label: "Initiativen",
        href: "/vereinsleitung/initiativen",
      },
    ],
  },

  // ── System ─────────────────────────────────────────────────────────────────
  {
    sectionLabel: "System",
    items: [
      {
        key: "administration",
        label: "Administration",
        href: "/dashboard/admin/branding",
        permissionKeys: [
          PERMISSIONS.USERS_MANAGE,
          PERMISSIONS.FACILITIES_VIEW,
          PERMISSIONS.FACILITIES_MANAGE,
          PERMISSIONS.TENANTS_VIEW,
          PERMISSIONS.TENANTS_MANAGE,
        ],
        children: [
          {
            key: "admin-branding",
            label: "Darstellung",
            href: "/dashboard/admin/branding",
            permissionKeys: [PERMISSIONS.USERS_MANAGE],
          },
          {
            key: "admin-facilities",
            label: "Anlagen & Ressourcen",
            href: "/dashboard/admin/facilities",
            permissionKeys: [PERMISSIONS.FACILITIES_VIEW, PERMISSIONS.FACILITIES_MANAGE],
          },
          {
            key: "admin-users",
            label: "Benutzer",
            href: "/dashboard/users",
            permissionKeys: [PERMISSIONS.USERS_MANAGE],
          },
          {
            key: "admin-roles",
            label: "Rollen",
            href: "/dashboard/roles",
            permissionKeys: [PERMISSIONS.USERS_MANAGE],
          },
          {
            key: "admin-tenants",
            label: "Tenants",
            href: "/dashboard/admin/tenants",
            permissionKeys: [PERMISSIONS.TENANTS_VIEW, PERMISSIONS.TENANTS_MANAGE],
          },
          {
            key: "admin-integrations",
            label: "Integrationen",
            href: "/dashboard/admin/integrations",
            permissionKeys: [PERMISSIONS.TENANTS_MANAGE],
          },
        ],
      },
    ],
  },
];

// ── Module definitions (dashboard cards) ─────────────────────────────────────

export const MODULE_DEFINITIONS: ModuleDefinition[] = [
  {
    key: "admin",
    label: "Admin",
    description: "Tenant-Setup, Organisation, Benutzer und Plattform-Governance.",
    href: "/admin",
    permissionKeys: [PERMISSIONS.USERS_MANAGE],
    carrySeason: false,
  },
  {
    key: "vereinsleitung",
    label: "Vereinsleitung",
    description: "Meetings, Initiativen, KPIs und Entscheidungen.",
    href: "/vereinsleitung",
    carrySeason: false,
  },
  {
    key: "seasons",
    label: "Saisons",
    description: "Führende Struktur für Teams, Events und Planner.",
    href: "/dashboard/seasons",
    permissionKeys: [PERMISSIONS.SEASONS_VIEW, PERMISSIONS.SEASONS_MANAGE],
    carrySeason: true,
  },
  {
    key: "saisonplanner",
    label: "Saisonplanner",
    description: "Trainings, Matches, Turniere und Ferienperioden.",
    href: "/dashboard/planner",
    permissionKeys: [PERMISSIONS.WOCHENPLAN_MANAGE],
    carrySeason: true,
  },
  {
    key: "teams",
    label: "Teams",
    description: "Teams saisongeführt verwalten und aufbauen.",
    href: "/dashboard/teams",
    permissionKeys: [PERMISSIONS.TEAMS_VIEW, PERMISSIONS.TEAMS_MANAGE],
    carrySeason: true,
  },
  {
    key: "events",
    label: "Events",
    description: "Matches, Turniere, Trainings und Vereinsereignisse.",
    href: "/dashboard/events",
    permissionKeys: [PERMISSIONS.EVENTS_VIEW, PERMISSIONS.EVENTS_MANAGE],
    carrySeason: true,
  },
  {
    key: "personen",
    label: "Personen",
    description: "Stammdaten für Spieler, Trainer und weitere Rollen.",
    href: "/dashboard/persons",
    permissionKeys: [PERMISSIONS.PEOPLE_VIEW, PERMISSIONS.PEOPLE_MANAGE],
    carrySeason: false,
  },
  {
    key: "infoboard",
    label: "Infoboard",
    description: "Öffentliches Anzeigeboard für Events, Resultate und Spielplan.",
    href: "/dashboard/infoboard",
    permissionKeys: [PERMISSIONS.INFOBOARD_MANAGE, PERMISSIONS.EVENTS_PUBLISH_INFOBOARD],
    carrySeason: false,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function hasAccess(userKeys: PermissionKey[], required?: PermissionKey[]): boolean {
  if (!required || required.length === 0) return true;
  return required.some((p) => userKeys.includes(p));
}

/** Returns nav sections filtered to the given permission keys. */
export function getVisibleNavSections(permissionKeys: PermissionKey[]): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items
      .filter((item) => hasAccess(permissionKeys, item.permissionKeys))
      .map((item) => ({
        ...item,
        children: item.children?.filter((child) =>
          hasAccess(permissionKeys, child.permissionKeys),
        ),
      })),
  })).filter((section) => section.items.length > 0);
}

/** Returns module definitions visible to the given permission keys. */
export function getVisibleModules(permissionKeys: PermissionKey[]): ModuleDefinition[] {
  return MODULE_DEFINITIONS.filter((m) => hasAccess(permissionKeys, m.permissionKeys));
}

/**
 * Flattens nav sections to a flat list (parent + children interleaved).
 * Used by legacy adapters in lib/permissions/.
 */
export function flattenNavSections(
  sections: NavSection[],
): Array<{ label: string; href: string; permissionKeys?: PermissionKey[] }> {
  return sections.flatMap((section) =>
    section.items.flatMap((item) => [
      { label: item.label, href: item.href, permissionKeys: item.permissionKeys },
      ...(item.children ?? []).map((c) => ({
        label: c.label,
        href: c.href,
        permissionKeys: c.permissionKeys,
      })),
    ]),
  );
}
