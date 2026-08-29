/**
 * lib/publishing/infoboard/__tests__/screen1-tournament-presentation.test.ts
 */

import { describe, expect, it, vi } from "vitest";
import {
  buildScreen1TournamentPresentationExtensions,
  loadScreen1TournamentPresentationExtensions,
  resolveCanonicalTournamentEventId,
} from "../screen1-tournament-presentation";

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
              infoboardTrainingDisplayName: null,
              infoboardMatchDisplayName: null,
              infoboardTournamentDisplayName: "FCA E1 Tournament",
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
        teamDisplayName: "FCA E1 Tournament",
        dressingRoomLabel: "DR-A",
        clubLogoUrl: "https://cdn.example.com/tenant.png",
        isHomeTeam: true,
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
              infoboardTrainingDisplayName: null,
              infoboardMatchDisplayName: null,
              infoboardTournamentDisplayName: null,
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

  it("15 — external/unlinked Tournament participant remains unchanged", async () => {
    const database = {
      tournamentParticipant: {
        findMany: async () => [
          {
            id: "p-external",
            eventId: "evt-t4",
            displayName: null,
            manualLabel: null,
            displayOrder: 0,
            team: null,
            externalClub: {
              name: "FC Binningen",
              shortName: null,
              logoUrl: "https://cdn.example.com/binningen.png",
            },
            externalTeam: null,
            dressingRoomAllocations: [],
          },
        ],
      },
    };

    const extensions = await loadScreen1TournamentPresentationExtensions(
      database,
      "tenant-a",
      ["evt-t4"],
      null,
    );

    expect(extensions[0]?.participantAllocations?.[0]?.teamDisplayName).toBe(
      "FC Binningen",
    );
  });

  it("16 — scopes tournament participant lookup by tenantId", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const database = {
      tournamentParticipant: { findMany },
    };

    await loadScreen1TournamentPresentationExtensions(
      database,
      "tenant-a",
      ["evt-t1"],
      null,
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "tenant-a" }),
      }),
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

describe("resolveCanonicalTournamentEventId", () => {
  it("strips the tournament feed prefix for canonical Event ids", () => {
    expect(resolveCanonicalTournamentEventId("tournament:evt-playmore")).toBe(
      "evt-playmore",
    );
    expect(resolveCanonicalTournamentEventId("evt-legacy")).toBe("evt-legacy");
  });
});

describe("buildScreen1TournamentPresentationExtensions", () => {
  it("keys extensions by feed event id while querying canonical participant ids", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "p-ext",
        eventId: "evt-diegten",
        displayName: null,
        manualLabel: null,
        displayOrder: 0,
        team: null,
        externalClub: {
          name: "FC Diegten-Eptingen",
          shortName: null,
          logoUrl: "https://cdn.example.com/diegten.png",
        },
        externalTeam: null,
        dressingRoomAllocations: [],
      },
    ]);

    const extensions = await buildScreen1TournamentPresentationExtensions(
      { tournamentParticipant: { findMany } },
      {
        tenantId: "tenant-a",
        tenantName: "FC Allschwil",
        tenantLogoUrl: "https://cdn.example.com/tenant.png",
        tournaments: [
          {
            feedEventId: "tournament:evt-diegten",
            canonicalEventId: "evt-diegten",
            organizerName: "FC Diegten-Eptingen",
            teamDisplayName: null,
            homeAway: "HOME",
          },
        ],
      },
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          eventId: { in: ["evt-diegten"] },
        }),
      }),
    );
    expect(extensions).toEqual([
      {
        eventId: "tournament:evt-diegten",
        participantAllocations: [
          {
            id: "p-ext",
            teamDisplayName: "FC Diegten-Eptingen",
            dressingRoomLabel: null,
            clubLogoUrl: "https://cdn.example.com/diegten.png",
          },
        ],
      },
    ]);
  });

  it("uses organizer and tenant-team fallbacks when no explicit participants exist", async () => {
    const findMany = vi.fn().mockResolvedValue([]);

    const extensions = await buildScreen1TournamentPresentationExtensions(
      { tournamentParticipant: { findMany } },
      {
        tenantId: "tenant-a",
        tenantName: "FC Allschwil",
        tenantLogoUrl: "https://cdn.example.com/tenant.png",
        tournaments: [
          {
            feedEventId: "tournament:evt-playmore",
            canonicalEventId: "evt-playmore",
            organizerName: "BRACK.CH",
            teamDisplayName: "FC Allschwil",
            homeAway: "HOME",
          },
        ],
        organizerClubsByName: new Map([
          [
            "BRACK.CH",
            {
              id: "club-brack",
              logoUrl: "https://cdn.example.com/brack.png",
            },
          ],
        ]),
      },
    );

    expect(extensions).toEqual([
      {
        eventId: "tournament:evt-playmore",
        participantAllocations: [
          {
            id: "fallback-organizer:evt-playmore",
            teamDisplayName: "BRACK.CH",
            dressingRoomLabel: null,
            clubLogoUrl: "https://cdn.example.com/brack.png",
          },
          {
            id: "fallback-team:evt-playmore",
            teamDisplayName: "FC Allschwil",
            dressingRoomLabel: null,
            isHomeTeam: true,
            clubLogoUrl: "https://cdn.example.com/tenant.png",
          },
        ],
      },
    ]);
  });

  it("does not duplicate organizer and tenant team when names match", async () => {
    const findMany = vi.fn().mockResolvedValue([]);

    const extensions = await buildScreen1TournamentPresentationExtensions(
      { tournamentParticipant: { findMany } },
      {
        tenantId: "tenant-a",
        tenantName: "FC Allschwil",
        tenantLogoUrl: "https://cdn.example.com/tenant.png",
        tournaments: [
          {
            feedEventId: "tournament:evt-home",
            canonicalEventId: "evt-home",
            organizerName: "FC Allschwil",
            teamDisplayName: "FC Allschwil",
            homeAway: "HOME",
          },
        ],
        organizerClubsByName: new Map(),
      },
    );

    expect(extensions[0]?.participantAllocations).toHaveLength(1);
    expect(extensions[0]?.participantAllocations?.[0]).toMatchObject({
      teamDisplayName: "FC Allschwil",
      clubLogoUrl: "https://cdn.example.com/tenant.png",
    });
  });

  it("prefers explicit participants over organizer/team fallbacks", async () => {
    const findMany = vi.fn().mockResolvedValue([
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
    ]);

    const extensions = await buildScreen1TournamentPresentationExtensions(
      { tournamentParticipant: { findMany } },
      {
        tenantId: "tenant-a",
        tenantName: "FC Allschwil",
        tenantLogoUrl: null,
        tournaments: [
          {
            feedEventId: "tournament:evt-t2",
            canonicalEventId: "evt-t2",
            organizerName: "BRACK.CH",
            teamDisplayName: "FC Allschwil",
            homeAway: "HOME",
          },
        ],
      },
    );

    expect(extensions[0]?.participantAllocations).toEqual([
      {
        id: "p-manual",
        teamDisplayName: "Gastverein",
        dressingRoomLabel: null,
        clubLogoUrl: null,
      },
    ]);
  });
});
