/**
 * DASHBOARD-SHELL-UX-01-C1 — Fix personalized greeting wiring.
 *
 * Root cause: the tenant club-admin bootstrap account (see
 * scripts/rperm-03b-bootstrap-admin-separation.ts) was created with
 * `User.firstName = "FC Allschwil"` (the tenant/club name, not a person's
 * name). `session.user.firstName` is sourced directly from that column, so
 * the dashboard greeting rendered "Guten Morgen, FC Allschwil 👋" instead of
 * the authenticated person's real first name ("Michael"), which lives on
 * the canonically linked Person record (Person.userId, ADMIN-MASTERDATA-UX-01).
 *
 * These tests cover `resolveDashboardFirstName()` (the new resolution rule
 * wired into app/(admin)/dashboard/page.tsx) composed with
 * `getPersonalizedGreeting()`, proving the exact greeting string the
 * dashboard now renders end-to-end for each scenario — without needing to
 * render the full dashboard page.
 */

import { describe, it, expect } from "vitest";
import { getPersonalizedGreeting, resolveDashboardFirstName } from "@/lib/dashboard/greeting";

function greetingFor(
  candidates: Parameters<typeof resolveDashboardFirstName>[0],
  now: Date,
): string {
  return getPersonalizedGreeting(resolveDashboardFirstName(candidates), now);
}

describe("DASHBOARD-SHELL-UX-01-C1 — dashboard greeting wiring", () => {
  describe("linked Person firstName takes priority", () => {
    it('renders "Guten Morgen, Michael" when the linked Person is Michael, even though the User row and tenant are "FC Allschwil"', () => {
      const greeting = greetingFor(
        {
          linkedPersonFirstName: "Michael",
          sessionFirstName: "FC Allschwil",
          tenantName: "FC Allschwil",
        },
        new Date(2026, 0, 1, 8, 0),
      );
      expect(greeting).toBe("Guten Morgen, Michael");
    });

    it("German day/evening variants still work for the resolved Person name", () => {
      const candidates = {
        linkedPersonFirstName: "Michael",
        sessionFirstName: "FC Allschwil",
        tenantName: "FC Allschwil",
      };
      expect(greetingFor(candidates, new Date(2026, 0, 1, 14, 0))).toBe("Guten Tag, Michael");
      expect(greetingFor(candidates, new Date(2026, 0, 1, 20, 0))).toBe("Guten Abend, Michael");
    });
  });

  describe("generic fallback, never the tenant name", () => {
    it("falls back to the generic salutation when no Person is linked and session.user.firstName is blank", () => {
      const greeting = greetingFor(
        {
          linkedPersonFirstName: null,
          sessionFirstName: "",
          tenantName: "FC Allschwil",
        },
        new Date(2026, 0, 1, 8, 0),
      );
      expect(greeting).toBe("Guten Morgen, zusammen");
      expect(greeting).not.toContain("FC Allschwil");
    });

    it("falls back to the generic salutation when no Person is linked and session.user.firstName is missing", () => {
      const greeting = greetingFor(
        {
          linkedPersonFirstName: undefined,
          sessionFirstName: undefined,
          tenantName: "FC Allschwil",
        },
        new Date(2026, 0, 1, 8, 0),
      );
      expect(greeting).toBe("Guten Morgen, zusammen");
    });

    it('never renders "FC Allschwil" as the greeting identity, even if it leaked into session.user.firstName and no Person is linked', () => {
      const greeting = greetingFor(
        {
          linkedPersonFirstName: null,
          sessionFirstName: "FC Allschwil",
          tenantName: "FC Allschwil",
        },
        new Date(2026, 0, 1, 8, 0),
      );
      expect(greeting).not.toContain("FC Allschwil");
      expect(greeting).toBe("Guten Morgen, zusammen");
    });

    it("matches the tenant name case-insensitively when filtering out the tenant name", () => {
      const greeting = greetingFor(
        {
          linkedPersonFirstName: null,
          sessionFirstName: "fc allschwil",
          tenantName: "FC Allschwil",
        },
        new Date(2026, 0, 1, 8, 0),
      );
      expect(greeting.toLowerCase()).not.toContain("fc allschwil");
    });
  });

  describe("unaffected accounts keep working as before", () => {
    it("uses session.user.firstName when no Person is linked but the User has a real first name", () => {
      const greeting = greetingFor(
        {
          linkedPersonFirstName: null,
          sessionFirstName: "Peter",
          tenantName: "FC Allschwil",
        },
        new Date(2026, 0, 1, 8, 0),
      );
      expect(greeting).toBe("Guten Morgen, Peter");
    });
  });
});
