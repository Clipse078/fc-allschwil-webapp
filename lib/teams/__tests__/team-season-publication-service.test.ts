import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  TeamPublicationChannel,
  TeamPublicationContent,
} from "@prisma/client";

const mocks = vi.hoisted(() => {
  const tx = {
    teamSeasonPublicationChannel: { upsert: vi.fn() },
    teamSeasonPublicationContent: { upsert: vi.fn() },
    teamSeason: { update: vi.fn() },
  };

  return {
    findFirst: vi.fn(),
    transaction: vi.fn(),
    tx,
  };
});

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    teamSeason: {
      findFirst: mocks.findFirst,
    },
    $transaction: mocks.transaction,
  },
}));

import {
  isWebsiteMemberPublicationEligible,
  resolveTeamSeasonContentDecision,
  resolveTeamSeasonPublication,
  resolveTeamSeasonPublicationPolicy,
  updateTeamSeasonPublicationSettings,
} from "../team-season-publication-service";

const legacy = {
  teamWebsiteVisible: true,
  teamInfoboardVisible: true,
  teamSeasonWebsiteVisible: true,
  teamSeasonInfoboardVisible: false,
  showNextMatch: false,
  showNextTournament: true,
  squadWebsiteVisible: false,
  trainerTeamWebsiteVisible: true,
};

function databaseTeamSeason() {
  return {
    websiteVisible: legacy.teamSeasonWebsiteVisible,
    infoboardVisible: legacy.teamSeasonInfoboardVisible,
    showNextMatch: legacy.showNextMatch,
    showNextTournament: legacy.showNextTournament,
    squadWebsiteVisible: legacy.squadWebsiteVisible,
    trainerTeamWebsiteVisible: legacy.trainerTeamWebsiteVisible,
    team: {
      websiteVisible: legacy.teamWebsiteVisible,
      infoboardVisible: legacy.teamInfoboardVisible,
    },
    publicationChannels: [],
    publicationContents: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findFirst.mockResolvedValue(databaseTeamSeason());
  mocks.tx.teamSeasonPublicationChannel.upsert.mockResolvedValue({});
  mocks.tx.teamSeasonPublicationContent.upsert.mockResolvedValue({});
  mocks.tx.teamSeason.update.mockResolvedValue({});
  mocks.transaction.mockImplementation(
    async (callback: (tx: typeof mocks.tx) => Promise<unknown>) =>
      callback(mocks.tx),
  );
});

describe("canonical TeamSeason publication defaults", () => {
  it("resolves all channels and all canonical content keys", () => {
    const publication = resolveTeamSeasonPublicationPolicy(legacy);

    expect(Object.keys(publication.channels)).toEqual([
      "WEBSITE",
      "MOBILE_APP",
      "INFOBOARD",
    ]);
    expect(Object.keys(publication.channels.WEBSITE.content)).toEqual([
      "TRAINING_TIMES",
      "NEXT_MATCH",
      "NEXT_TOURNAMENT",
      "TRAINER_TEAM",
      "SQUAD",
      "TEAM_PHOTO",
      "STANDINGS",
    ]);
  });

  it("uses the stricter Team AND TeamSeason Website fallback master", () => {
    const publication = resolveTeamSeasonPublicationPolicy({
      ...legacy,
      teamWebsiteVisible: false,
      teamSeasonWebsiteVisible: true,
    });

    expect(publication.channels.WEBSITE.enabled).toBe(false);
  });

  it("uses an explicit stored override instead of its legacy default", () => {
    const publication = resolveTeamSeasonPublicationPolicy(
      legacy,
      [{ channel: TeamPublicationChannel.WEBSITE, enabled: false }],
      [
        {
          channel: TeamPublicationChannel.WEBSITE,
          content: TeamPublicationContent.NEXT_MATCH,
          enabled: true,
        },
      ],
    );

    expect(publication.channels.WEBSITE.enabled).toBe(false);
    expect(publication.channels.WEBSITE.content.NEXT_MATCH).toBe(true);
  });

  it("defaults MOBILE_APP master and all Mobile content to false", () => {
    const mobile =
      resolveTeamSeasonPublicationPolicy(legacy).channels.MOBILE_APP;

    expect(mobile.enabled).toBe(false);
    expect(Object.values(mobile.content).every((enabled) => !enabled)).toBe(
      true,
    );
  });

  it.each([
    [TeamPublicationContent.NEXT_MATCH, "showNextMatch"],
    [TeamPublicationContent.NEXT_TOURNAMENT, "showNextTournament"],
    [TeamPublicationContent.SQUAD, "squadWebsiteVisible"],
    [TeamPublicationContent.TRAINER_TEAM, "trainerTeamWebsiteVisible"],
  ] as const)("keeps Website %s in parity with legacy %s", (content, field) => {
    const publication = resolveTeamSeasonPublicationPolicy(legacy);

    expect(publication.channels.WEBSITE.content[content]).toBe(legacy[field]);
  });

  it("defaults Website TRAINING_TIMES and STANDINGS on, TEAM_PHOTO off", () => {
    const website =
      resolveTeamSeasonPublicationPolicy(legacy).channels.WEBSITE.content;

    expect(website.TRAINING_TIMES).toBe(true);
    expect(website.TEAM_PHOTO).toBe(false);
    expect(website.STANDINGS).toBe(true);
  });

  it("keeps Infoboard content absent-by-default without inventing semantics", () => {
    const infoboard =
      resolveTeamSeasonPublicationPolicy(legacy).channels.INFOBOARD;

    expect(infoboard.enabled).toBe(false);
    expect(Object.values(infoboard.content).every((enabled) => !enabled)).toBe(
      true,
    );
  });
});

describe("resolver and effective decision", () => {
  it("uses a tenant-scoped TeamSeason lookup", async () => {
    await resolveTeamSeasonPublication({
      tenantId: "tenant-a",
      teamSeasonId: "team-season-a",
    });

    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "team-season-a",
          team: { tenantId: "tenant-a" },
        },
      }),
    );
  });

  it("does not reveal a TeamSeason outside the tenant", async () => {
    mocks.findFirst.mockResolvedValueOnce(null);

    await expect(
      resolveTeamSeasonPublication({
        tenantId: "tenant-b",
        teamSeasonId: "team-season-a",
      }),
    ).resolves.toMatchObject({
      ok: false,
      code: "TEAM_SEASON_NOT_FOUND",
    });
  });

  it("requires channel master and child content to both be enabled", async () => {
    mocks.findFirst.mockResolvedValueOnce({
      ...databaseTeamSeason(),
      publicationChannels: [
        { channel: TeamPublicationChannel.WEBSITE, enabled: false },
      ],
      publicationContents: [
        {
          channel: TeamPublicationChannel.WEBSITE,
          content: TeamPublicationContent.NEXT_MATCH,
          enabled: true,
        },
      ],
    });

    const decision = await resolveTeamSeasonContentDecision({
      tenantId: "tenant-a",
      teamSeasonId: "team-season-a",
      channel: TeamPublicationChannel.WEBSITE,
      content: TeamPublicationContent.NEXT_MATCH,
    });

    expect(decision).toEqual({
      ok: true,
      channelEnabled: false,
      contentEnabled: true,
      publishable: false,
    });
  });
});

describe("transactional partial mutations and compatibility mirrors", () => {
  it("persists explicit false and mirrors Website NEXT_MATCH in one transaction", async () => {
    const result = await updateTeamSeasonPublicationSettings({
      tenantId: "tenant-a",
      teamSeasonId: "team-season-a",
      channel: TeamPublicationChannel.WEBSITE,
      content: { [TeamPublicationContent.NEXT_MATCH]: false },
    });

    expect(result).toEqual({ ok: true });
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.tx.teamSeasonPublicationContent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ enabled: false }),
        update: { enabled: false },
      }),
    );
    expect(mocks.tx.teamSeason.update).toHaveBeenCalledWith({
      where: { id: "team-season-a" },
      data: { showNextMatch: false },
    });
  });

  it("leaves an omitted master and omitted content keys unchanged", async () => {
    await updateTeamSeasonPublicationSettings({
      tenantId: "tenant-a",
      teamSeasonId: "team-season-a",
      channel: TeamPublicationChannel.WEBSITE,
      content: { [TeamPublicationContent.SQUAD]: true },
    });

    expect(mocks.tx.teamSeasonPublicationChannel.upsert).not.toHaveBeenCalled();
    expect(mocks.tx.teamSeasonPublicationContent.upsert).toHaveBeenCalledTimes(
      1,
    );
    expect(mocks.tx.teamSeason.update).toHaveBeenCalledWith({
      where: { id: "team-season-a" },
      data: { squadWebsiteVisible: true },
    });
  });

  it.each([
    [TeamPublicationContent.NEXT_MATCH, "showNextMatch"],
    [TeamPublicationContent.NEXT_TOURNAMENT, "showNextTournament"],
    [TeamPublicationContent.SQUAD, "squadWebsiteVisible"],
    [TeamPublicationContent.TRAINER_TEAM, "trainerTeamWebsiteVisible"],
  ] as const)("mirrors Website %s to TeamSeason.%s", async (content, field) => {
    await updateTeamSeasonPublicationSettings({
      tenantId: "tenant-a",
      teamSeasonId: "team-season-a",
      channel: TeamPublicationChannel.WEBSITE,
      content: { [content]: true },
    });

    expect(mocks.tx.teamSeason.update).toHaveBeenCalledWith({
      where: { id: "team-season-a" },
      data: { [field]: true },
    });
  });

  it("mirrors a Website master only to the season-scoped legacy field", async () => {
    await updateTeamSeasonPublicationSettings({
      tenantId: "tenant-a",
      teamSeasonId: "team-season-a",
      channel: TeamPublicationChannel.WEBSITE,
      enabled: false,
    });

    expect(mocks.tx.teamSeason.update).toHaveBeenCalledWith({
      where: { id: "team-season-a" },
      data: { websiteVisible: false },
    });
  });

  it("returns a transaction failure without performing any outside write", async () => {
    mocks.tx.teamSeason.update.mockRejectedValueOnce(
      new Error("transaction rolled back"),
    );

    const result = await updateTeamSeasonPublicationSettings({
      tenantId: "tenant-a",
      teamSeasonId: "team-season-a",
      channel: TeamPublicationChannel.WEBSITE,
      content: { [TeamPublicationContent.NEXT_TOURNAMENT]: false },
    });

    expect(result).toEqual({
      ok: false,
      code: "UNKNOWN_ERROR",
      message: "transaction rolled back",
    });
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });

  it("rejects empty and non-boolean partial updates", async () => {
    await expect(
      updateTeamSeasonPublicationSettings({
        tenantId: "tenant-a",
        teamSeasonId: "team-season-a",
        channel: TeamPublicationChannel.WEBSITE,
      }),
    ).resolves.toMatchObject({ ok: false, code: "NO_FIELDS_SUPPLIED" });

    await expect(
      updateTeamSeasonPublicationSettings({
        tenantId: "tenant-a",
        teamSeasonId: "team-season-a",
        channel: TeamPublicationChannel.WEBSITE,
        enabled: "false" as never,
      }),
    ).resolves.toMatchObject({ ok: false, code: "INVALID_VALUE" });

    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

describe("compatibility boundaries", () => {
  it("never weakens member-level Website visibility", () => {
    expect(
      isWebsiteMemberPublicationEligible({
        channelEnabled: true,
        contentEnabled: true,
        memberWebsiteVisible: false,
      }),
    ).toBe(false);
  });

  it("leaves current Website consumers on their legacy fields", () => {
    const source = readFileSync(
      new URL("../../website/public-teams-feed.ts", import.meta.url),
      "utf8",
    );

    expect(source).toContain("websiteVisible: true");
    expect(source).toContain("squadWebsiteVisible: true");
    expect(source).toContain("trainerTeamWebsiteVisible: true");
    expect(source).not.toContain("team-season-publication-service");
    expect(source).not.toContain("publicationChannels");
  });

  it("leaves current Infoboard consumers independent of TeamSeason masters", () => {
    const source = readFileSync(
      new URL("../../publishing/infoboard/canonical-source-loader.ts", import.meta.url),
      "utf8",
    );

    expect(source).not.toContain("team-season-publication-service");
    expect(source).not.toContain("publicationChannels");
    expect(source).not.toContain("teamSeason.infoboardVisible");
  });
});
