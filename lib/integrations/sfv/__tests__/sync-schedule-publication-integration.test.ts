/**
 * lib/integrations/sfv/__tests__/sync-schedule-publication-integration.test.ts
 *
 * Integration-style test: verifies that a representative SFV-synced home event
 * with homeAway="HOME" and infoboardVisible=true becomes ELIGIBLE on
 * INFOBOARD_SCREEN_1, and that an away event is rejected as AWAY_MATCH.
 *
 * Also demonstrates K5 legacy behavior: "H" remains rejected by policy
 * (HOME_AWAY_UNKNOWN) because canonical persistence is the primary fix.
 *
 * No Prisma, no database, no mocks — exercises pure policy functions only.
 *
 * TEST COVERAGE:
 *   I1. Synced home event (homeAway="HOME", infoboardVisible=true) → ELIGIBLE
 *   I2. Synced away event (homeAway="AWAY", infoboardVisible=true) → AWAY_MATCH
 *   I3. Legacy value "H" (not yet corrected) → HOME_AWAY_UNKNOWN (not ELIGIBLE)
 *   I4. Legacy value "A" (not yet corrected) → HOME_AWAY_UNKNOWN
 *   I5. Home event with infoboardVisible=false → INFOBOARD_HIDDEN (not ELIGIBLE)
 */

import { describe, it, expect } from "vitest";
import { evaluatePublication } from "@/lib/publishing/policy/publication-policy";
import type { PublicationPolicyEvent } from "@/lib/publishing/policy/publication-policy";

const TENANT = "fc-allschwil";

function makeSyncedMatchEvent(
  overrides: Partial<PublicationPolicyEvent> = {},
): PublicationPolicyEvent {
  return {
    tenantId: TENANT,
    status: "SCHEDULED",
    type: "MATCH",
    homeAway: "HOME",
    infoboardVisible: true,
    websiteVisible: false,
    trainingsplanVisible: false,
    ...overrides,
  };
}

describe("SFV-synced home event → publication eligibility", () => {
  it("I1: homeAway='HOME', infoboardVisible=true → ELIGIBLE on INFOBOARD_SCREEN_1", () => {
    const event = makeSyncedMatchEvent({ homeAway: "HOME", infoboardVisible: true });
    const result = evaluatePublication(event, "INFOBOARD_SCREEN_1", TENANT);
    expect(result.eligible).toBe(true);
    expect(result.reason).toBe("ELIGIBLE");
  });

  it("I2: homeAway='AWAY', infoboardVisible=true → AWAY_MATCH on INFOBOARD_SCREEN_1", () => {
    const event = makeSyncedMatchEvent({ homeAway: "AWAY", infoboardVisible: true });
    const result = evaluatePublication(event, "INFOBOARD_SCREEN_1", TENANT);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("AWAY_MATCH");
  });

  it("I3: legacy value 'H' → HOME_AWAY_UNKNOWN (not corrected yet, policy rejects)", () => {
    const event = makeSyncedMatchEvent({ homeAway: "H", infoboardVisible: true });
    const result = evaluatePublication(event, "INFOBOARD_SCREEN_1", TENANT);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("HOME_AWAY_UNKNOWN");
  });

  it("I4: legacy value 'A' → HOME_AWAY_UNKNOWN", () => {
    const event = makeSyncedMatchEvent({ homeAway: "A", infoboardVisible: true });
    const result = evaluatePublication(event, "INFOBOARD_SCREEN_1", TENANT);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("HOME_AWAY_UNKNOWN");
  });

  it("I5: homeAway='HOME', infoboardVisible=false → INFOBOARD_HIDDEN (not ELIGIBLE)", () => {
    const event = makeSyncedMatchEvent({ homeAway: "HOME", infoboardVisible: false });
    const result = evaluatePublication(event, "INFOBOARD_SCREEN_1", TENANT);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("INFOBOARD_HIDDEN");
  });
});
