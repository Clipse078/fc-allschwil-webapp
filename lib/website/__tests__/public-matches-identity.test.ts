/**
 * SCE-SPORTING-IDENTITY-01 — canonical match participant identity tests.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { buildCanonicalClubLogoIndex } from "@/lib/club-directory/canonical-logo-resolution";
import { resolveMatchParticipantIdentity } from "@/lib/sporting-data/match-participant-identity";
import type { CanonicalEventPolicyRow } from "@/lib/publishing/infoboard/canonical-source-loader";
import {
  enrichPublicMatchesWithIdentity,
  loadMatchEventPoliciesByEventId,
} from "@/lib/website/public-matches-identity";
import type { PublicEventItem } from "@/lib/events/public-event-feed";

const TENANT_ID = "tenant-fca";
const TENANT_NAME = "FC Allschwil";
const TENANT_LOGO = "https://cdn.example.com/fca.png";
const OPPONENT_LOGO = "https://cdn.example.com/koeniz.png";

const mocks = vi.hoisted(() => ({
  eventFindMany: vi.fn(),
  tenantFindFirst: vi.fn(),
  externalClubProviderMappingFindMany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    event: { findMany: mocks.eventFindMany },
    tenant: { findFirst: mocks.tenantFindFirst },
    externalClubProviderMapping: {
      findMany: mocks.externalClubProviderMappingFindMany,
    },
  },
}));

function baseEvent(overrides: Partial<PublicEventItem> = {}): PublicEventItem {
  return {
    id: "event-1",
    title: "3. Liga — vs FC Köniz",
    description: null,
    location: "Sportanlage Moos",
    type: "MATCH",
    source: "SFV",
    status: "SCHEDULED",
    startAt: new Date("2026-10-15T14:00:00.000Z"),
    endAt: null,
    opponentName: "FC Köniz",
    organizerName: null,
    competitionLabel: "3. Liga",
    homeAway: "HOME",
    resultLabel: null,
    meetingTime: null,
    visibility: {
      website: true,
      infoboard: false,
      homepage: false,
      wochenplan: false,
      trainingsplan: false,
      teamPage: false,
    },
    remarks: null,
    pitchCode: null,
    homeDressingRoomCode: null,
    awayDressingRoomCode: null,
    season: { id: "s1", key: "2026-27", name: "Saison 2026/27", startDate: new Date(), endDate: new Date(), isActive: true },
    team: {
      id: "team-fca",
      name: "FC Allschwil 1. Mannschaft",
      slug: "aktive-1",
      category: "AKTIVE",
      genderGroup: null,
      ageGroup: null,
    },
    ...overrides,
  };
}

function awayOpponentPolicy(
  opponentName: string,
  providerClubId: number,
  logoUrl: string | null = null,
): CanonicalEventPolicyRow {
  return {
    id: "event-1",
    status: "SCHEDULED",
    infoboardVisible: true,
    websiteVisible: true,
    trainingsplanVisible: false,
    homeAway: "HOME",
    organizerName: null,
    competitionLabel: "3. Liga",
    meetingTime: null,
    resultLabel: null,
    intermediateResultLabel: null,
    season: { key: "2026-27" },
    team: {
      id: "team-fca",
      name: "FC Allschwil 1. Mannschaft",
      shortName: null,
      alternativeName: null,
      infoboardDisplayName: null,
      infoboardTrainingDisplayName: null,
      infoboardMatchDisplayName: null,
      infoboardTournamentDisplayName: null,
    },
    opponentExternalClub: null,
    matchExternalMapping: {
      homeTeam: {
        id: "team-fca",
        name: "FC Allschwil 1. Mannschaft",
        shortName: null,
        alternativeName: null,
        infoboardDisplayName: null,
        infoboardTrainingDisplayName: null,
        infoboardMatchDisplayName: null,
        infoboardTournamentDisplayName: null,
      },
      awayTeam: null,
      homeExternalTeam: null,
      awayExternalTeam: {
        name: opponentName,
        shortName: null,
        alternativeName: null,
        logoUrl,
        externalClub: {
          name: opponentName,
          shortName: null,
          logoUrl,
        },
        providerMappings: [{ providerClubId }],
      },
    },
  } as CanonicalEventPolicyRow;
}

describe("resolveMatchParticipantIdentity", () => {
  const canonicalIndex = buildCanonicalClubLogoIndex([
    { providerClubId: 100, externalClub: { logoUrl: OPPONENT_LOGO } },
    { providerClubId: 200, externalClub: { logoUrl: "https://cdn.example.com/klingnau.png" } },
    { providerClubId: 300, externalClub: { logoUrl: "https://cdn.example.com/kirchberg.png" } },
  ]);

  it("returns canonical home and away displayName", () => {
    const identity = resolveMatchParticipantIdentity(
      awayOpponentPolicy("FC Köniz", 100),
      { opponentName: "FC Köniz", ownTeamDisplayName: "FC Allschwil 1. Mannschaft" },
      TENANT_NAME,
      TENANT_LOGO,
      canonicalIndex,
    );

    expect(identity.home.displayName).toBe("FC Allschwil 1. Mannschaft");
    expect(identity.away.displayName).toBe("FC Köniz");
  });

  it("returns canonical home logoUrl for tenant team", () => {
    const identity = resolveMatchParticipantIdentity(
      awayOpponentPolicy("FC Köniz", 100),
      { opponentName: "FC Köniz", ownTeamDisplayName: "FC Allschwil 1. Mannschaft" },
      TENANT_NAME,
      TENANT_LOGO,
      canonicalIndex,
    );

    expect(identity.home.logoUrl).toBe(TENANT_LOGO);
    expect(identity.home.teamId).toBe("team-fca");
  });

  it("returns canonical away logoUrl from SCE provider identity", () => {
    const identity = resolveMatchParticipantIdentity(
      awayOpponentPolicy("FC Köniz", 100),
      { opponentName: "FC Köniz", ownTeamDisplayName: "FC Allschwil 1. Mannschaft" },
      TENANT_NAME,
      TENANT_LOGO,
      canonicalIndex,
    );

    expect(identity.away.logoUrl).toBe(OPPONENT_LOGO);
    expect(identity.away.teamId).toBeNull();
  });

  it("keeps external opponent external and tenant team tenant-owned", () => {
    const identity = resolveMatchParticipantIdentity(
      awayOpponentPolicy("FC Klingnau", 200),
      { opponentName: "FC Klingnau", ownTeamDisplayName: "FC Allschwil 1. Mannschaft" },
      TENANT_NAME,
      TENANT_LOGO,
      canonicalIndex,
    );

    expect(identity.home.teamId).toBe("team-fca");
    expect(identity.away.teamId).toBeNull();
    expect(identity.away.displayName).toBe("FC Klingnau");
  });

  it("returns null logoUrl when SCE has no canonical logo", () => {
    const identity = resolveMatchParticipantIdentity(
      awayOpponentPolicy("Unknown Club", 999, null),
      { opponentName: "Unknown Club", ownTeamDisplayName: "FC Allschwil 1. Mannschaft" },
      TENANT_NAME,
      TENANT_LOGO,
      canonicalIndex,
    );

    expect(identity.away.logoUrl).toBeNull();
  });

  it("does not invent logos for unknown opponents", () => {
    const identity = resolveMatchParticipantIdentity(
      awayOpponentPolicy("FC Kirchberg", 999, null),
      { opponentName: "FC Kirchberg", ownTeamDisplayName: "FC Allschwil 1. Mannschaft" },
      TENANT_NAME,
      TENANT_LOGO,
      new Map(),
    );

    expect(identity.away.logoUrl).toBeNull();
    expect(identity.away.displayName).toBe("FC Kirchberg");
  });

  it("distinguishes FC Köniz from FC Allschwil participant identity", () => {
    const koeniz = resolveMatchParticipantIdentity(
      awayOpponentPolicy("FC Köniz", 100),
      { opponentName: "FC Köniz", ownTeamDisplayName: "FC Allschwil 1. Mannschaft" },
      TENANT_NAME,
      TENANT_LOGO,
      canonicalIndex,
    );
    const klingnau = resolveMatchParticipantIdentity(
      awayOpponentPolicy("FC Klingnau", 200),
      { opponentName: "FC Klingnau", ownTeamDisplayName: "FC Allschwil 1. Mannschaft" },
      TENANT_NAME,
      TENANT_LOGO,
      canonicalIndex,
    );

    expect(koeniz.away.displayName).not.toBe(klingnau.away.displayName);
    expect(koeniz.home.displayName).toBe("FC Allschwil 1. Mannschaft");
    expect(klingnau.home.displayName).toBe("FC Allschwil 1. Mannschaft");
  });
});

describe("enrichPublicMatchesWithIdentity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tenantFindFirst.mockResolvedValue({ logoUrl: TENANT_LOGO });
    mocks.externalClubProviderMappingFindMany.mockResolvedValue([
      { providerClubId: 100, externalClub: { logoUrl: OPPONENT_LOGO } },
    ]);
  });

  it("returns matchIdentity on each match", async () => {
    mocks.eventFindMany.mockResolvedValue([awayOpponentPolicy("FC Köniz", 100)]);

    const enriched = await enrichPublicMatchesWithIdentity({
      tenantId: TENANT_ID,
      tenantName: TENANT_NAME,
      events: [baseEvent()],
    });

    expect(enriched).toHaveLength(1);
    expect(enriched[0].matchIdentity).toBeDefined();
    expect(enriched[0].matchIdentity.home.displayName).toBe("FC Allschwil 1. Mannschaft");
    expect(enriched[0].matchIdentity.away.displayName).toBe("FC Köniz");
    expect(enriched[0].matchIdentity.away.logoUrl).toBe(OPPONENT_LOGO);
  });

  it("preserves existing match fields unchanged", async () => {
    mocks.eventFindMany.mockResolvedValue([awayOpponentPolicy("SC Dornach", 150, "https://cdn.example.com/dornach.png")]);

    const enriched = await enrichPublicMatchesWithIdentity({
      tenantId: TENANT_ID,
      tenantName: TENANT_NAME,
      events: [baseEvent({
        opponentName: "SC Dornach",
        homeAway: "AWAY",
        status: "COMPLETED",
        resultLabel: "1:2",
      })],
    });

    expect(enriched[0].opponentName).toBe("SC Dornach");
    expect(enriched[0].homeAway).toBe("AWAY");
    expect(enriched[0].status).toBe("COMPLETED");
    expect(enriched[0].resultLabel).toBe("1:2");
  });

  it("resolves future October/November fixtures without weekplan dependency", async () => {
    mocks.eventFindMany.mockResolvedValue([
      awayOpponentPolicy("CD Español Basel", 400, "https://cdn.example.com/espanol.png"),
    ]);

    const enriched = await enrichPublicMatchesWithIdentity({
      tenantId: TENANT_ID,
      tenantName: TENANT_NAME,
      events: [baseEvent({
        id: "event-oct",
        opponentName: "CD Español Basel",
        startAt: new Date("2026-11-08T15:00:00.000Z"),
      })],
    });

    expect(enriched[0].matchIdentity.away.displayName).toBe("CD Español Basel");
    expect(enriched[0].startAt).toEqual(new Date("2026-11-08T15:00:00.000Z"));
  });

  it("batch-loads policies for multiple matches in one query", async () => {
    mocks.eventFindMany.mockResolvedValue([
      { ...awayOpponentPolicy("FC Köniz", 100), id: "event-1" },
      { ...awayOpponentPolicy("FC Klingnau", 200), id: "event-2" },
    ]);

    await enrichPublicMatchesWithIdentity({
      tenantId: TENANT_ID,
      tenantName: TENANT_NAME,
      events: [
        baseEvent({ id: "event-1", opponentName: "FC Köniz" }),
        baseEvent({ id: "event-2", opponentName: "FC Klingnau", startAt: new Date("2026-11-01T14:00:00.000Z") }),
      ],
    });

    expect(mocks.eventFindMany).toHaveBeenCalledTimes(1);
    expect(mocks.eventFindMany.mock.calls[0][0].where.id.in).toEqual(["event-1", "event-2"]);
    expect(mocks.eventFindMany.mock.calls[0][0].where.tenantId).toBe(TENANT_ID);
  });

  it("enforces tenant isolation in policy batch load", async () => {
    mocks.eventFindMany.mockResolvedValue([]);

    await loadMatchEventPoliciesByEventId("tenant-other", ["event-1"]);

    expect(mocks.eventFindMany.mock.calls[0][0].where.tenantId).toBe("tenant-other");
  });
});
