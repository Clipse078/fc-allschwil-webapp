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

export type StandardControlKind = "view" | "manage" | "edit";

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
  items: NavPermissionSummaryItem[];
};

const SPIELBETRIEB_CHILD_KEYS = new Set(["matchcenter", "tournamentcenter", "veranstaltungen"]);
const WOCHENPLANNER_KEY = "wochenplanner";
const TRAININGCENTER_KEY = "trainingcenter";

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
  const editKeys: string[] = [];
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
      if (key === PERMISSIONS.REGISTRATIONS_EDIT) editKeys.push(key);
      else manageKeys.push(key);
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
  if (editKeys.length > 0) {
    standardControls.push({ kind: "edit", label: "Bearbeiten", permissionKeys: editKeys });
  }

  return { standardControls, advancedPermissions };
}

function createUnit(
  id: string,
  label: string,
  keys: string[],
  catalog: Map<string, PermissionCatalogRow>,
  options: Partial<Pick<PermissionUnit, "childLabels" | "parentLabel" | "sharedNote" | "derivedNote" | "isDerived">> = {},
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
    const unit = createUnit(
      `${parentItem.key}-${trainingChild.key}`,
      trainingChild.label,
      filterGrantableKeys(trainingChild.permissionKeys, catalog),
      catalog,
      { parentLabel: parentItem.label },
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
        parentLabel: parentItem.label,
        childLabels: spielbetriebChildren.map((c) => c.label),
        sharedNote:
          "Diese Berechtigung gilt gemeinsam für MatchCenter, TournamentCenter und Veranstaltungen.",
      },
    );
    if (unit) units.push(unit);
  }

  const wochenplannerChild = children.find((c) => c.key === WOCHENPLANNER_KEY);
  if (wochenplannerChild) {
    units.push({
      id: `${parentItem.key}-${WOCHENPLANNER_KEY}`,
      label: wochenplannerChild.label,
      parentLabel: parentItem.label,
      isDerived: true,
      derivedNote:
        "Der Wochenplanner ist verfügbar, wenn Zugriff auf TrainingCenter oder Spielbetrieb besteht.",
      standardControls: [],
      advancedPermissions: [],
    });
  }

  const signatureGroups = new Map<string, { children: NavItemChild[]; keys: string[] }>();
  for (const child of regularChildren) {
    if (child.key === TRAININGCENTER_KEY) continue;
    const keys = filterGrantableKeys(child.permissionKeys, catalog);
    if (keys.length === 0) continue;
    const signature = [...keys].sort().join("|");
    const group = signatureGroups.get(signature) ?? { children: [], keys };
    group.children.push(child);
    signatureGroups.set(signature, group);
  }

  for (const [signature, group] of signatureGroups) {
    const label =
      group.children.length === 1
        ? group.children[0]!.label
        : group.children.map((c) => c.label).join(" · ");

    const unit = createUnit(
      `${parentItem.key}-${signature}`,
      label,
      group.keys,
      catalog,
      {
        parentLabel: parentItem.label,
        childLabels: group.children.length > 1 ? group.children.map((c) => c.label) : undefined,
        sharedNote:
          group.children.length > 1
            ? "Diese Berechtigung gilt gemeinsam für die aufgeführten Bereiche."
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
  const unit = createUnit(item.key, item.label, keys, catalog);
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

  const supplementalKeys = catalogRows
    .map((row) => row.key)
    .filter((key) => !mappedKeys.has(key));

  const supplementalUnit =
    supplementalKeys.length > 0
      ? createUnit("supplemental", "Weitere Berechtigungen", supplementalKeys, catalog)
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
    for (const unit of section.units) {
      items.push(...describeUnitAccess(unit, selectedKeys));
    }
    if (items.length > 0) {
      summary.push({ label: section.label, items });
    }
  }

  if (presentation.supplementalUnit) {
    const items = describeUnitAccess(presentation.supplementalUnit, selectedKeys);
    if (items.length > 0) {
      summary.push({ label: "Weitere Berechtigungen", items });
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
