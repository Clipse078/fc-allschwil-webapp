/**
 * lib/club-directory/__tests__/plan-fingerprint.test.ts
 *
 * CLUB-DIRECTORY-02C-EXEC — unit tests for the deterministic SHA-256 plan
 * fingerprint helper shared by the read-only dry-run endpoint and the
 * temporary execute endpoint's plan-consistency guard.
 */

import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildCanonicalPlanRepresentation,
  computePlanFingerprint,
  type PlanFingerprintInput,
} from "../plan-fingerprint";

const BASE_INPUT: PlanFingerprintInput = {
  tenantKey: "fc-allschwil",
  groups: [
    {
      providerClubId: 700,
      canonicalClubId: "club-b",
      clubsToArchive: ["club-a"],
      teamsToMove: 1,
      logoAdoptedFromClubId: null,
    },
    {
      providerClubId: 100,
      canonicalClubId: "club-d",
      clubsToArchive: ["club-c", "club-e"],
      teamsToMove: 4,
      logoAdoptedFromClubId: "club-c",
    },
  ],
};

describe("computePlanFingerprint", () => {
  it("returns a 64-character lowercase hex SHA-256 digest", () => {
    const fingerprint = computePlanFingerprint(BASE_INPUT);
    expect(fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic — identical input always yields the identical fingerprint", () => {
    const a = computePlanFingerprint(BASE_INPUT);
    const b = computePlanFingerprint(structuredClone(BASE_INPUT));
    expect(a).toBe(b);
  });

  it("is independent of group order", () => {
    const reordered: PlanFingerprintInput = {
      tenantKey: BASE_INPUT.tenantKey,
      groups: [...BASE_INPUT.groups].reverse(),
    };

    expect(computePlanFingerprint(reordered)).toBe(computePlanFingerprint(BASE_INPUT));
  });

  it("is independent of clubsToArchive array order within a group", () => {
    const reorderedArchive: PlanFingerprintInput = {
      tenantKey: BASE_INPUT.tenantKey,
      groups: BASE_INPUT.groups.map((g) =>
        g.providerClubId === 100 ? { ...g, clubsToArchive: [...g.clubsToArchive].reverse() } : g,
      ),
    };

    expect(computePlanFingerprint(reorderedArchive)).toBe(computePlanFingerprint(BASE_INPUT));
  });

  it("changes when providerClubId changes", () => {
    const mutated: PlanFingerprintInput = {
      tenantKey: BASE_INPUT.tenantKey,
      groups: [{ ...BASE_INPUT.groups[0], providerClubId: 701 }, BASE_INPUT.groups[1]],
    };
    expect(computePlanFingerprint(mutated)).not.toBe(computePlanFingerprint(BASE_INPUT));
  });

  it("changes when canonicalClubId changes", () => {
    const mutated: PlanFingerprintInput = {
      tenantKey: BASE_INPUT.tenantKey,
      groups: [{ ...BASE_INPUT.groups[0], canonicalClubId: "club-z" }, BASE_INPUT.groups[1]],
    };
    expect(computePlanFingerprint(mutated)).not.toBe(computePlanFingerprint(BASE_INPUT));
  });

  it("changes when the clubsToArchive SET changes (not just order)", () => {
    const mutated: PlanFingerprintInput = {
      tenantKey: BASE_INPUT.tenantKey,
      groups: [{ ...BASE_INPUT.groups[0], clubsToArchive: ["club-a", "club-extra"] }, BASE_INPUT.groups[1]],
    };
    expect(computePlanFingerprint(mutated)).not.toBe(computePlanFingerprint(BASE_INPUT));
  });

  it("changes when teamsToMove changes", () => {
    const mutated: PlanFingerprintInput = {
      tenantKey: BASE_INPUT.tenantKey,
      groups: [{ ...BASE_INPUT.groups[0], teamsToMove: 2 }, BASE_INPUT.groups[1]],
    };
    expect(computePlanFingerprint(mutated)).not.toBe(computePlanFingerprint(BASE_INPUT));
  });

  it("changes when logoAdoptedFromClubId changes", () => {
    const mutated: PlanFingerprintInput = {
      tenantKey: BASE_INPUT.tenantKey,
      groups: [BASE_INPUT.groups[0], { ...BASE_INPUT.groups[1], logoAdoptedFromClubId: "club-e" }],
    };
    expect(computePlanFingerprint(mutated)).not.toBe(computePlanFingerprint(BASE_INPUT));
  });

  it("changes when a group is added or removed", () => {
    const withoutOne: PlanFingerprintInput = {
      tenantKey: BASE_INPUT.tenantKey,
      groups: [BASE_INPUT.groups[0]],
    };
    expect(computePlanFingerprint(withoutOne)).not.toBe(computePlanFingerprint(BASE_INPUT));
  });

  it("changes when the tenant changes — never reusable cross-tenant", () => {
    const otherTenant: PlanFingerprintInput = { ...BASE_INPUT, tenantKey: "some-other-tenant" };
    expect(computePlanFingerprint(otherTenant)).not.toBe(computePlanFingerprint(BASE_INPUT));
  });

  it("treats an empty group list deterministically", () => {
    const empty: PlanFingerprintInput = { tenantKey: "fc-allschwil", groups: [] };
    const fingerprint = computePlanFingerprint(empty);
    expect(fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(fingerprint).toBe(computePlanFingerprint({ tenantKey: "fc-allschwil", groups: [] }));
  });

  it("matches an independently computed SHA-256 over the canonical representation", () => {
    const canonical = buildCanonicalPlanRepresentation(BASE_INPUT);
    const expected = createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
    expect(computePlanFingerprint(BASE_INPUT)).toBe(expected);
  });
});

describe("buildCanonicalPlanRepresentation", () => {
  it("sorts groups by providerClubId ascending", () => {
    const canonical = buildCanonicalPlanRepresentation(BASE_INPUT);
    expect(canonical.groups.map((g) => g.providerClubId)).toEqual([100, 700]);
  });

  it("sorts each group's clubsToArchive lexicographically", () => {
    const canonical = buildCanonicalPlanRepresentation(BASE_INPUT);
    const group100 = canonical.groups.find((g) => g.providerClubId === 100);
    expect(group100?.clubsToArchive).toEqual(["club-c", "club-e"]);
  });

  it("does not mutate the input", () => {
    const clone = structuredClone(BASE_INPUT);
    buildCanonicalPlanRepresentation(BASE_INPUT);
    expect(BASE_INPUT).toEqual(clone);
  });
});
