/**
 * lib/publishing/infoboard/__tests__/screen1-tournament-presentation.test.ts
 */

import { describe, expect, it } from "vitest";
import { loadScreen1TournamentPresentationExtensions } from "../screen1-tournament-presentation";

describe("loadScreen1TournamentPresentationExtensions", () => {
  it("maps participants in display order with logos and kabinen labels", async () => {
    const database = {
      tournamentParticipant: {
        findMany: async () => [
          {
            id: "p1",
            eventId: "evt-t1",
            displayName: "FC Allschwil E1",
            manualLabel: null,
            displayOrder: 1,
            team: null,
            externalClub: {
              name: "FC Allschwil",
              shortName: null,
              logoUrl: "https://cdn.example.com/fca.png",
            },
            externalTeam: null,
            dressingRoomAllocations: [
              {
                displayOrder: 0,
                facilityResource: { code: "DR-B", name: "Kabine B" },
              },
            ],
          },
          {
            id: "p2",
            eventId: "evt-t1",
            displayName: null,
            manualLabel: null,
            displayOrder: 0,
            team: {
              name: "FC Binningen E1",
              shortName: null,
              alternativeName: null,
              infoboardDisplayName: "JUNIOREN E1",
            },
            externalClub: null,
            externalTeam: null,
            dressingRoomAllocations: [
              {
                displayOrder: 0,
                facilityResource: { code: "DR-A", name: "Kabine A" },
              },
            ],
          },
        ],
      },
    };

    const extensions = await loadScreen1TournamentPresentationExtensions(
      database,
      "tenant-a",
      ["evt-t1"],
      "https://cdn.example.com/tenant.png",
    );

    expect(extensions).toHaveLength(1);
    expect(extensions[0]?.eventId).toBe("evt-t1");
    expect(extensions[0]?.participantAllocations).toEqual([
      {
        id: "p2",
        teamDisplayName: "JUNIOREN E1",
        dressingRoomLabel: "DR-A",
        clubLogoUrl: "https://cdn.example.com/tenant.png",
      },
      {
        id: "p1",
        teamDisplayName: "FC Allschwil E1",
        dressingRoomLabel: "DR-B",
        clubLogoUrl: "https://cdn.example.com/fca.png",
      },
    ]);
  });

  it("returns empty array when no tournament ids are supplied", async () => {
    const database = {
      tournamentParticipant: {
        findMany: async () => {
          throw new Error("should not be called");
        },
      },
    };

    await expect(
      loadScreen1TournamentPresentationExtensions(database, "tenant-a", [], null),
    ).resolves.toEqual([]);
  });

  it("keeps explicit participant displayName above Team.infoboardDisplayName", async () => {
    const database = {
      tournamentParticipant: {
        findMany: async () => [
          {
            id: "p-override",
            eventId: "evt-t3",
            displayName: "Custom Label",
            manualLabel: null,
            displayOrder: 0,
            team: {
              name: "E4",
              shortName: "E4",
              alternativeName: "Junioren E4",
              infoboardDisplayName: "JUNIOREN E4",
            },
            externalClub: null,
            externalTeam: null,
            dressingRoomAllocations: [],
          },
        ],
      },
    };

    const extensions = await loadScreen1TournamentPresentationExtensions(
      database,
      "tenant-a",
      ["evt-t3"],
      null,
    );

    expect(extensions[0]?.participantAllocations?.[0]?.teamDisplayName).toBe(
      "Custom Label",
    );
  });

  it("allows manual participants without logos", async () => {
    const database = {
      tournamentParticipant: {
        findMany: async () => [
          {
            id: "p-manual",
            eventId: "evt-t2",
            displayName: null,
            manualLabel: "Gastverein",
            displayOrder: 0,
            team: null,
            externalClub: null,
            externalTeam: null,
            dressingRoomAllocations: [],
          },
        ],
      },
    };

    const extensions = await loadScreen1TournamentPresentationExtensions(
      database,
      "tenant-a",
      ["evt-t2"],
      null,
    );

    expect(extensions[0]?.participantAllocations?.[0]).toMatchObject({
      teamDisplayName: "Gastverein",
      clubLogoUrl: null,
    });
  });
});
