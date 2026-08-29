/**
 * lib/tournaments/__tests__/club-identity.test.ts
 *
 * TOURNAMENT-LOGOS-01A — canonical tournament club logo resolution.
 */

import { describe, expect, it } from "vitest";
import {
  buildOrganizerClubLookupIndex,
  lookupOrganizerClub,
  normalizeClubNameForLookup,
  resolveTournamentOrganizerIdentity,
  resolveTournamentParticipantLogoUrl,
} from "../club-identity";

const TENANT_LOGO = "https://cdn.example.com/tenant.png";
const EXTERNAL_LOGO = "https://cdn.example.com/external.png";

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
          externalClub: { id: "club-1", logoUrl: EXTERNAL_LOGO },
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
            logoUrl: null,
            externalClub: { logoUrl: EXTERNAL_LOGO },
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
