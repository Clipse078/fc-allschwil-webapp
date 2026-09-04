/**
 * lib/tournaments/__tests__/club-identity.test.ts
 *
 * TOURNAMENT-LOGOS-01A — canonical tournament club logo resolution.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: { externalClub: { findMany: vi.fn() } },
}));

import { prisma } from "@/lib/db/prisma";
import {
  buildOrganizerClubLookupIndex,
  lookupOrganizerClub,
  normalizeClubNameForLookup,
  resolveTournamentOrganizerIdentity,
  resolveTournamentParticipantLogoUrl,
} from "../club-identity";
import {
  buildTournamentLogoResolutionContext,
  loadTournamentLogoResolutionContext,
} from "../logo-resolution-context";

const TENANT_LOGO = "https://cdn.example.com/tenant.png";
const EXTERNAL_LOGO = "https://cdn.example.com/external.png";

beforeEach(() => {
  vi.mocked(prisma.externalClub.findMany).mockResolvedValue([] as never);
});

describe("normalizeClubNameForLookup", () => {
  it("collapses hyphen and space variants", () => {
    expect(normalizeClubNameForLookup("FC Diegten-Eptingen")).toBe(
      normalizeClubNameForLookup("FC Diegten Eptingen"),
    );
  });
});

describe("resolveTournamentParticipantLogoUrl", () => {
  it("uses tenant logo for own-team participants", () => {
    expect(
      resolveTournamentParticipantLogoUrl(
        { team: { id: "team-1" }, externalClub: null, externalTeam: null },
        TENANT_LOGO,
      ),
    ).toBe(TENANT_LOGO);
  });

  it("uses external club logo for EXTERNAL_CLUB participants", () => {
    expect(
      resolveTournamentParticipantLogoUrl(
        {
          team: null,
          externalClub: {
            id: "club-1",
            name: "Example FC",
            logoUrl: EXTERNAL_LOGO,
          },
          externalTeam: null,
        },
        TENANT_LOGO,
      ),
    ).toBe(EXTERNAL_LOGO);
  });

  it("uses external team override with club fallback", () => {
    expect(
      resolveTournamentParticipantLogoUrl(
        {
          team: null,
          externalClub: null,
          externalTeam: {
            name: "Example FC E1",
            logoUrl: null,
            externalClub: { name: "Example FC", logoUrl: EXTERNAL_LOGO },
          },
        },
        TENANT_LOGO,
      ),
    ).toBe(EXTERNAL_LOGO);
  });

  it("returns null for manual participants", () => {
    expect(
      resolveTournamentParticipantLogoUrl(
        { team: null, externalClub: null, externalTeam: null },
        TENANT_LOGO,
      ),
    ).toBeNull();
  });

  it("uses mapped canonical Verein before a stale direct parent logo", () => {
    const context = buildTournamentLogoResolutionContext([
      {
        name: "Canonical United",
        shortName: null,
        alternativeName: null,
        logoUrl: "https://cdn.example.com/canonical.png",
        providerMappings: [
          { providerClubId: 42, providerClubName: "Canonical United" },
        ],
      },
    ]);

    expect(
      resolveTournamentParticipantLogoUrl(
        {
          team: null,
          externalClub: null,
          externalTeam: {
            name: "Canonical United U15",
            logoUrl: null,
            providerMappings: [{ providerClubId: 42 }],
            externalClub: {
              name: "Provider Shell",
              logoUrl: "https://cdn.example.com/stale.png",
            },
          },
        },
        null,
        context,
      ),
    ).toBe("https://cdn.example.com/canonical.png");
  });

  it("uses normalized club-name canonical fallback before a stale direct logo", () => {
    const context = buildTournamentLogoResolutionContext([
      {
        name: "Example-Town FC",
        shortName: null,
        alternativeName: null,
        logoUrl: "https://cdn.example.com/canonical-name.png",
        providerMappings: [
          { providerClubId: 84, providerClubName: "Example-Town FC" },
        ],
      },
    ]);

    expect(
      resolveTournamentParticipantLogoUrl(
        {
          team: null,
          externalClub: {
            name: "Example Town FC",
            logoUrl: "https://cdn.example.com/stale.png",
          },
          externalTeam: null,
        },
        null,
        context,
      ),
    ).toBe("https://cdn.example.com/canonical-name.png");
  });

  it("keeps team overrides above canonical and direct club logos", () => {
    const context = buildTournamentLogoResolutionContext([
      {
        name: "Override FC",
        shortName: null,
        alternativeName: null,
        logoUrl: "https://cdn.example.com/canonical.png",
        providerMappings: [
          { providerClubId: 126, providerClubName: "Override FC" },
        ],
      },
    ]);

    expect(
      resolveTournamentParticipantLogoUrl(
        {
          team: null,
          externalClub: null,
          externalTeam: {
            name: "Override FC U17",
            logoUrl: "https://cdn.example.com/team.png",
            providerMappings: [{ providerClubId: 126 }],
            externalClub: {
              name: "Override FC",
              logoUrl: "https://cdn.example.com/direct.png",
            },
          },
        },
        null,
        context,
      ),
    ).toBe("https://cdn.example.com/team.png");
  });
});

describe("loadTournamentLogoResolutionContext", () => {
  it("loads canonical provider-linked clubs within the requested tenant", async () => {
    await loadTournamentLogoResolutionContext("tenant-a");

    expect(prisma.externalClub.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-a",
          archivedAt: null,
        }),
      }),
    );
  });
});

describe("resolveTournamentOrganizerIdentity", () => {
  it("resolves organizer from canonical external club", () => {
    expect(
      resolveTournamentOrganizerIdentity({
        organizerName: "FC Möhlin-Riburg/ACLI",
        homeAway: "AWAY",
        tenantName: "FC Allschwil",
        tenantLogoUrl: TENANT_LOGO,
        resolvedOrganizerClub: { id: "club-mohlin", logoUrl: EXTERNAL_LOGO },
      }),
    ).toEqual({
      logoUrl: EXTERNAL_LOGO,
      externalClubId: "club-mohlin",
    });
  });

  it("uses tenant logo for HOME tournaments when organizer matches tenant", () => {
    expect(
      resolveTournamentOrganizerIdentity({
        organizerName: "FC Allschwil",
        homeAway: "HOME",
        tenantName: "FC Allschwil",
        tenantLogoUrl: TENANT_LOGO,
        resolvedOrganizerClub: null,
      }),
    ).toEqual({
      logoUrl: TENANT_LOGO,
      externalClubId: null,
    });
  });

  it("returns null when organizer cannot be resolved", () => {
    expect(
      resolveTournamentOrganizerIdentity({
        organizerName: "Unknown Club",
        homeAway: "AWAY",
        tenantName: "FC Allschwil",
        tenantLogoUrl: TENANT_LOGO,
        resolvedOrganizerClub: null,
      }),
    ).toEqual({
      logoUrl: null,
      externalClubId: null,
    });
  });
});

describe("organizer club lookup index", () => {
  it("matches organizer names with hyphen/space variants", () => {
    const index = buildOrganizerClubLookupIndex([
      {
        id: "club-diegten",
        name: "FC Diegten Eptingen",
        shortName: null,
        alternativeName: null,
        logoUrl: EXTERNAL_LOGO,
      },
    ]);

    expect(lookupOrganizerClub("FC Diegten-Eptingen", index)).toEqual({
      id: "club-diegten",
      logoUrl: EXTERNAL_LOGO,
    });
  });
});
