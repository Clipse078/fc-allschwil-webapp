import { describe, it, expect } from "vitest";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  buildNavPermissionPresentation,
  buildNavPermissionPresentationFromModuleGroups,
  buildNavPermissionSummary,
  isControlChecked,
  isWochenplannerAvailable,
  togglePermissionKey,
  toggleStandardControl,
  type PermissionCatalogRow,
} from "@/lib/roles/nav-permission-presentation";

function catalogRow(key: string, moduleName = "EVENTS"): PermissionCatalogRow {
  return {
    id: key,
    key,
    name: key,
    module: moduleName,
  };
}

function buildCatalog(keys: string[]): PermissionCatalogRow[] {
  return keys.map((key) => catalogRow(key));
}

const TENANT_CATALOG_KEYS = [
  PERMISSIONS.ORG_VIEW,
  PERMISSIONS.ORG_MANAGE,
  PERMISSIONS.TEAMS_VIEW,
  PERMISSIONS.TEAMS_MANAGE,
  PERMISSIONS.PEOPLE_VIEW,
  PERMISSIONS.PEOPLE_MANAGE,
  PERMISSIONS.COMPETITIONS_VIEW,
  PERMISSIONS.COMPETITIONS_MANAGE,
  PERMISSIONS.NEWS_MANAGE,
  PERMISSIONS.WEBSITE_MANAGE,
  PERMISSIONS.TRAININGS_VIEW,
  PERMISSIONS.TRAININGS_MANAGE,
  PERMISSIONS.TRAININGS_DELETE,
  PERMISSIONS.EVENTS_VIEW,
  PERMISSIONS.EVENTS_MANAGE,
  PERMISSIONS.EVENTS_DELETE,
  PERMISSIONS.MATCHES_DELETE,
  PERMISSIONS.TOURNAMENTS_DELETE,
  PERMISSIONS.WORKSPACE_VIEW,
  PERMISSIONS.WORKSPACE_MANAGE,
  PERMISSIONS.REGISTRATIONS_VIEW,
  PERMISSIONS.REGISTRATIONS_EDIT,
  PERMISSIONS.USERS_VIEW,
  PERMISSIONS.USERS_MANAGE_MEMBERSHIPS,
  PERMISSIONS.INFOBOARD_MANAGE,
  PERMISSIONS.EVENTS_PUBLISH_INFOBOARD,
  PERMISSIONS.ROLES_VIEW,
  PERMISSIONS.ROLES_MANAGE,
  PERMISSIONS.SEASONS_VIEW,
  PERMISSIONS.SEASONS_MANAGE,
  PERMISSIONS.FACILITIES_VIEW,
  PERMISSIONS.FACILITIES_MANAGE,
  PERMISSIONS.WOCHENPLAN_MANAGE,
  PERMISSIONS.FIXTURES_VIEW,
];

describe("nav-permission-presentation", () => {
  it("derives sidebar-aligned sections from NAV_SECTIONS", () => {
    const presentation = buildNavPermissionPresentation(buildCatalog(TENANT_CATALOG_KEYS));

    expect(presentation.sections.map((section) => section.label)).toEqual(
      expect.arrayContaining(["Organisation", "Website", "Betrieb", "System"]),
    );

    const betrieb = presentation.sections.find((section) => section.label === "Betrieb");
    expect(betrieb?.units.some((unit) => unit.label === "TrainingCenter")).toBe(true);
    expect(betrieb?.units.some((unit) => unit.label === "Spielbetrieb")).toBe(true);
    expect(betrieb?.units.some((unit) => unit.label === "Wochenplanner" && unit.isDerived)).toBe(
      true,
    );
  });

  it("groups shared events permissions into a single Spielbetrieb unit", () => {
    const presentation = buildNavPermissionPresentation(buildCatalog(TENANT_CATALOG_KEYS));
    const betrieb = presentation.sections.find((section) => section.label === "Betrieb");
    const spielbetrieb = betrieb?.units.find((unit) => unit.label === "Spielbetrieb");

    expect(spielbetrieb?.childLabels).toEqual(
      expect.arrayContaining(["MatchCenter", "TournamentCenter", "Veranstaltungen"]),
    );
    expect(spielbetrieb?.standardControls).toHaveLength(2);
    expect(spielbetrieb?.standardControls.flatMap((control) => control.permissionKeys)).toEqual([
      PERMISSIONS.EVENTS_VIEW,
      PERMISSIONS.EVENTS_MANAGE,
    ]);
    expect(spielbetrieb?.sharedNote).toContain("MatchCenter");
  });

  it("keeps tournaments.delete as an advanced permission on Spielbetrieb", () => {
    const presentation = buildNavPermissionPresentation(
      buildCatalog([...TENANT_CATALOG_KEYS, PERMISSIONS.TOURNAMENTS_DELETE]),
    );
    const spielbetrieb = presentation.sections
      .find((section) => section.label === "Betrieb")
      ?.units.find((unit) => unit.label === "Spielbetrieb");

    expect(
      spielbetrieb?.advancedPermissions.some((permission) => permission.key === PERMISSIONS.TOURNAMENTS_DELETE),
    ).toBe(true);
    expect(
      spielbetrieb?.standardControls.some((control) =>
        control.permissionKeys.includes(PERMISSIONS.TOURNAMENTS_DELETE),
      ),
    ).toBe(false);
  });

  it("auto-selects view when manage is enabled", () => {
    const next = togglePermissionKey(new Set(), PERMISSIONS.TEAMS_MANAGE, true);
    expect(next.has(PERMISSIONS.TEAMS_VIEW)).toBe(true);
    expect(next.has(PERMISSIONS.TEAMS_MANAGE)).toBe(true);
  });

  it("removes manage when view is disabled", () => {
    const initial = new Set([PERMISSIONS.TEAMS_VIEW, PERMISSIONS.TEAMS_MANAGE]);
    const next = togglePermissionKey(initial, PERMISSIONS.TEAMS_VIEW, false);
    expect(next.has(PERMISSIONS.TEAMS_MANAGE)).toBe(false);
  });

  it("does not auto-grant advanced delete permissions when manage is selected", () => {
    const next = togglePermissionKey(new Set(), PERMISSIONS.EVENTS_MANAGE, true);
    expect(next.has(PERMISSIONS.TOURNAMENTS_DELETE)).toBe(false);
    expect(next.has(PERMISSIONS.EVENTS_DELETE)).toBe(false);
  });

  it("builds product-language summaries without raw permission keys", () => {
    const presentation = buildNavPermissionPresentation(buildCatalog(TENANT_CATALOG_KEYS));
    const summary = buildNavPermissionSummary(
      presentation,
      new Set([PERMISSIONS.TRAININGS_VIEW, PERMISSIONS.EVENTS_MANAGE]),
    );

    const serialized = JSON.stringify(summary);
    expect(serialized).not.toContain("events.manage");
    expect(serialized).not.toContain("trainings.view");
    expect(summary.some((section) => section.label === "Betrieb")).toBe(true);
    expect(
      summary
        .flatMap((section) => section.items)
        .some((item) => item.label === "TrainingCenter" && item.access === "Ansehen"),
    ).toBe(true);
    expect(
      summary
        .flatMap((section) => section.items)
        .some((item) => item.label === "Spielbetrieb" && item.access === "Verwalten"),
    ).toBe(true);
  });

  it("marks Wochenplanner as verfügbar when derived access exists", () => {
    const presentation = buildNavPermissionPresentation(buildCatalog(TENANT_CATALOG_KEYS));
    const summary = buildNavPermissionSummary(presentation, new Set([PERMISSIONS.EVENTS_VIEW]));

    expect(isWochenplannerAvailable(new Set([PERMISSIONS.EVENTS_VIEW]))).toBe(true);
    expect(
      summary
        .flatMap((section) => section.items)
        .some((item) => item.label === "Wochenplanner" && item.access === "verfügbar"),
    ).toBe(true);
  });

  it("create and edit flows share the same presentation builder", () => {
    const moduleGroups = [
      {
        module: "EVENTS",
        permissions: [
          { id: "1", key: PERMISSIONS.EVENTS_VIEW, name: "View events", module: "EVENTS" },
          { id: "2", key: PERMISSIONS.EVENTS_MANAGE, name: "Manage events", module: "EVENTS" },
        ],
      },
    ];

    const fromGroups = buildNavPermissionPresentationFromModuleGroups(moduleGroups);
    const fromCatalog = buildNavPermissionPresentation(
      moduleGroups.flatMap((group) => group.permissions),
    );

    const spielbetriebFromGroups = fromGroups.sections
      .flatMap((section) => section.units)
      .find((unit) => unit.label === "Spielbetrieb");
    const spielbetriebFromCatalog = fromCatalog.sections
      .flatMap((section) => section.units)
      .find((unit) => unit.label === "Spielbetrieb");

    expect(spielbetriebFromGroups?.id).toBe(spielbetriebFromCatalog?.id);
    expect(isControlChecked(spielbetriebFromGroups!.standardControls[1]!, new Set([PERMISSIONS.EVENTS_MANAGE]))).toBe(
      true,
    );
  });

  it("labels registrations edit as Verwalten, not Bearbeiten", () => {
    const presentation = buildNavPermissionPresentation(buildCatalog(TENANT_CATALOG_KEYS));
    const registrationsUnit = presentation.sections
      .flatMap((section) => section.units)
      .find((unit) => unit.standardControls.some((control) =>
        control.permissionKeys.includes(PERMISSIONS.REGISTRATIONS_EDIT),
      ));

    expect(
      registrationsUnit?.standardControls.find((control) =>
        control.permissionKeys.includes(PERMISSIONS.REGISTRATIONS_EDIT),
      )?.label,
    ).toBe("Verwalten");
    expect(
      registrationsUnit?.standardControls.some((control) => control.label === "Bearbeiten"),
    ).toBe(false);
  });

  it("toggles all keys in a shared standard control together", () => {
    const control = {
      kind: "manage" as const,
      label: "Verwalten",
      permissionKeys: [PERMISSIONS.EVENTS_MANAGE],
    };
    const next = toggleStandardControl(new Set(), control, true);
    expect(next.has(PERMISSIONS.EVENTS_VIEW)).toBe(true);
    expect(next.has(PERMISSIONS.EVENTS_MANAGE)).toBe(true);
  });
});
