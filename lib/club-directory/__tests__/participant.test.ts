import { describe, expect, it } from "vitest";

import { toExternalTeamParticipantRef, toTenantTeamParticipantRef } from "../participant";

describe("toTenantTeamParticipantRef", () => {
  it("builds a TENANT_TEAM participant ref from a tenant Team", () => {
    const ref = toTenantTeamParticipantRef({ id: "team-1", name: "FC Allschwil B2" });
    expect(ref).toEqual({ kind: "TENANT_TEAM", teamId: "team-1", label: "FC Allschwil B2" });
  });
});

describe("toExternalTeamParticipantRef — TournamentCenter / friendly-match readiness", () => {
  it("builds an EXTERNAL_TEAM participant ref carrying both team and club labels", () => {
    const club = { id: "club-1", name: "SV Muttenz" };
    const team = { id: "team-1", name: "SV Muttenz B2", externalClubId: "club-1" };

    const ref = toExternalTeamParticipantRef(team, club);

    expect(ref).toEqual({
      kind: "EXTERNAL_TEAM",
      externalTeamId: "team-1",
      externalClubId: "club-1",
      label: "SV Muttenz B2",
      clubLabel: "SV Muttenz",
    });
  });

  it("throws when the supplied club does not match the team's externalClubId", () => {
    const mismatchedClub = { id: "club-2", name: "FC Concordia Basel" };
    const team = { id: "team-1", name: "SV Muttenz B2", externalClubId: "club-1" };

    expect(() => toExternalTeamParticipantRef(team, mismatchedClub)).toThrow(
      /does not match/,
    );
  });

  it("produces a discriminated union usable by a single participant picker (tenant Team + ExternalTeam side by side)", () => {
    const participants = [
      toTenantTeamParticipantRef({ id: "team-1", name: "FC Allschwil B2" }),
      toExternalTeamParticipantRef(
        { id: "team-2", name: "SV Muttenz B2", externalClubId: "club-1" },
        { id: "club-1", name: "SV Muttenz" },
      ),
      toExternalTeamParticipantRef(
        { id: "team-3", name: "FC Reinach B", externalClubId: "club-2" },
        { id: "club-2", name: "FC Reinach" },
      ),
    ];

    const labels = participants.map((p) => p.label);
    expect(labels).toEqual(["FC Allschwil B2", "SV Muttenz B2", "FC Reinach B"]);

    const kinds = new Set(participants.map((p) => p.kind));
    expect(kinds).toEqual(new Set(["TENANT_TEAM", "EXTERNAL_TEAM"]));
  });
});
