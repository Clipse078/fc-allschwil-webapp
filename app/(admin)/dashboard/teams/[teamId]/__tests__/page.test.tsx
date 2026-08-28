/**
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  requireTeamCockpitAccess: vi.fn(),
  getOrgUnits: vi.fn(),
  getEligibleCompetitions: vi.fn(),
  getTeamTrainingSchedule: vi.fn(),
  buildTeamCockpitMetrics: vi.fn(),
}));

vi.mock("@/lib/teams/team-cockpit-layout", () => ({
  requireTeamCockpitAccess: mocks.requireTeamCockpitAccess,
  buildTeamCockpitDisplayTitle: vi.fn(() => "FC Test"),
  TEAM_COCKPIT_CATEGORY_LABELS: { AKTIVE: "Aktive" },
  TEAM_COCKPIT_PARTICIPATION_TYPE_LABELS: { COMPETITION: "Wettkampfteam" },
}));
vi.mock("@/lib/teams/team-cockpit-metrics", () => ({
  buildTeamCockpitMetrics: mocks.buildTeamCockpitMetrics,
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
vi.mock("@/components/admin/teams/TeamCockpitShell", () => ({
  default: () => <div data-testid="team-cockpit-shell">TeamCockpitShell</div>,
}));

const TENANT_ID = "tenant-a";
const TEAM_ID = "team-1";

const TEAM_FIXTURE = {
  id: TEAM_ID,
  name: "FC Test",
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
  displayName: "FC Test",
  compactName: "Test",
  currentTeamSeasonId: "ts-1",
  currentParticipationType: "COMPETITION",
  currentSeasonOrgUnit: { id: "ou-1", name: "Aktive", key: "aktive", type: "DIVISION" },
  competition: { id: "comp-1", name: "2. Liga", shortName: "2L", source: "CANONICAL_COMPETITION" },
  currentSeasonSfvMapping: null,
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
  mocks.requireTeamCockpitAccess.mockResolvedValue({
    tenantId: TENANT_ID,
    tenantKey: "tenant-a",
    team: TEAM_FIXTURE,
    canManage: true,
    canDelete: true,
  });
  mocks.getOrgUnits.mockResolvedValue([]);
  mocks.getEligibleCompetitions.mockResolvedValue([]);
  mocks.getTeamTrainingSchedule.mockResolvedValue([]);
  mocks.buildTeamCockpitMetrics.mockReturnValue({ tiles: [] });
});

describe("TEAM-COCKPIT-PREMIUM-01D — Team overview page", () => {
  it("renders overview cockpit shell via shared access helper", async () => {
    await renderPage();

    expect(mocks.requireTeamCockpitAccess).toHaveBeenCalledWith(TEAM_ID);
    expect(screen.getByTestId("team-cockpit-shell")).toBeInTheDocument();
  });

  it("loads training schedule for the canonical current team season", async () => {
    await renderPage();

    expect(mocks.getTeamTrainingSchedule).toHaveBeenCalledWith(TENANT_ID, "ts-1");
  });

  it("does not load training when no canonical current season exists", async () => {
    mocks.requireTeamCockpitAccess.mockResolvedValue({
      tenantId: TENANT_ID,
      tenantKey: "tenant-a",
      team: { ...TEAM_FIXTURE, currentTeamSeasonId: null },
      canManage: true,
      canDelete: true,
    });

    await renderPage();

    expect(mocks.getTeamTrainingSchedule).not.toHaveBeenCalled();
  });
});
