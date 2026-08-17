/**
 * ADMIN-HARD-DELETE-UI-UPLIFT — Permission uplift authorization tests.
 *
 * Verifies that:
 *   UP-01  COMPETITIONS_DELETE exists and follows convention
 *   UP-02  NEWS_DELETE exists and follows convention
 *   UP-03  WEBSITE_DELETE exists and is distinct from WEBSITE_MANAGE
 *   UP-04  INFOBOARD_DELETE exists and is distinct from INFOBOARD_MANAGE
 *   UP-05  All new permissions follow the <module>.delete naming convention
 *   UP-06  WEBSITE_DELETE covers both website pages and nav items (same permission)
 */

import { describe, it, expect } from "vitest";
import { PERMISSIONS } from "@/lib/permissions/permissions";

describe("ADMIN-HARD-DELETE-UI-UPLIFT — permission constants", () => {
  it("UP-01: COMPETITIONS_DELETE exists and follows convention", () => {
    expect(PERMISSIONS.COMPETITIONS_DELETE).toBe("competitions.delete");
    expect(PERMISSIONS.COMPETITIONS_DELETE).not.toBe(PERMISSIONS.COMPETITIONS_MANAGE);
  });

  it("UP-02: NEWS_DELETE exists and is distinct from NEWS_MANAGE", () => {
    expect(PERMISSIONS.NEWS_DELETE).toBe("news.delete");
    expect(PERMISSIONS.NEWS_DELETE).not.toBe(PERMISSIONS.NEWS_MANAGE);
  });

  it("UP-03: WEBSITE_DELETE exists and is distinct from WEBSITE_MANAGE", () => {
    expect(PERMISSIONS.WEBSITE_DELETE).toBe("website.delete");
    expect(PERMISSIONS.WEBSITE_DELETE).not.toBe(PERMISSIONS.WEBSITE_MANAGE);
  });

  it("UP-04: INFOBOARD_DELETE exists and is distinct from INFOBOARD_MANAGE", () => {
    expect(PERMISSIONS.INFOBOARD_DELETE).toBe("infoboard.delete");
    expect(PERMISSIONS.INFOBOARD_DELETE).not.toBe(PERMISSIONS.INFOBOARD_MANAGE);
  });

  it("UP-05: all new uplift permissions follow the <module>.delete convention", () => {
    const upliftKeys = [
      PERMISSIONS.COMPETITIONS_DELETE,
      PERMISSIONS.NEWS_DELETE,
      PERMISSIONS.WEBSITE_DELETE,
      PERMISSIONS.INFOBOARD_DELETE,
    ];
    for (const key of upliftKeys) {
      expect(key).toMatch(/^[a-z_]+\.delete$/);
    }
  });

  it("UP-06: website.delete covers both website pages and nav items (same key)", () => {
    // Both website-pages and website-navigation DELETE handlers use WEBSITE_DELETE.
    // This test documents the intentional shared scope.
    expect(PERMISSIONS.WEBSITE_DELETE).toBe("website.delete");
  });
});
