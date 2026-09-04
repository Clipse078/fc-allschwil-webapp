/**
 * Navigation-aligned permission presentation for tenant role create/edit flows.
 *
 * Derives editor structure from lib/nav/nav-config.ts (NAV_SECTIONS) so Club
 * Admins configure roles using the same product hierarchy as the sidebar.
 * Does not duplicate routes or invent permission semantics.
 */

import { NAV_SECTIONS, type NavItem, type NavItemChild } from "@/lib/nav/nav-config";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  getPermissionDisplayMeta,
  isDangerousPermission,
} from "@/lib/roles/permission-metadata";

export type PermissionCatalogRow = {
  id: string;
  key: string;
  name: string;
  module: string;
};

export type StandardControlKind = "view" | "manage";

export type StandardControl = {
  kind: StandardControlKind;
  label: string;
  permissionKeys: string[];
};

export type AdvancedPermission = {
  key: string;
  label: string;
  description: string;
  dangerous: boolean;
};

export type PermissionUnit = {
  id: string;
  label: string;
  /** Concise supporting copy — one line only when it adds meaning. */
  description?: string;
  /** Sidebar nav label used to resolve the SCE module icon. */
  iconLabel: string;
  childLabels?: string[];
  parentLabel?: string;
  sharedNote?: string;
  derivedNote?: string;
  isDerived?: boolean;
  standardControls: StandardControl[];
  advancedPermissions: AdvancedPermission[];
};

export type PermissionPresentationSection = {
  key: string;
  label: string;
  units: PermissionUnit[];
};

export type NavPermissionPresentation = {
  sections: PermissionPresentationSection[];
  /** Grantable permissions not mapped to a nav item — still assignable. */
  supplementalUnit: PermissionUnit | null;
};

export type NavPermissionSummaryItem = {
  label: string;
  access: string;
  advanced?: boolean;
};

export type NavPermissionSummarySection = {
  label: string;
  /** Concise module names for role preview, e.g. "Teams · Personen". */
  modules: string[];
  items: NavPermissionSummaryItem[];
};

const SPIELBETRIEB_CHILD_KEYS = new Set(["matchcenter", "tournamentcenter", "veranstaltungen"]);
const WOCHENPLANNER_KEY = "wochenplanner";
const TRAININGCENTER_KEY = "trainingcenter";

const WEBSITE_NEWS_CHILD_KEYS = new Set([
  "website-news",
  "website-publishing",
  "website-overview",
]);
const WEBSITE_MEDIA_CHILD_KEYS = new Set(["website-media"]);
const WEBSITE_CMS_CHILD_KEYS = new Set([
  "website-pages",
  "website-homepage",
  "website-navigation",
  "website-blocks",
  "website-editorial",
  "website-components",
  "website-settings",
]);

function collectChildPermissionKeys(
  children: NavItemChild[],
  catalog: Map<string, PermissionCatalogRow>,
): string[] {
  const keys = new Set<string>();
  for (const child of children) {
    for (const key of filterGrantableKeys(child.permissionKeys, catalog)) {
      keys.add(key);
    }
  }
  return Array.from(keys);
}

function buildWebsiteUnits(
  parentItem: NavItem,
  children: NavItemChild[],
  catalog: Map<string, PermissionCatalogRow>,
): PermissionUnit[] {
  const units: PermissionUnit[] = [];
  const newsChildren = children.filter((child) => WEBSITE_NEWS_CHILD_KEYS.has(child.key));
  const mediaChildren = children.filter((child) => WEBSITE_MEDIA_CHILD_KEYS.has(child.key));
  const cmsChildren = children.filter((child) => WEBSITE_CMS_CHILD_KEYS.has(child.key));

  const newsKeys = collectChildPermissionKeys(newsChildren, catalog).filter(
    (key) => key === PERMISSIONS.NEWS_MANAGE,
  );
  const mediaKeys = collectChildPermissionKeys(mediaChildren, catalog).filter(
    (key) => key === PERMISSIONS.WEBSITE_MANAGE,
  );
  const cmsKeys = collectChildPermissionKeys(cmsChildren, catalog).filter(
    (key) => key === PERMISSIONS.WEBSITE_MANAGE,
  );

  const newsUnit = createUnit(
    `${parentItem.key}-news`,
    "News",
    newsKeys.length > 0 ? newsKeys : collectChildPermissionKeys(newsChildren, catalog),
    catalog,
    {
      description: "News und Beiträge veröffentlichen",
      iconLabel: "News",
      parentLabel: parentItem.label,
    },
  );
  if (newsUnit) units.push(newsUnit);

  const websiteCmsKeys = Array.from(new Set([...cmsKeys, ...mediaKeys]));
  const websiteCmsUnit = createUnit(
    `${parentItem.key}-cms`,
    "Website / CMS",
    websiteCmsKeys,
    catalog,
    {
      description: "Seiten, Homepage, Navigation, Medien und Einstellungen",
      iconLabel: "Seiten",
      parentLabel: parentItem.label,
    },
  );
  if (websiteCmsUnit) units.push(websiteCmsUnit);

  const medienOnlyKeys = mediaKeys.filter((key) => !websiteCmsKeys.includes(key));
  if (medienOnlyKeys.length > 0) {
    const medienUnit = createUnit(
      `${parentItem.key}-medien`,
      "Medien",
      medienOnlyKeys,
      catalog,
      {
        description: "Medienbibliothek und Dateien",
        iconLabel: "Medien",
        parentLabel: parentItem.label,
      },
    );
    if (medienUnit) units.push(medienUnit);
  }

  return units;
}

type UnitPresentation = {
  label: string;
  description?: string;
  iconLabel: string;
};

/** Product-language labels and icons for nav-aligned permission units. */
const UNIT_DESCRIPTION_BY_NAV_KEY: Record<string, string> = {
  teams: "Mannschaften und Kader",
  "provider-mapping": "Externe Anbieter und Team-Zuordnungen",
  personen: "Personenstammdaten und Profile",
  competitions: "Ligen und Wettbewerbe",
  trainingcenter: "Trainingsplanung und Serien",
  wochenplanner: "Aggregierter Wochenüberblick",
  workspace: "Dokumente und Vereinsarbeitsbereich",
  sponsoring: "Sponsoring und Partnerschaften",
  "admin-tenant-roles": "Rollen und Berechtigungen im Verein",
  "admin-seasons": "Saisons und Planungsperioden",
  "admin-facilities": "Anlagen, Plätze und Ressourcen",
  "admin-people-access": "Benutzer, Einladungen und Zugänge",
  "admin-tenants": "Mandantenverwaltung (Plattform)",
  "admin-integrations": "Externe Systemanbindungen",
  "website-news": "News und Beiträge veröffentlichen",
  "website-media": "Medienbibliothek und Dateien",
};

const FUNCTIONS_MANAGE_KEY = PERMISSIONS.FUNCTIONS_MANAGE;

function presentationForNavChild(child: NavItemChild): UnitPresentation {
  const description = UNIT_DESCRIPTION_BY_NAV_KEY[child.key];
  if (child.key === "competitions") {
    return { label: "Wettbewerbe", description, iconLabel: "Wettkämpfe" };
  }
  if (child.key === "personen") {
    return { label: "Mitglieder", description, iconLabel: "Personen" };
  }
  if (child.key === "communication-email-sender") {
    return {
      label: "Kommunikation",
      description: "E-Mail-Absender und Vereinskommunikation",
      iconLabel: "Kommunikation",
    };
  }
  if (child.key === "website-news") {
    return { label: "News", description, iconLabel: "News" };
  }
  if (child.key === "website-media") {
    return { label: "Medien", description, iconLabel: "Medien" };
  }
  if (child.key === "admin-tenant-roles") {
    return {
      label: "Rollen & Berechtigungen",
      description,
      iconLabel: "Rollen & Berechtigungen",
    };
  }
  if (child.key === "admin-seasons") {
    return { label: "Saisons", description, iconLabel: "Saisons" };
  }
  if (child.key === "admin-facilities") {
    return {
      label: "Anlagen & Ressourcen",
      description,
      iconLabel: "Anlagen & Ressourcen",
    };
  }
  if (child.key === "admin-people-access") {
    return {
      label: "Personen & Zugänge",
      description,
      iconLabel: "Personen & Zugänge",
    };
  }
  if (child.key === "admin-branding") {
    return {
      label: "Administration",
      description: "Club-Darstellung und Vereinseinstellungen",
      iconLabel: "Darstellung",
    };
  }
  return {
    label: child.label,
    description,
    iconLabel: child.label,
  };
}

function presentationForChildGroup(children: NavItemChild[]): UnitPresentation {
  const keys = new Set(children.map((child) => child.key));

  if (keys.has("org-units") && keys.has("target-groups") && keys.has("vereine")) {
    return {
      label: "Vereinsdaten",
      description: "Organisationseinheiten, Zielgruppen und Vereinsstruktur",
      iconLabel: "Organisationseinheiten",
    };
  }

  if (keys.has("website-news") || keys.has("website-publishing")) {
    return {
      label: "News",
      description: "News und Beiträge veröffentlichen",
      iconLabel: "News",
    };
  }

  if (keys.has("website-media")) {
    return {
      label: "Medien",
      description: "Medienbibliothek und Dateien",
      iconLabel: "Medien",
    };
  }

  if (
    keys.has("website-pages") ||
    keys.has("website-homepage") ||
    keys.has("website-navigation") ||
    keys.has("website-overview")
  ) {
    return {
      label: "Website / CMS",
      description: "Seiten, Homepage, Navigation und Einstellungen",
      iconLabel: "Seiten",
    };
  }

  if (keys.has("registrierungen") && keys.has("warteliste") && keys.has("archiv")) {
    return {
      label: "Anmeldungen",
      description: "Registrierungen, Warteliste und Archiv",
      iconLabel: "Anmeldungen",
    };
  }

  if (keys.has("infoboard-overview") && keys.has("infoboard-preview")) {
    return {
      label: "Infoboard",
      description: "Übersicht und Vorschau",
      iconLabel: "Infoboard",
    };
  }

  if (keys.has("admin-branding") && keys.has("admin-roles")) {
    return {
      label: "Darstellung & Rollen",
      description: "Club-Darstellung und interne Rollenzuweisung",
      iconLabel: "Darstellung",
    };
  }

  if (children.length === 1) {
    return presentationForNavChild(children[0]!);
  }

  const primary = children[0]!;
  return {
    label: primary.label,
    description: children.map((child) => child.label).join(", "),
    iconLabel: primary.label,
  };
}

function presentationForTopLevelItem(item: NavItem): UnitPresentation {
  const description = UNIT_DESCRIPTION_BY_NAV_KEY[item.key];
  if (item.key === "workspace") {
    return { label: "Dokumente", description, iconLabel: "Dokumente" };
  }
  return {
    label: item.label,
    description,
    iconLabel: item.label,
  };
}

const MANAGE_REQUIRES_VIEW: Record<string, string> = {
  [PERMISSIONS.ORG_MANAGE]: PERMISSIONS.ORG_VIEW,
  [PERMISSIONS.TEAMS_MANAGE]: PERMISSIONS.TEAMS_VIEW,
  [PERMISSIONS.PEOPLE_MANAGE]: PERMISSIONS.PEOPLE_VIEW,
  [PERMISSIONS.COMPETITIONS_MANAGE]: PERMISSIONS.COMPETITIONS_VIEW,
  [PERMISSIONS.EVENTS_MANAGE]: PERMISSIONS.EVENTS_VIEW,
  [PERMISSIONS.TRAININGS_MANAGE]: PERMISSIONS.TRAININGS_VIEW,
  [PERMISSIONS.WORKSPACE_MANAGE]: PERMISSIONS.WORKSPACE_VIEW,
  [PERMISSIONS.SEASONS_MANAGE]: PERMISSIONS.SEASONS_VIEW,
  [PERMISSIONS.FACILITIES_MANAGE]: PERMISSIONS.FACILITIES_VIEW,
  [PERMISSIONS.ROLES_MANAGE]: PERMISSIONS.ROLES_VIEW,
  [PERMISSIONS.REGISTRATIONS_EDIT]: PERMISSIONS.REGISTRATIONS_VIEW,
  [PERMISSIONS.USERS_MANAGE_MEMBERSHIPS]: PERMISSIONS.USERS_VIEW,
  [PERMISSIONS.TARGETS_MANAGE]: PERMISSIONS.TARGETS_VIEW,
  [PERMISSIONS.MEETINGS_MANAGE]: PERMISSIONS.MEETINGS_VIEW,
  [PERMISSIONS.INITIATIVES_MANAGE]: PERMISSIONS.INITIATIVES_VIEW,
  [PERMISSIONS.TEMPLATES_MANAGE]: PERMISSIONS.TEMPLATES_VIEW,
  [PERMISSIONS.PEOPLE_DEVELOPMENT_MANAGE]: PERMISSIONS.PEOPLE_DEVELOPMENT_VIEW,
  [PERMISSIONS.PEOPLE_ASSESSMENTS_MANAGE]: PERMISSIONS.PEOPLE_ASSESSMENTS_VIEW,
  [PERMISSIONS.PEOPLE_HEALTH_MANAGE]: PERMISSIONS.PEOPLE_HEALTH_VIEW,
  [PERMISSIONS.PEOPLE_FINANCE_MANAGE]: PERMISSIONS.PEOPLE_FINANCE_VIEW,
  [PERMISSIONS.PEOPLE_PRIVATE_DOCUMENTS_MANAGE]: PERMISSIONS.PEOPLE_PRIVATE_DOCUMENTS_VIEW,
  [PERMISSIONS.PEOPLE_CONTACT_MANAGE]: PERMISSIONS.PEOPLE_CONTACT_VIEW,
};

const VIEW_TO_MANAGE = Object.fromEntries(
  Object.entries(MANAGE_REQUIRES_VIEW).map(([manage, view]) => [view, manage]),
);

const MANAGE_ONLY_KEYS: ReadonlySet<string> = new Set([
  PERMISSIONS.NEWS_MANAGE,
  PERMISSIONS.WEBSITE_MANAGE,
  PERMISSIONS.INFOBOARD_MANAGE,
  PERMISSIONS.WOCHENPLAN_MANAGE,
  PERMISSIONS.FUNCTIONS_MANAGE,
]);

const PERSON_DOMAIN_PREFIXES = [
  "people.development.",
  "people.assessments.",
  "people.health.",
  "people.finance.",
  "people.private_documents.",
  "people.audit.",
  "people.contact.",
];

function isPersonDomainPermission(key: string): boolean {
  return PERSON_DOMAIN_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function isAdvancedPermissionKey(key: string): boolean {
  if (isDangerousPermission(key)) return true;
  if (isPersonDomainPermission(key)) return true;
  if (key.endsWith(".import")) return true;
  if (key.includes("publish")) return true;
  if (key === PERMISSIONS.USERS_INVITE) return true;
  if (key === PERMISSIONS.ROLES_ASSIGN) return true;
  if (key.startsWith("fixtures.")) return true;
  return false;
}

function isStandardViewKey(key: string): boolean {
  return key.endsWith(".view") && !isPersonDomainPermission(key);
}

function isStandardManageKey(key: string): boolean {
  if (key === PERMISSIONS.REGISTRATIONS_EDIT) return true;
  return key.endsWith(".manage") && !isPersonDomainPermission(key);
}

function toAdvancedPermission(row: PermissionCatalogRow): AdvancedPermission {
  const meta = getPermissionDisplayMeta(row.key, row.name, row.module);
  return {
    key: row.key,
    label: meta.label,
    description: meta.description,
    dangerous: meta.dangerous,
  };
}

function filterGrantableKeys(
  keys: string[] | undefined,
  catalog: Map<string, PermissionCatalogRow>,
): string[] {
  if (!keys) return [];
  return keys.filter((key) => catalog.has(key));
}

function buildControlsFromKeys(
  keys: string[],
  catalog: Map<string, PermissionCatalogRow>,
): { standardControls: StandardControl[]; advancedPermissions: AdvancedPermission[] } {
  const viewKeys: string[] = [];
  const manageKeys: string[] = [];
  const advancedPermissions: AdvancedPermission[] = [];

  for (const key of keys) {
    const row = catalog.get(key);
    if (!row) continue;

    if (isAdvancedPermissionKey(key)) {
      advancedPermissions.push(toAdvancedPermission(row));
      continue;
    }
    if (isStandardViewKey(key)) {
      viewKeys.push(key);
      continue;
    }
    if (isStandardManageKey(key) || MANAGE_ONLY_KEYS.has(key)) {
      manageKeys.push(key);
      continue;
    }
    advancedPermissions.push(toAdvancedPermission(row));
  }

  const standardControls: StandardControl[] = [];
  if (viewKeys.length > 0) {
    standardControls.push({ kind: "view", label: "Ansehen", permissionKeys: viewKeys });
  }
  if (manageKeys.length > 0) {
    standardControls.push({ kind: "manage", label: "Verwalten", permissionKeys: manageKeys });
  }

  return { standardControls, advancedPermissions };
}

function createUnit(
  id: string,
  label: string,
  keys: string[],
  catalog: Map<string, PermissionCatalogRow>,
  options: Partial<
    Pick<
      PermissionUnit,
      | "description"
      | "iconLabel"
      | "childLabels"
      | "parentLabel"
      | "sharedNote"
      | "derivedNote"
      | "isDerived"
    >
  > = {},
): PermissionUnit | null {
  const grantableKeys = keys.filter((key) => catalog.has(key));
  if (grantableKeys.length === 0 && !options.isDerived) return null;

  const { standardControls, advancedPermissions } = buildControlsFromKeys(grantableKeys, catalog);

  if (!options.isDerived && standardControls.length === 0 && advancedPermissions.length === 0) {
    return null;
  }

  return {
    id,
    label,
    description: options.description,
    iconLabel: options.iconLabel ?? label,
    childLabels: options.childLabels,
    parentLabel: options.parentLabel,
    sharedNote: options.sharedNote,
    derivedNote: options.derivedNote,
    isDerived: options.isDerived,
    standardControls,
    advancedPermissions,
  };
}

function groupChildrenUnits(
  parentItem: NavItem,
  children: NavItemChild[],
  catalog: Map<string, PermissionCatalogRow>,
): PermissionUnit[] {
  const units: PermissionUnit[] = [];
  const spielbetriebChildren = children.filter((c) => SPIELBETRIEB_CHILD_KEYS.has(c.key));
  const regularChildren = children.filter(
    (c) => !SPIELBETRIEB_CHILD_KEYS.has(c.key) && c.key !== WOCHENPLANNER_KEY,
  );

  const trainingChild = children.find((c) => c.key === TRAININGCENTER_KEY);
  if (trainingChild) {
    const presentation = presentationForNavChild(trainingChild);
    const unit = createUnit(
      `${parentItem.key}-${trainingChild.key}`,
      presentation.label,
      filterGrantableKeys(trainingChild.permissionKeys, catalog),
      catalog,
      {
        description: presentation.description,
        iconLabel: presentation.iconLabel,
        parentLabel: parentItem.label,
      },
    );
    if (unit) units.push(unit);
  }

  if (spielbetriebChildren.length > 0) {
    const keys = new Set<string>();
    for (const child of spielbetriebChildren) {
      for (const key of filterGrantableKeys(child.permissionKeys, catalog)) {
        keys.add(key);
      }
    }
    const unit = createUnit(
      `${parentItem.key}-spielbetrieb`,
      "Spielbetrieb",
      Array.from(keys),
      catalog,
      {
        description: "MatchCenter · TournamentCenter · Veranstaltungen",
        iconLabel: "MatchCenter",
        parentLabel: parentItem.label,
        childLabels: spielbetriebChildren.map((c) => c.label),
      },
    );
    if (unit) units.push(unit);
  }

  const wochenplannerChild = children.find((c) => c.key === WOCHENPLANNER_KEY);
  if (wochenplannerChild) {
    const presentation = presentationForNavChild(wochenplannerChild);
    units.push({
      id: `${parentItem.key}-${WOCHENPLANNER_KEY}`,
      label: presentation.label,
      description: presentation.description,
      iconLabel: presentation.iconLabel,
      parentLabel: parentItem.label,
      isDerived: true,
      derivedNote:
        "Verfügbar bei Zugriff auf TrainingCenter oder Spielbetrieb.",
      standardControls: [],
      advancedPermissions: [],
    });
  }

  if (parentItem.key === "website") {
    units.push(...buildWebsiteUnits(parentItem, regularChildren, catalog));
    return units;
  }

  const signatureGroups = new Map<string, { children: NavItemChild[]; keys: string[] }>();
  for (const child of regularChildren) {
    if (child.key === TRAININGCENTER_KEY) continue;

    const keys = filterGrantableKeys(child.permissionKeys, catalog);
    if (keys.length === 0) continue;

    if (parentItem.key === "administration") {
      const presentation = presentationForNavChild(child);
      const unit = createUnit(
        `${parentItem.key}-${child.key}`,
        presentation.label,
        keys,
        catalog,
        {
          description: presentation.description,
          iconLabel: presentation.iconLabel,
          parentLabel: parentItem.label,
        },
      );
      if (unit) units.push(unit);
      continue;
    }

    const signature = [...keys].sort().join("|");
    const group = signatureGroups.get(signature) ?? { children: [], keys };
    group.children.push(child);
    signatureGroups.set(signature, group);
  }

  for (const [signature, group] of signatureGroups) {
    const presentation = presentationForChildGroup(group.children);

    const unit = createUnit(
      `${parentItem.key}-${signature}`,
      presentation.label,
      group.keys,
      catalog,
      {
        description: presentation.description,
        iconLabel: presentation.iconLabel,
        parentLabel: parentItem.label,
        childLabels:
          group.children.length > 1 && presentation.label === group.children.map((c) => c.label).join(" · ")
            ? group.children.map((c) => c.label)
            : undefined,
      },
    );
    if (unit) units.push(unit);
  }

  return units;
}

function processNavItem(
  item: NavItem,
  sectionLabel: string,
  catalog: Map<string, PermissionCatalogRow>,
): PermissionUnit[] {
  if (item.children && item.children.length > 0) {
    return groupChildrenUnits(item, item.children, catalog);
  }

  const keys = filterGrantableKeys(item.permissionKeys, catalog);
  const presentation = presentationForTopLevelItem(item);
  const unit = createUnit(item.key, presentation.label, keys, catalog, {
    description: presentation.description,
    iconLabel: presentation.iconLabel,
  });
  return unit ? [unit] : [];
}

function prefixesForAdvancedAttachment(unit: PermissionUnit): string[] {
  if (unit.label === "Spielbetrieb") {
    return ["events.", "matches.", "tournaments."];
  }
  if (unit.label === "TrainingCenter") {
    return ["trainings."];
  }

  const prefixes = new Set<string>();
  for (const control of unit.standardControls) {
    for (const key of control.permissionKeys) {
      const lastDot = key.lastIndexOf(".");
      if (lastDot > 0) prefixes.add(`${key.slice(0, lastDot + 1)}`);
    }
  }
  return Array.from(prefixes);
}

function attachCatalogAdvancedPermissions(
  units: PermissionUnit[],
  catalog: Map<string, PermissionCatalogRow>,
  mappedKeys: Set<string>,
): void {
  for (const unit of units) {
    if (unit.isDerived) continue;

    const prefixes = prefixesForAdvancedAttachment(unit);
    if (prefixes.length === 0) continue;

    const existingAdvanced = new Set(unit.advancedPermissions.map((permission) => permission.key));
    const standardKeys = new Set(
      unit.standardControls.flatMap((control) => control.permissionKeys),
    );

    for (const row of catalog.values()) {
      if (mappedKeys.has(row.key) || existingAdvanced.has(row.key) || standardKeys.has(row.key)) {
        continue;
      }
      if (!isAdvancedPermissionKey(row.key)) continue;
      if (!prefixes.some((prefix) => row.key.startsWith(prefix))) continue;

      unit.advancedPermissions.push(toAdvancedPermission(row));
      mappedKeys.add(row.key);
    }

    unit.advancedPermissions.sort((a, b) => a.label.localeCompare(b.label, "de"));
  }
}

function resolveSectionLabel(
  sectionLabel: string | undefined,
  item: NavItem,
): string {
  if (sectionLabel) return sectionLabel;
  if (item.key === "organisation" || item.key === "website") return item.label;
  return "Allgemein";
}

export function buildNavPermissionPresentation(
  catalogRows: PermissionCatalogRow[],
): NavPermissionPresentation {
  const catalog = new Map(catalogRows.map((row) => [row.key, row]));
  const mappedKeys = new Set<string>();
  const sections: PermissionPresentationSection[] = [];

  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      if (item.key === "dashboard") continue;

      const sectionLabel = resolveSectionLabel(section.sectionLabel, item);
      const units = processNavItem(item, sectionLabel, catalog);

      for (const unit of units) {
        for (const control of unit.standardControls) {
          for (const key of control.permissionKeys) mappedKeys.add(key);
        }
        for (const advanced of unit.advancedPermissions) mappedKeys.add(advanced.key);
      }

      if (units.length === 0) continue;

      const existing = sections.find((s) => s.key === sectionLabel);
      if (existing) {
        existing.units.push(...units);
      } else {
        sections.push({ key: sectionLabel, label: sectionLabel, units });
      }
    }
  }

  for (const section of sections) {
    attachCatalogAdvancedPermissions(section.units, catalog, mappedKeys);
  }

  // Funktionen belongs under Organisation when grantable.
  if (catalog.has(FUNCTIONS_MANAGE_KEY)) {
    const organisation = sections.find((section) => section.label === "Organisation");
    if (organisation) {
      const functionsUnit = createUnit(
        "organisation-functions",
        "Funktionen",
        [FUNCTIONS_MANAGE_KEY],
        catalog,
        {
          description: "Vereinsfunktionen im Organigramm verwalten",
          iconLabel: "Funktionen",
          parentLabel: "Organisation",
        },
      );
      if (functionsUnit) {
        organisation.units.push(functionsUnit);
        mappedKeys.add(FUNCTIONS_MANAGE_KEY);
      }
    }
  }

  const supplementalKeys = catalogRows
    .map((row) => row.key)
    .filter((key) => !mappedKeys.has(key));

  const supplementalUnit =
    supplementalKeys.length > 0
      ? createUnit("supplemental", "Weitere Zugriffsrechte", supplementalKeys, catalog, {
          description: "Technische Rechte ohne direkten Navigationsbezug",
          iconLabel: "Administration",
        })
      : null;

  return { sections, supplementalUnit };
}

export function isControlChecked(
  control: StandardControl,
  selectedKeys: Set<string>,
): boolean {
  return control.permissionKeys.every((key) => selectedKeys.has(key));
}

export function isControlPartiallyChecked(
  control: StandardControl,
  selectedKeys: Set<string>,
): boolean {
  const selected = control.permissionKeys.filter((key) => selectedKeys.has(key)).length;
  return selected > 0 && selected < control.permissionKeys.length;
}

export function togglePermissionKey(
  selectedKeys: Set<string>,
  key: string,
  checked: boolean,
): Set<string> {
  const next = new Set(selectedKeys);

  if (checked) {
    next.add(key);
    const requiredView = MANAGE_REQUIRES_VIEW[key];
    if (requiredView) next.add(requiredView);
    return next;
  }

  next.delete(key);
  const dependentManage = VIEW_TO_MANAGE[key];
  if (dependentManage) next.delete(dependentManage);
  return next;
}

export function toggleStandardControl(
  selectedKeys: Set<string>,
  control: StandardControl,
  checked: boolean,
): Set<string> {
  let next = new Set(selectedKeys);
  for (const key of control.permissionKeys) {
    next = togglePermissionKey(next, key, checked);
  }
  return next;
}

export function isWochenplannerAvailable(selectedKeys: Set<string>): boolean {
  return (
    selectedKeys.has(PERMISSIONS.TRAININGS_VIEW) ||
    selectedKeys.has(PERMISSIONS.TRAININGS_MANAGE) ||
    selectedKeys.has(PERMISSIONS.EVENTS_VIEW) ||
    selectedKeys.has(PERMISSIONS.EVENTS_MANAGE)
  );
}

function describeControlAccess(
  control: StandardControl,
  selectedKeys: Set<string>,
): string | null {
  if (!isControlChecked(control, selectedKeys)) return null;
  return control.label;
}

function describeUnitAccess(unit: PermissionUnit, selectedKeys: Set<string>): NavPermissionSummaryItem[] {
  const items: NavPermissionSummaryItem[] = [];

  if (unit.isDerived) {
    if (unit.label === "Wochenplanner" && isWochenplannerAvailable(selectedKeys)) {
      items.push({ label: unit.label, access: "verfügbar" });
    }
    return items;
  }

  const standardAccess = unit.standardControls
    .map((control) => describeControlAccess(control, selectedKeys))
    .filter((value): value is string => value !== null);

  if (standardAccess.length > 0) {
    items.push({
      label: unit.label,
      access: standardAccess.join(" · "),
    });
  }

  for (const advanced of unit.advancedPermissions) {
    if (selectedKeys.has(advanced.key)) {
      items.push({
        label: unit.label,
        access: advanced.label,
        advanced: true,
      });
    }
  }

  return items;
}

export function buildNavPermissionSummary(
  presentation: NavPermissionPresentation,
  selectedKeys: Set<string>,
): NavPermissionSummarySection[] {
  const summary: NavPermissionSummarySection[] = [];

  for (const section of presentation.sections) {
    const items: NavPermissionSummaryItem[] = [];
    const modules: string[] = [];

    for (const unit of section.units) {
      const unitItems = describeUnitAccess(unit, selectedKeys);
      items.push(...unitItems);

      if (unitItems.length > 0 && !modules.includes(unit.label)) {
        modules.push(unit.label);
      }
    }

    if (items.length > 0) {
      summary.push({ label: section.label, modules, items });
    }
  }

  if (presentation.supplementalUnit) {
    const items = describeUnitAccess(presentation.supplementalUnit, selectedKeys);
    if (items.length > 0) {
      summary.push({
        label: "Weitere Zugriffsrechte",
        modules: ["Weitere Zugriffsrechte"],
        items,
      });
    }
  }

  return summary;
}

/** Shared builder for create + edit flows from the flat module-group catalog. */
export function buildNavPermissionPresentationFromModuleGroups(
  moduleGroups: Array<{
    module: string;
    permissions: Array<{ id: string; key: string; name: string; module: string }>;
  }>,
): NavPermissionPresentation {
  const catalogRows: PermissionCatalogRow[] = moduleGroups.flatMap((group) =>
    group.permissions.map((permission) => ({
      id: permission.id,
      key: permission.key,
      name: permission.name,
      module: permission.module,
    })),
  );
  return buildNavPermissionPresentation(catalogRows);
}
