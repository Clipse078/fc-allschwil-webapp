import { describe, it, expect } from "vitest";
import {
  NAV_SECTIONS,
  getVisibleNavSections,
} from "@/lib/nav/nav-config";
import { PERMISSIONS } from "@/lib/permissions/permissions";

// ── Helpers ───────────────────────────────────────────────────────────────────

function flatItems(sections: ReturnType<typeof getVisibleNavSections>) {
  return sections.flatMap((s) =>
    s.items.flatMap((item) => [
      { key: item.key, label: item.label, href: item.href },
      ...(item.children ?? []).map((c) => ({
        key: c.key,
        label: c.label,
        href: c.href,
      })),
    ]),
  );
}

function findSection(label: string) {
  return NAV_SECTIONS.find((s) => s.sectionLabel === label);
}

function findItemByKey(
  sections: ReturnType<typeof getVisibleNavSections>,
  key: string,
) {
  for (const section of sections) {
    for (const item of section.items) {
      if (item.key === key) return item;
      const child = item.children?.find((c) => c.key === key);
      if (child) return child;
    }
  }
  return null;
}

// ── Static structure tests ────────────────────────────────────────────────────

describe("NAV_SECTIONS static structure", () => {
  it("Planung section contains exactly TrainingCenter, MatchCenter, TournamentCenter, Veranstaltungen and Wochenplanner in that order", () => {
    const betrieb = findSection("Betrieb");
    expect(betrieb).toBeDefined();

    const planung = betrieb!.items.find((i) => i.key === "planung");
    expect(planung).toBeDefined();

    const childKeys = planung!.children?.map((c) => c.key) ?? [];
    expect(childKeys).toEqual([
      "trainingcenter",
      "matchcenter",
      "tournamentcenter",
      "veranstaltungen",
      "wochenplanner",
    ]);
  });

  it("MatchCenter is nested under Planung, labelled exactly 'MatchCenter', pointing to /dashboard/matchcenter", () => {
    const betrieb = findSection("Betrieb");
    const planung = betrieb!.items.find((i) => i.key === "planung");
    const matchcenter = planung!.children?.find((c) => c.key === "matchcenter");
    expect(matchcenter).toBeDefined();
    expect(matchcenter?.label).toBe("MatchCenter");
    expect(matchcenter?.href).toBe("/dashboard/matchcenter");
  });

  it("MatchCenter is no longer a standalone top-level Betrieb entry", () => {
    const betrieb = findSection("Betrieb");
    const topLevelMatchcenter = betrieb!.items.find((i) => i.key === "matchcenter");
    expect(topLevelMatchcenter).toBeUndefined();
  });

  it("Wochenplanner (WEEKPLANNER-01A/01B) points to /dashboard/planner/week", () => {
    const betrieb = findSection("Betrieb");
    const planung = betrieb!.items.find((i) => i.key === "planung");
    const wochenplanner = planung!.children?.find((c) => c.key === "wochenplanner");
    expect(wochenplanner?.href).toBe("/dashboard/planner/week");
    expect(wochenplanner?.label).toBe("Wochenplanner");
  });

  it("TournamentCenter points to /dashboard/tournamentcenter", () => {
    const betrieb = findSection("Betrieb");
    const planung = betrieb!.items.find((i) => i.key === "planung");
    const tournamentcenter = planung!.children?.find((c) => c.key === "tournamentcenter");
    expect(tournamentcenter?.href).toBe("/dashboard/tournamentcenter");
    expect(tournamentcenter?.label).toBe("TournamentCenter");
  });

  it("Anlagen does not appear under Planung", () => {
    const betrieb = findSection("Betrieb");
    const planung = betrieb!.items.find((i) => i.key === "planung");
    const childKeys = planung!.children?.map((c) => c.key) ?? [];
    expect(childKeys).not.toContain("anlagen");
  });

  it("Planung has no Saisons child", () => {
    const betrieb = findSection("Betrieb");
    const planung = betrieb!.items.find((i) => i.key === "planung");
    const childKeys = planung!.children?.map((c) => c.key) ?? [];
    expect(childKeys).not.toContain("saisons");
  });

  it("Planung has no Saisonplanung child", () => {
    const betrieb = findSection("Betrieb");
    const planung = betrieb!.items.find((i) => i.key === "planung");
    const childKeys = planung!.children?.map((c) => c.key) ?? [];
    expect(childKeys).not.toContain("saisonplanung");
  });

  it("Planung has no Feld & Ressourcen child", () => {
    const betrieb = findSection("Betrieb");
    const planung = betrieb!.items.find((i) => i.key === "planung");
    const childLabels = planung!.children?.map((c) => c.label) ?? [];
    expect(childLabels).not.toContain("Feld & Ressourcen");
  });

  it("TrainingCenter points to /dashboard/training", () => {
    const betrieb = findSection("Betrieb");
    const planung = betrieb!.items.find((i) => i.key === "planung");
    const trainingcenter = planung!.children?.find(
      (c) => c.key === "trainingcenter",
    );
    expect(trainingcenter?.href).toBe("/dashboard/training");
  });

  it("Veranstaltungen points to /dashboard/veranstaltungen", () => {
    const betrieb = findSection("Betrieb");
    const planung = betrieb!.items.find((i) => i.key === "planung");
    const veranstaltungen = planung!.children?.find(
      (c) => c.key === "veranstaltungen",
    );
    expect(veranstaltungen?.href).toBe("/dashboard/veranstaltungen");
  });

  it("Anlagen & Ressourcen appears under Administration pointing to /dashboard/admin/facilities", () => {
    const system = findSection("System");
    const admin = system!.items.find((i) => i.key === "administration");
    const facilities = admin!.children?.find((c) => c.key === "admin-facilities");
    expect(facilities?.href).toBe("/dashboard/admin/facilities");
    expect(facilities?.label).toBe("Anlagen & Ressourcen");
  });

  it("Saisons appears under Administration as admin-seasons", () => {
    const system = findSection("System");
    expect(system).toBeDefined();

    const admin = system!.items.find((i) => i.key === "administration");
    expect(admin).toBeDefined();

    const saisons = admin!.children?.find((c) => c.key === "admin-seasons");
    expect(saisons).toBeDefined();
    expect(saisons?.label).toBe("Saisons");
    expect(saisons?.href).toBe("/dashboard/seasons");
  });

  it("Organisation lists children in the canonical order ending with Personen, then Wettkämpfe", () => {
    const coreSection = NAV_SECTIONS.find((s) =>
      s.items.some((i) => i.key === "organisation"),
    );
    const organisation = coreSection!.items.find((i) => i.key === "organisation");
    const childKeys = organisation!.children?.map((c) => c.key) ?? [];
    expect(childKeys).toEqual([
      "org-units",
      "target-groups",
      "teams",
      "provider-mapping",
      "vereine",
      "personen",
      "competitions",
    ]);
  });

  it("Administration lists Rollen & Berechtigungen, Saisons, Anlagen & Ressourcen first", () => {
    const system = findSection("System");
    const admin = system!.items.find((i) => i.key === "administration");
    const childKeys = admin!.children?.map((c) => c.key) ?? [];
    expect(childKeys.slice(0, 3)).toEqual([
      "admin-tenant-roles",
      "admin-seasons",
      "admin-facilities",
    ]);
  });

  it("exposes Kommunikation as a first-class Betrieb module with the canonical sender child", () => {
    const betrieb = findSection("Betrieb");
    const communication = betrieb!.items.find((i) => i.key === "communication");

    expect(communication?.label).toBe("Kommunikation");
    expect(communication?.href).toBe("/dashboard/communication");
    expect(communication?.permissionKeys).toEqual([
      PERMISSIONS.USERS_MANAGE,
      PERMISSIONS.USERS_MANAGE_MEMBERSHIPS,
    ]);
    expect(communication?.children).toEqual([
      expect.objectContaining({
        key: "communication-email-sender",
        label: "E-Mail-Absender",
        href: "/dashboard/communication/email-sender",
        permissionKeys: [PERMISSIONS.USERS_MANAGE],
      }),
    ]);

    const system = findSection("System");
    const administration = system!.items.find((i) => i.key === "administration");
    expect(administration?.children?.some((child) => child.key === "admin-communications")).toBe(false);
  });

  it("exposes Sponsoring as a permission-gated Führung future module", () => {
    const fuehrung = findSection("Führung");
    const sponsoring = fuehrung!.items.find((i) => i.key === "sponsoring");

    expect(sponsoring).toEqual(expect.objectContaining({
      label: "Sponsoring",
      href: "/dashboard/sponsoring",
      permissionKeys: [
        PERMISSIONS.USERS_MANAGE,
        PERMISSIONS.USERS_MANAGE_MEMBERSHIPS,
      ],
    }));
  });
});

// ── Permission-based visibility ───────────────────────────────────────────────

describe("getVisibleNavSections permission filtering", () => {
  const allPermissions = Object.values(PERMISSIONS);

  it("admin sees Saisons under Administration (SEASONS_VIEW)", () => {
    const sections = getVisibleNavSections([PERMISSIONS.SEASONS_VIEW]);
    const item = findItemByKey(sections, "admin-seasons");
    expect(item).not.toBeNull();
  });

  it("admin sees Saisons under Administration (SEASONS_MANAGE)", () => {
    const sections = getVisibleNavSections([PERMISSIONS.SEASONS_MANAGE]);
    const item = findItemByKey(sections, "admin-seasons");
    expect(item).not.toBeNull();
  });

  it("user without season permissions does not see Saisons nav item", () => {
    const noSeasonPermissions = allPermissions.filter(
      (p) => p !== PERMISSIONS.SEASONS_VIEW && p !== PERMISSIONS.SEASONS_MANAGE,
    );
    const sections = getVisibleNavSections(noSeasonPermissions);
    const item = findItemByKey(sections, "admin-seasons");
    expect(item).toBeNull();
  });

  it("Saisonplanung is absent from all permission sets", () => {
    const sections = getVisibleNavSections(allPermissions);
    const flat = flatItems(sections);
    const saisonplanung = flat.find((i) => i.key === "saisonplanung");
    expect(saisonplanung).toBeUndefined();
  });

  it("training-view user sees TrainingCenter", () => {
    const sections = getVisibleNavSections([PERMISSIONS.TRAININGS_VIEW]);
    const item = findItemByKey(sections, "trainingcenter");
    expect(item).not.toBeNull();
  });

  it("events-view user sees Veranstaltungen", () => {
    const sections = getVisibleNavSections([PERMISSIONS.EVENTS_VIEW]);
    const item = findItemByKey(sections, "veranstaltungen");
    expect(item).not.toBeNull();
  });

  it("events-view user sees MatchCenter nested under Planung", () => {
    const sections = getVisibleNavSections([PERMISSIONS.EVENTS_VIEW]);
    const item = findItemByKey(sections, "matchcenter");
    expect(item).not.toBeNull();
    expect(item?.label).toBe("MatchCenter");
    expect(item?.href).toBe("/dashboard/matchcenter");
  });

  it("user without events permissions does not see MatchCenter", () => {
    const noEventsPermissions = allPermissions.filter(
      (p) => p !== PERMISSIONS.EVENTS_VIEW && p !== PERMISSIONS.EVENTS_MANAGE,
    );
    const sections = getVisibleNavSections(noEventsPermissions);
    const item = findItemByKey(sections, "matchcenter");
    expect(item).toBeNull();
  });

  it("facilities-view user sees Anlagen & Ressourcen under Administration", () => {
    const sections = getVisibleNavSections([PERMISSIONS.FACILITIES_VIEW]);
    const item = findItemByKey(sections, "admin-facilities");
    expect(item).not.toBeNull();
  });

  it("facilities-view user does not see Anlagen under Planung", () => {
    const sections = getVisibleNavSections([PERMISSIONS.FACILITIES_VIEW]);
    const item = findItemByKey(sections, "anlagen");
    expect(item).toBeNull();
  });

  it("user without training/events permissions does not see Planung section items", () => {
    const noSectionPermissions: typeof allPermissions = [
      PERMISSIONS.USERS_MANAGE,
    ];
    const sections = getVisibleNavSections(noSectionPermissions);
    const trainingcenter = findItemByKey(sections, "trainingcenter");
    const veranstaltungen = findItemByKey(sections, "veranstaltungen");
    expect(trainingcenter).toBeNull();
    expect(veranstaltungen).toBeNull();
  });

  it("Planung section is hidden entirely when user has no relevant permissions", () => {
    const sections = getVisibleNavSections([PERMISSIONS.USERS_MANAGE]);
    const planungItem = sections
      .flatMap((s) => s.items)
      .find((i) => i.key === "planung");
    expect(planungItem).toBeUndefined();
  });

  it("shows top-level Kommunikation and Sponsoring to tenant Club Admins without exposing the protected sender child", () => {
    const tenantAdmin = getVisibleNavSections([
      PERMISSIONS.USERS_MANAGE_MEMBERSHIPS,
    ]);
    expect(findItemByKey(tenantAdmin, "communication")).not.toBeNull();
    expect(findItemByKey(tenantAdmin, "communication-email-sender")).toBeNull();
    expect(findItemByKey(tenantAdmin, "sponsoring")).not.toBeNull();

    const unauthorized = getVisibleNavSections([PERMISSIONS.USERS_VIEW]);
    expect(findItemByKey(unauthorized, "communication")).toBeNull();
    expect(findItemByKey(unauthorized, "communication-email-sender")).toBeNull();
    expect(findItemByKey(unauthorized, "sponsoring")).toBeNull();
  });

  it("keeps the protected sender child visible to platform user administrators", () => {
    const platformAdmin = getVisibleNavSections([PERMISSIONS.USERS_MANAGE]);
    expect(findItemByKey(platformAdmin, "communication")).not.toBeNull();
    expect(findItemByKey(platformAdmin, "communication-email-sender")).not.toBeNull();
    expect(findItemByKey(platformAdmin, "sponsoring")).not.toBeNull();
  });

  it("Veranstaltungen nav entry points to /dashboard/veranstaltungen with label Veranstaltungen", () => {
    const sections = getVisibleNavSections([PERMISSIONS.EVENTS_VIEW]);
    const flat = flatItems(sections);
    // CLUB-EVENTS-01: nav moved from /dashboard/events to the dedicated module
    const veranstaltungenEntry = flat.find(
      (i) => i.href === "/dashboard/veranstaltungen",
    );
    expect(veranstaltungenEntry?.label).toBe("Veranstaltungen");
    // Ensure old generic-hub label is not present as a nav item
    const oldEntry = flat.find((i) => i.label === "Events");
    expect(oldEntry).toBeUndefined();
  });

  it("Saisons child under Planung is absent even with full permissions", () => {
    const sections = getVisibleNavSections(allPermissions);
    const planungSection = sections
      .flatMap((s) => s.items)
      .find((i) => i.key === "planung");
    const planungChildKeys =
      planungSection?.children?.map((c) => c.key) ?? [];
    expect(planungChildKeys).not.toContain("saisons");
  });

  it("allocation route /dashboard/training/series/:id/allocations prefix is reachable via TrainingCenter", () => {
    // Confirm the trainingcenter entry exists so the allocations route is discoverable
    const sections = getVisibleNavSections([PERMISSIONS.TRAININGS_VIEW]);
    const item = findItemByKey(sections, "trainingcenter");
    expect(item?.href).toBe("/dashboard/training");
  });
});

// ── Route deduplication ───────────────────────────────────────────────────────

describe("route deduplication", () => {
  it("facilities route /dashboard/admin/facilities appears only under Administration, not under Planung", () => {
    const betrieb = findSection("Betrieb");
    const planung = betrieb!.items.find((i) => i.key === "planung");
    const planungFacilities = planung!.children?.filter(
      (c) => c.href === "/dashboard/admin/facilities",
    ) ?? [];
    expect(planungFacilities).toHaveLength(0);

    const system = findSection("System");
    const admin = system!.items.find((i) => i.key === "administration");
    const adminFacilities = admin!.children?.filter(
      (c) => c.href === "/dashboard/admin/facilities",
    ) ?? [];
    expect(adminFacilities).toHaveLength(1);
  });

  it("there is no legacy 'Wochenplanung' entry in any section — WEEKPLANNER-01B's 'Wochenplanner' (the canonical read-only aggregation) is the sole intentional exception", () => {
    const sections = getVisibleNavSections(Object.values(PERMISSIONS));
    const flat = flatItems(sections);
    const wochenplanEntries = flat.filter((i) => i.label.toLowerCase().includes("wochenplan"));
    expect(wochenplanEntries.map((i) => i.label)).toEqual(["Wochenplanner"]);
    expect(wochenplanEntries[0]?.href).toBe("/dashboard/planner/week");
  });

  it("there is no Ressourcenzuteilung entry in any section", () => {
    const sections = getVisibleNavSections(Object.values(PERMISSIONS));
    const flat = flatItems(sections);
    const ressourcen = flat.find((i) =>
      i.label.toLowerCase().includes("ressourcenzuteilung"),
    );
    expect(ressourcen).toBeUndefined();
  });

  it("matches/tournaments are not listed under Planung", () => {
    const sections = getVisibleNavSections(Object.values(PERMISSIONS));
    const flat = flatItems(sections);
    const spiele = flat.find(
      (i) =>
        i.label.toLowerCase().includes("spiele") ||
        i.label.toLowerCase().includes("turnier"),
    );
    expect(spiele).toBeUndefined();
  });
});
