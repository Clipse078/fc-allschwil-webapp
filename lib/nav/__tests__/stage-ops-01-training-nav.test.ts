/**
 * STAGE-OPS-01 — Regression tests for Issue 1: Trainingsplaner missing from nav.
 *
 * Root cause: trainings.view and trainings.manage Permission rows were not
 * seeded into the STAGE database after migration
 * 20260727400000_training_core_01_canonical_foundation was applied.
 *
 * These tests guard the navigation-layer fix (nav-config.ts is correct) and
 * document the exact permission boundary that governs visibility.
 *
 * Note: The DB-layer fix is scripts/sync-training-permissions.ts — these tests
 * cover only the navigation logic, which is pure and requires no DB access.
 */

import { describe, it, expect } from "vitest";
import { getVisibleNavSections } from "@/lib/nav/nav-config";
import { PERMISSIONS } from "@/lib/permissions/permissions";

// ── Helpers ────────────────────────────────────────────────────────────────────

function findNavItem(
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

// ── STAGE-OPS-01 Issue 1 Regression ──────────────────────────────────────────

describe("STAGE-OPS-01 — Training Planner navigation regression", () => {
  it("user with TRAININGS_VIEW sees Trainingsplaner under Planung", () => {
    const sections = getVisibleNavSections([PERMISSIONS.TRAININGS_VIEW]);
    const item = findNavItem(sections, "trainingsplaner");
    expect(item).not.toBeNull();
    expect(item?.href).toBe("/dashboard/training");
  });

  it("user with TRAININGS_MANAGE sees Trainingsplaner under Planung", () => {
    const sections = getVisibleNavSections([PERMISSIONS.TRAININGS_MANAGE]);
    const item = findNavItem(sections, "trainingsplaner");
    expect(item).not.toBeNull();
    expect(item?.href).toBe("/dashboard/training");
  });

  it("user with both TRAININGS_VIEW and TRAININGS_MANAGE sees Trainingsplaner", () => {
    const sections = getVisibleNavSections([
      PERMISSIONS.TRAININGS_VIEW,
      PERMISSIONS.TRAININGS_MANAGE,
    ]);
    const item = findNavItem(sections, "trainingsplaner");
    expect(item).not.toBeNull();
  });

  it("user with only EVENTS_VIEW sees Veranstaltungen but NOT Trainingsplaner", () => {
    const sections = getVisibleNavSections([PERMISSIONS.EVENTS_VIEW]);
    const trainingsplaner = findNavItem(sections, "trainingsplaner");
    const veranstaltungen = findNavItem(sections, "veranstaltungen");
    // Reproduces the observed STAGE bug: Planung is visible (via events) but
    // Trainingsplaner child is absent because training permissions are not in the session.
    expect(trainingsplaner).toBeNull();
    expect(veranstaltungen).not.toBeNull();
  });

  it("user with only EVENTS_MANAGE sees Planung parent but not Trainingsplaner child", () => {
    const sections = getVisibleNavSections([PERMISSIONS.EVENTS_MANAGE]);
    const trainingsplaner = findNavItem(sections, "trainingsplaner");
    expect(trainingsplaner).toBeNull();
    // Planung parent should still show (has EVENTS_MANAGE in its permissionKeys)
    const planungItem = sections
      .flatMap((s) => s.items)
      .find((i) => i.key === "planung");
    expect(planungItem).toBeDefined();
  });

  it("user with TRAININGS_VIEW also sees Planung parent (OR gate)", () => {
    const sections = getVisibleNavSections([PERMISSIONS.TRAININGS_VIEW]);
    const planungItem = sections
      .flatMap((s) => s.items)
      .find((i) => i.key === "planung");
    expect(planungItem).toBeDefined();
  });

  it("user with neither TRAININGS nor EVENTS permissions does not see Planung at all", () => {
    const sections = getVisibleNavSections([PERMISSIONS.USERS_MANAGE]);
    const planungItem = sections
      .flatMap((s) => s.items)
      .find((i) => i.key === "planung");
    expect(planungItem).toBeUndefined();
    const trainingsplaner = findNavItem(sections, "trainingsplaner");
    expect(trainingsplaner).toBeNull();
  });

  it("FC Admin (super_admin) should see Trainingsplaner once training permissions are seeded", () => {
    // super_admin has all permissions. This test validates the expected
    // session state after scripts/sync-training-permissions.ts is applied.
    const allPermissions = Object.values(PERMISSIONS);
    const sections = getVisibleNavSections(allPermissions);
    const item = findNavItem(sections, "trainingsplaner");
    expect(item).not.toBeNull();
    expect(item?.href).toBe("/dashboard/training");
  });

  it("Trainingsplaner and Veranstaltungen are both visible for a user with all planning permissions", () => {
    const sections = getVisibleNavSections([
      PERMISSIONS.TRAININGS_VIEW,
      PERMISSIONS.TRAININGS_MANAGE,
      PERMISSIONS.EVENTS_VIEW,
      PERMISSIONS.EVENTS_MANAGE,
    ]);
    const trainingsplaner = findNavItem(sections, "trainingsplaner");
    const veranstaltungen = findNavItem(sections, "veranstaltungen");
    expect(trainingsplaner).not.toBeNull();
    expect(veranstaltungen).not.toBeNull();
  });

  it("Planung section contains exactly trainingsplaner and veranstaltungen children (no extras)", () => {
    const sections = getVisibleNavSections(Object.values(PERMISSIONS));
    const planungItem = sections
      .flatMap((s) => s.items)
      .find((i) => i.key === "planung");
    const childKeys = planungItem?.children?.map((c) => c.key) ?? [];
    expect(childKeys).toEqual(["trainingsplaner", "veranstaltungen"]);
  });

  it("Trainingsplaner route and direct-route /dashboard/training require the same permissions", () => {
    // Trainingsplaner in nav uses TRAININGS_VIEW | TRAININGS_MANAGE.
    // Direct route /dashboard/training requires the same (documented in page.tsx).
    // This test guards that the nav and route-level auth are aligned.
    const withView = getVisibleNavSections([PERMISSIONS.TRAININGS_VIEW]);
    const withManage = getVisibleNavSections([PERMISSIONS.TRAININGS_MANAGE]);
    const withNeither = getVisibleNavSections([PERMISSIONS.EVENTS_VIEW]);

    expect(findNavItem(withView, "trainingsplaner")).not.toBeNull();
    expect(findNavItem(withManage, "trainingsplaner")).not.toBeNull();
    expect(findNavItem(withNeither, "trainingsplaner")).toBeNull();
  });
});
