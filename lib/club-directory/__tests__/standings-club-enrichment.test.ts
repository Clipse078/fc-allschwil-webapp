import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildStandingsClubEnrichmentByProviderTeamId } from "../standings-club-enrichment";

const mocks = vi.hoisted(() => ({
  loadCanonicalClubLogoIndex: vi.fn(),
}));

vi.mock("../canonical-logo-resolution", async () => {
  const actual = await vi.importActual<typeof import("../canonical-logo-resolution")>(
    "../canonical-logo-resolution",
  );
  return {
    ...actual,
    loadCanonicalClubLogoIndex: mocks.loadCanonicalClubLogoIndex,
  };
});

const TENANT_ID = "tenant-fca";
const EXPLICIT_LOGO = "https://cdn.example.com/explicit.png";
const AUTO_LOGO = "https://cdn.example.com/fc-black-stars.png";

describe("buildStandingsClubEnrichmentByProviderTeamId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadCanonicalClubLogoIndex.mockResolvedValue(new Map());
  });

  it("prefers explicit provider mapping over automatic resolution", async () => {
    const externalTeamFindMany = vi.fn().mockResolvedValue([
      {
        shortName: "Explicit Short",
        logoUrl: EXPLICIT_LOGO,
        externalClub: {
          id: "club-explicit",
          name: "FC Black Stars",
          shortName: "Stars",
          logoUrl: EXPLICIT_LOGO,
        },
        providerMappings: [
          {
            providerTeamId: 100,
            providerClubId: 483,
            providerTeamName: "FC Black Stars D7a",
          },
        ],
      },
    ]);
    const externalClubFindMany = vi.fn().mockResolvedValue([
      {
        id: "club-auto",
        name: "FC Black Stars",
        shortName: null,
        alternativeName: null,
        logoUrl: AUTO_LOGO,
        providerMappings: [],
      },
    ]);

    const enrichment = await buildStandingsClubEnrichmentByProviderTeamId({
      tenantId: TENANT_ID,
      rows: [{ providerTeamId: 100, providerTeamName: "FC Black Stars D7a" }],
      database: {
        externalTeam: { findMany: externalTeamFindMany },
        externalClub: { findMany: externalClubFindMany },
      },
    });

    expect(enrichment.get(100)).toEqual({
      canonicalClubId: "club-explicit",
      shortName: "Explicit Short",
      logoUrl: EXPLICIT_LOGO,
      resolutionSource: "explicit_provider_mapping",
      providerTeamName: "FC Black Stars D7a",
    });
  });

  it("auto-resolves unmapped provider team names and exposes canonical logoUrl", async () => {
    const externalTeamFindMany = vi.fn().mockResolvedValue([]);
    const externalClubFindMany = vi.fn().mockResolvedValue([
      {
        id: "club-black-stars",
        name: "FC Black Stars",
        shortName: "Black Stars",
        alternativeName: null,
        logoUrl: AUTO_LOGO,
        providerMappings: [],
      },
    ]);

    const enrichment = await buildStandingsClubEnrichmentByProviderTeamId({
      tenantId: TENANT_ID,
      rows: [{ providerTeamId: 200, providerTeamName: "FC Black Stars D7a" }],
      database: {
        externalTeam: { findMany: externalTeamFindMany },
        externalClub: { findMany: externalClubFindMany },
      },
    });

    expect(enrichment.get(200)).toEqual({
      canonicalClubId: "club-black-stars",
      shortName: "Black Stars",
      logoUrl: AUTO_LOGO,
      resolutionSource: "prefix_name_match",
      providerTeamName: null,
    });
  });

  it("returns unresolved enrichment when no mapping or auto match exists", async () => {
    const enrichment = await buildStandingsClubEnrichmentByProviderTeamId({
      tenantId: TENANT_ID,
      rows: [{ providerTeamId: 999, providerTeamName: "Unknown Club D7" }],
      database: {
        externalTeam: { findMany: vi.fn().mockResolvedValue([]) },
        externalClub: { findMany: vi.fn().mockResolvedValue([]) },
      },
    });

    expect(enrichment.get(999)).toEqual({
      canonicalClubId: null,
      shortName: null,
      logoUrl: null,
      resolutionSource: "unresolved",
      providerTeamName: null,
    });
  });

  it("loads canonical clubs once for all rows", async () => {
    const externalTeamFindMany = vi.fn().mockResolvedValue([]);
    const externalClubFindMany = vi.fn().mockResolvedValue([
      {
        id: "club-a",
        name: "FC Aesch",
        shortName: null,
        alternativeName: null,
        logoUrl: "https://cdn.example.com/a.png",
        providerMappings: [],
      },
      {
        id: "club-b",
        name: "FC Black Stars",
        shortName: null,
        alternativeName: null,
        logoUrl: "https://cdn.example.com/b.png",
        providerMappings: [],
      },
    ]);

    await buildStandingsClubEnrichmentByProviderTeamId({
      tenantId: TENANT_ID,
      rows: [
        { providerTeamId: 1, providerTeamName: "FC Aesch D7-1" },
        { providerTeamId: 2, providerTeamName: "FC Black Stars D7a" },
      ],
      database: {
        externalTeam: { findMany: externalTeamFindMany },
        externalClub: { findMany: externalClubFindMany },
      },
    });

    expect(externalClubFindMany).toHaveBeenCalledTimes(1);
    expect(externalTeamFindMany).toHaveBeenCalledTimes(1);
  });
});
