/**
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  resolveTeamDocumentAccess: vi.fn(),
  requireTeamCockpitAccess: vi.fn(),
  getOrgUnits: vi.fn(),
  getEligibleCompetitions: vi.fn(),
  getTeamTrainingSchedule: vi.fn(),
  getTeamCockpitSportingData: vi.fn(),
  getActiveTenant: vi.fn(),
  buildTeamCockpitMetrics: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}));
vi.mock("@/lib/teams/team-document-auth", () => ({
  resolveTeamDocumentAccess: mocks.resolveTeamDocumentAccess,
}));

vi.mock("@/lib/teams/team-cockpit-layout", () => ({
  requireTeamCockpitAccess: mocks.requireTeamCockpitAccess,
  TEAM_COCKPIT_CATEGORY_LABELS: { AKTIVE: "Aktive" },
  TEAM_COCKPIT_PARTICIPATION_TYPE_LABELS: { COMPETITION: "Wettkampfteam" },
}));
vi.mock("@/lib/teams/team-cockpit-metrics", () => ({
  buildTeamCockpitMetrics: mocks.buildTeamCockpitMetrics,
}));
vi.mock("@/lib/teams/team-cockpit-sporting-data", () => ({
  getTeamCockpitSportingData: mocks.getTeamCockpitSportingData,
}));
vi.mock("@/lib/teams/team-training-schedule", () => ({
  getTeamTrainingSchedule: mocks.getTeamTrainingSchedule,
}));
vi.mock("@/lib/org/queries", () => ({
  getOrgUnits: mocks.getOrgUnits,
}));
vi.mock("@/lib/competitions/queries", () => ({
  getEligibleCompetitions: mocks.getEligibleCompetitions,
}));
vi.mock("@/lib/tenants/active-tenant", () => ({
  getActiveTenant: mocks.getActiveTenant,
}));
vi.mock("@/components/admin/teams/overview/TeamCockpitOverviewContent", () => ({
  default: (props: Record<string, unknown>) => (
    <div
      data-testid="team-cockpit-overview-content"
      data-next-match={props.nextMatch ? "present" : "empty"}
      data-latest-result={props.latestResult ? "present" : "empty"}
      data-standings={props.standings ? "present" : "empty"}
      data-player-count={String(props.playerCount)}
      data-trainer-count={String(props.trainerCount)}
    />
  ),
}));

const TENANT_ID = "tenant-a";
const TEAM_ID = "team-1";

const TEAM_FIXTURE = {
  id: TEAM_ID,
  name: "FC Test",
  displayName: "FC Test",
  shortName: "Test",
  alternativeName: null,
  infoboardDisplayName: "FC Test IB",
  infoboardTrainingDisplayName: null,
  infoboardMatchDisplayName: null,
  infoboardTournamentDisplayName: null,
  slug: "fc-test",
  category: "AKTIVE",
  genderGroup: null,
  ageGroup: null,
  sortOrder: 0,
  isActive: true,
  websiteVisible: true,
  infoboardVisible: true,
  orgUnitId: "ou-legacy",
  orgUnit: { id: "ou-legacy", name: "Legacy OU", key: "legacy", type: "DIVISION" },
  currentTeamSeasonId: "ts-1",
  currentParticipationType: "COMPETITION",
  currentSeasonOrgUnit: { id: "ou-1", name: "Aktive", key: "aktive", type: "DIVISION" },
  competition: { id: "comp-1", name: "2. Liga", shortName: "2L", source: "CANONICAL_COMPETITION" },
  currentSeasonSfvMapping: {
    externalTeamId: 100,
    externalSeasonId: 2027,
    providerLeagueId: 55,
    providerLeagueName: "2. Liga interregional",
  },
  providerMapping: null,
  teamSeasons: [
    {
      id: "ts-1",
      displayName: "FC Test 2025/26",
      shortName: null,
      status: "ACTIVE",
      participationType: "COMPETITION",
      websiteVisible: true,
      infoboardVisible: true,
      squadWebsiteVisible: true,
      trainerTeamWebsiteVisible: true,
      season: {
        id: "season-1",
        key: "2025-2026",
        name: "Saison 2025/26",
        startDate: "2025-07-01T00:00:00.000Z",
        endDate: "2026-06-30T00:00:00.000Z",
        isActive: true,
      },
      playerSquadMembers: [],
      trainerTeamMembers: [],
    },
  ],
};

async function renderPage() {
  const { default: TeamOverviewPage } = await import("../page");
  return render(await TeamOverviewPage({ params: Promise.resolve({ teamId: TEAM_ID }) }));
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({
    user: { id: "user-manager" },
  });
  mocks.resolveTeamDocumentAccess.mockResolvedValue({
    userId: "user-manager",
    tenantId: TENANT_ID,
    tenantKey: "tenant-a",
    teamId: TEAM_ID,
    canViewDocuments: true,
    canManageDocuments: true,
  });
  mocks.requireTeamCockpitAccess.mockResolvedValue({
    tenantId: TENANT_ID,
    tenantKey: "tenant-a",
    tenant: {
      id: TENANT_ID,
      key: "tenant-a",
      name: "FC Test",
      logoUrl: "/tenant-crest.svg",
      locale: "de-CH",
      timezone: "Europe/Zurich",
    },
    team: TEAM_FIXTURE,
    canManage: true,
    canDelete: true,
  });
  mocks.getOrgUnits.mockResolvedValue([]);
  mocks.getEligibleCompetitions.mockResolvedValue([]);
  mocks.getTeamTrainingSchedule.mockResolvedValue([]);
  mocks.getActiveTenant.mockResolvedValue({
    locale: "de-CH",
    timezone: "Europe/Zurich",
  });
  mocks.buildTeamCockpitMetrics.mockReturnValue({
    playerCount: 12,
    trainerCount: 3,
  });
  mocks.getTeamCockpitSportingData.mockResolvedValue({
    competition: TEAM_FIXTURE.competition,
    nextMatches: [
      {
        eventId: "event-1",
        startAt: new Date("2026-09-01T18:00:00.000Z"),
        side: "HOME",
        opponentName: "Opponent",
        home: { displayName: "FC Test", isOwnTeam: true },
        away: { displayName: "Opponent", isOwnTeam: false },
        venueName: "Home",
        location: "Home",
      },
    ],
    results: [
      {
        eventId: "event-2",
        startAt: new Date("2026-08-01T18:00:00.000Z"),
        side: "AWAY",
        opponentName: "Opponent",
        home: { displayName: "Opponent", isOwnTeam: false },
        away: { displayName: "FC Test", isOwnTeam: true },
        venueName: "Away",
        location: "Away",
        scoreHome: 1,
        scoreAway: 2,
        teamScore: 2,
        opponentScore: 1,
        resultPerspective: "WON",
      },
    ],
    standings: {
      competition: { name: "2. Liga", shortName: "2L", source: "STANDINGS" },
      rows: [{ position: 3, isCurrentTeam: true, points: 18 }],
    },
  });
});

describe("TEAM-COCKPIT-PREMIUM-01E — Team overview page", () => {
  it("renders premium overview content via shared access helper", async () => {
    await renderPage();

    expect(mocks.requireTeamCockpitAccess).toHaveBeenCalledWith(TEAM_ID);
    expect(screen.getByTestId("team-cockpit-overview-content")).toBeInTheDocument();
  });

  it("loads sporting data with summary limits of 1", async () => {
    await renderPage();

    expect(mocks.getTeamCockpitSportingData).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT_ID,
        tenantClubName: "FC Test",
        tenantLogoUrl: "/tenant-crest.svg",
        teamId: TEAM_ID,
        teamSeasonId: "ts-1",
        limits: { nextMatches: 1, results: 1 },
      }),
    );
  });

  it("passes sporting snapshot summaries and team counts to overview content", async () => {
    await renderPage();

    const content = screen.getByTestId("team-cockpit-overview-content");
    expect(content).toHaveAttribute("data-next-match", "present");
    expect(content).toHaveAttribute("data-latest-result", "present");
    expect(content).toHaveAttribute("data-standings", "present");
    expect(content).toHaveAttribute("data-player-count", "12");
    expect(content).toHaveAttribute("data-trainer-count", "3");
  });

  it("loads training schedule for the canonical current team season", async () => {
    await renderPage();

    expect(mocks.getTeamTrainingSchedule).toHaveBeenCalledWith(TENANT_ID, "ts-1");
  });

  it("does not load sporting data or training when no canonical current season exists", async () => {
    mocks.requireTeamCockpitAccess.mockResolvedValue({
      tenantId: TENANT_ID,
      tenantKey: "tenant-a",
      team: { ...TEAM_FIXTURE, currentTeamSeasonId: null },
      canManage: true,
      canDelete: true,
    });

    await renderPage();

    expect(mocks.getTeamTrainingSchedule).not.toHaveBeenCalled();
    expect(mocks.getTeamCockpitSportingData).not.toHaveBeenCalled();
  });

  it("G. keeps competition context available when standings are unavailable", async () => {
    mocks.getTeamCockpitSportingData.mockResolvedValue({
      competition: {
        name: "2. Liga interregional",
        shortName: null,
        source: "PROVIDER_MAPPING",
      },
      nextMatches: [],
      results: [],
      standings: null,
    });

    await renderPage();

    expect(mocks.getTeamCockpitSportingData).toHaveBeenCalledWith(
      expect.objectContaining({
        sfvMapping: TEAM_FIXTURE.currentSeasonSfvMapping,
      }),
    );

    const content = screen.getByTestId("team-cockpit-overview-content");
    expect(content).toHaveAttribute("data-standings", "empty");
  });
});
