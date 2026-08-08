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
  it("Planung section contains exactly TrainingCenter, TournamentCenter and Veranstaltungen", () => {
    const betrieb = findSection("Betrieb");
    expect(betrieb).toBeDefined();

    const planung = betrieb!.items.find((i) => i.key === "planung");
    expect(planung).toBeDefined();

    const childKeys = planung!.children?.map((c) => c.key) ?? [];
    expect(childKeys).toEqual(["trainingcenter", "tournamentcenter", "veranstaltungen"]);
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

  it("Veranstaltungen points to /dashboard/events", () => {
    const betrieb = findSection("Betrieb");
    const planung = betrieb!.items.find((i) => i.key === "planung");
    const veranstaltungen = planung!.children?.find(
      (c) => c.key === "veranstaltungen",
    );
    expect(veranstaltungen?.href).toBe("/dashboard/events");
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

  it("Matchcenter remains a separate top-level Betrieb entry", () => {
    const betrieb = findSection("Betrieb");
    const matchcenter = betrieb!.items.find((i) => i.key === "matchcenter");
    expect(matchcenter).toBeDefined();
    expect(matchcenter?.href).toBe("/dashboard/matchcenter");
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

  it("Events label is Veranstaltungen, not Events", () => {
    const sections = getVisibleNavSections([PERMISSIONS.EVENTS_VIEW]);
    const flat = flatItems(sections);
    const eventsEntry = flat.find((i) => i.href === "/dashboard/events");
    expect(eventsEntry?.label).toBe("Veranstaltungen");
    // Ensure old label is gone
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

  it("there is no Wochenplanung entry in any section", () => {
    const sections = getVisibleNavSections(Object.values(PERMISSIONS));
    const flat = flatItems(sections);
    const wochenplanung = flat.find((i) =>
      i.label.toLowerCase().includes("wochenplan"),
    );
    expect(wochenplanung).toBeUndefined();
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
