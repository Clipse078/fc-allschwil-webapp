/**
 * Tests for resolveClubIdentityLogoUrl — MATCHCENTER-UX-03-C1
 *
 * Canonical rule:
 *   internal team (isOwnTeam) → tenantLogoUrl
 *   external team             → externalLogoUrl
 *   any → null when the relevant source has no logo
 */

import { describe, expect, it } from "vitest";
import { resolveClubIdentityLogoUrl } from "@/lib/matchcenter/club-identity";

const TENANT_LOGO = "https://blob.example.com/fca-logo.png";
const EXTERNAL_LOGO = "https://blob.example.com/fc-bubendorf.png";

const ownSide = { isOwnTeam: true, externalLogoUrl: null };
const externalSide = { isOwnTeam: false, externalLogoUrl: EXTERNAL_LOGO };
const externalSideNoLogo = { isOwnTeam: false, externalLogoUrl: null };

describe("resolveClubIdentityLogoUrl", () => {
  describe("internal team (isOwnTeam: true)", () => {
    it("returns tenantLogoUrl when tenant has a logo", () => {
      expect(resolveClubIdentityLogoUrl(ownSide, TENANT_LOGO)).toBe(TENANT_LOGO);
    });

    it("returns null when tenant has no logo (null)", () => {
      expect(resolveClubIdentityLogoUrl(ownSide, null)).toBeNull();
    });

    it("returns null when tenant has no logo (undefined)", () => {
      expect(resolveClubIdentityLogoUrl(ownSide, undefined)).toBeNull();
    });

    it("does not use externalLogoUrl even if the side has one set", () => {
      const ownSideWithExternal = { isOwnTeam: true, externalLogoUrl: EXTERNAL_LOGO };
      expect(resolveClubIdentityLogoUrl(ownSideWithExternal, TENANT_LOGO)).toBe(TENANT_LOGO);
    });

    it("falls back to null (not external logo) when tenant has no logo", () => {
      const ownSideWithExternal = { isOwnTeam: true, externalLogoUrl: EXTERNAL_LOGO };
      expect(resolveClubIdentityLogoUrl(ownSideWithExternal, null)).toBeNull();
    });
  });

  describe("external team (isOwnTeam: false)", () => {
    it("returns externalLogoUrl when external team has a logo", () => {
      expect(resolveClubIdentityLogoUrl(externalSide, TENANT_LOGO)).toBe(EXTERNAL_LOGO);
    });

    it("returns null when external team has no logo", () => {
      expect(resolveClubIdentityLogoUrl(externalSideNoLogo, TENANT_LOGO)).toBeNull();
    });

    it("returns null when external team has no logo and tenant has no logo", () => {
      expect(resolveClubIdentityLogoUrl(externalSideNoLogo, null)).toBeNull();
    });

    it("does not use tenantLogoUrl for external teams", () => {
      expect(resolveClubIdentityLogoUrl(externalSide, TENANT_LOGO)).toBe(EXTERNAL_LOGO);
    });
  });

  describe("home/away symmetry", () => {
    it("resolves own team the same way regardless of which side it is on", () => {
      const homeOwn = { isOwnTeam: true, externalLogoUrl: null };
      const awayOwn = { isOwnTeam: true, externalLogoUrl: null };
      expect(resolveClubIdentityLogoUrl(homeOwn, TENANT_LOGO)).toBe(
        resolveClubIdentityLogoUrl(awayOwn, TENANT_LOGO),
      );
    });

    it("resolves external team the same way regardless of which side it is on", () => {
      const homeExt = { isOwnTeam: false, externalLogoUrl: EXTERNAL_LOGO };
      const awayExt = { isOwnTeam: false, externalLogoUrl: EXTERNAL_LOGO };
      expect(resolveClubIdentityLogoUrl(homeExt, TENANT_LOGO)).toBe(
        resolveClubIdentityLogoUrl(awayExt, TENANT_LOGO),
      );
    });
  });
});
