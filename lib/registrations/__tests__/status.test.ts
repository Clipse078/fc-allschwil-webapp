/**
 * lib/registrations/__tests__/status.test.ts
 *
 * REGISTRATION-01F — Goal 8: guards the single source of truth for status
 * display metadata. Every RegistrationStatus value must have a label /
 * badge / hero / dot entry and must belong to exactly one inbox filter
 * group — otherwise a status silently falls through the UI.
 */

import { describe, expect, it } from "vitest";
import { RegistrationStatus } from "@prisma/client";
import {
  STATUS_ORDER,
  STATUS_LABELS,
  STATUS_BADGE_CLASS,
  STATUS_HERO_CLASS,
  STATUS_DOT_CLASS,
  STATUS_GROUPS,
  TERMINAL_STATUSES,
} from "@/lib/registrations/status";

const ALL_STATUSES = Object.values(RegistrationStatus);

describe("STATUS_ORDER", () => {
  it("includes every RegistrationStatus enum value exactly once", () => {
    expect(STATUS_ORDER).toHaveLength(ALL_STATUSES.length);
    expect(new Set(STATUS_ORDER)).toEqual(new Set(ALL_STATUSES));
  });

  it("matches the Goal 8 workflow order (New, In Review, Assigned, Contacted, Waiting, Accepted, Rejected, Archived)", () => {
    expect(STATUS_ORDER).toEqual([
      "NEW",
      "REVIEWING",
      "ASSIGNED",
      "CONTACTED",
      "WAITING",
      "ACCEPTED",
      "REJECTED",
      "ARCHIVED",
    ]);
  });
});

describe("display metadata completeness", () => {
  it("every status has a label, badge class, hero class and dot class", () => {
    for (const status of ALL_STATUSES) {
      expect(STATUS_LABELS[status]).toBeTruthy();
      expect(STATUS_BADGE_CLASS[status]).toBeTruthy();
      expect(STATUS_HERO_CLASS[status]).toBeTruthy();
      expect(STATUS_DOT_CLASS[status]).toBeTruthy();
    }
  });
});

describe("STATUS_GROUPS (inbox filter pills)", () => {
  it("every status belongs to exactly one group", () => {
    for (const status of ALL_STATUSES) {
      const owners = STATUS_GROUPS.filter((g) => g.statuses.includes(status));
      expect(owners).toHaveLength(1);
    }
  });

  it("ASSIGNED groups with REVIEWING under 'In Bearbeitung'", () => {
    const group = STATUS_GROUPS.find((g) => g.key === "REVIEWING");
    expect(group?.statuses).toContain(RegistrationStatus.ASSIGNED);
    expect(group?.statuses).toContain(RegistrationStatus.REVIEWING);
  });

  it("WAITING has its own dedicated group", () => {
    const group = STATUS_GROUPS.find((g) => g.key === "WAITING");
    expect(group?.statuses).toEqual([RegistrationStatus.WAITING]);
  });
});

describe("TERMINAL_STATUSES", () => {
  it("contains exactly the three end-states used for 'Completed today' KPIs", () => {
    expect(new Set(TERMINAL_STATUSES)).toEqual(
      new Set([RegistrationStatus.ACCEPTED, RegistrationStatus.REJECTED, RegistrationStatus.ARCHIVED]),
    );
  });
});
