import { describe, expect, it } from "vitest";

import {
  buildExternalClubMappingUpdate,
  buildExternalClubTenantFieldUpdate,
  buildExternalTeamMappingUpdate,
} from "../provider-sync";

const NOW = new Date("2026-08-01T10:00:00.000Z");

describe("buildExternalClubMappingUpdate", () => {
  it("refreshes every provider-owned field and stamps lastSyncedAt", () => {
    const update = buildExternalClubMappingUpdate(
      {
        providerClubName: "SV Muttenz",
        providerLogoUrl: "https://sfv.example.com/logo.gif",
        providerWebsite: "https://svmuttenz.ch",
        providerIsActive: true,
      },
      NOW,
    );

    expect(update).toEqual({
      providerClubName: "SV Muttenz",
      providerLogoUrl: "https://sfv.example.com/logo.gif",
      providerWebsite: "https://svmuttenz.ch",
      providerIsActive: true,
      lastSyncedAt: NOW,
    });
  });

  it("defaults missing optional fields to null / true", () => {
    const update = buildExternalClubMappingUpdate({}, NOW);
    expect(update).toEqual({
      providerClubName: null,
      providerLogoUrl: null,
      providerWebsite: null,
      providerIsActive: true,
      lastSyncedAt: NOW,
    });
  });
});

describe("buildExternalTeamMappingUpdate", () => {
  it("refreshes every provider-owned field and stamps lastSyncedAt", () => {
    const update = buildExternalTeamMappingUpdate(
      {
        providerTeamName: "SV Muttenz B1",
        providerClubId: 483,
        providerOrganisationId: 12,
        providerLogoUrl: "https://sfv.example.com/logo.gif",
        providerIsActive: false,
      },
      NOW,
    );

    expect(update).toEqual({
      providerTeamName: "SV Muttenz B1",
      providerClubId: 483,
      providerOrganisationId: 12,
      providerLogoUrl: "https://sfv.example.com/logo.gif",
      providerIsActive: false,
      lastSyncedAt: NOW,
    });
  });
});

describe("buildExternalClubTenantFieldUpdate — non-destructive sync", () => {
  it("returns no update when the club already has a tenant-managed logo", () => {
    const update = buildExternalClubTenantFieldUpdate(
      "https://blob.example.com/tenant-logo.png",
      "https://sfv.example.com/provider-logo.gif",
    );
    expect(update).toEqual({});
  });

  it("fills logoUrl when the club has no logo yet and the provider reports one", () => {
    const update = buildExternalClubTenantFieldUpdate(
      null,
      "https://sfv.example.com/provider-logo.gif",
    );
    expect(update).toEqual({ logoUrl: "https://sfv.example.com/provider-logo.gif" });
  });

  it("returns no update when neither side has a logo", () => {
    expect(buildExternalClubTenantFieldUpdate(null, null)).toEqual({});
  });

  it("returns no update when the resolved value already matches the current logo", () => {
    expect(
      buildExternalClubTenantFieldUpdate(
        "https://blob.example.com/tenant-logo.png",
        "https://blob.example.com/tenant-logo.png",
      ),
    ).toEqual({});
  });

  it("never returns any field other than logoUrl", () => {
    const update = buildExternalClubTenantFieldUpdate(null, "https://sfv.example.com/logo.gif");
    expect(Object.keys(update)).toEqual(["logoUrl"]);
  });
});
