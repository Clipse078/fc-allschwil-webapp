/**
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAnyPermission: vi.fn(),
  hasPermission: vi.fn(),
  getTeamDetailData: vi.fn(),
  getOrgUnits: vi.fn(),
  getEligibleCompetitions: vi.fn(),
  getActiveTenant: vi.fn(),
  getScopedAssignmentsForOrgUnit: vi.fn(),
  getEligibleTenantMembers: vi.fn(),
  getTeamTrainingSchedule: vi.fn(),
  getTeamAttendanceOverview: vi.fn(),
  getUpcomingParticipationForTeam: vi.fn(),
  roleFindMany: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

vi.mock("@/lib/permissions/require-any-permission", () => ({
  requireAnyPermission: mocks.requireAnyPermission,
}));
vi.mock("@/lib/permissions/has-permission", () => ({
  hasPermission: mocks.hasPermission,
}));
vi.mock("@/lib/teams/queries", () => ({
  getTeamDetailData: mocks.getTeamDetailData,
}));
vi.mock("@/lib/teams/team-training-schedule", () => ({
  getTeamTrainingSchedule: mocks.getTeamTrainingSchedule,
}));
vi.mock("@/lib/attendance/queries", () => ({
  getTeamAttendanceOverview: mocks.getTeamAttendanceOverview,
}));
vi.mock("@/lib/participation/queries", () => ({
  getUpcomingParticipationForTeam: mocks.getUpcomingParticipationForTeam,
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
vi.mock("@/lib/roles/scoped-mutations", () => ({
  getScopedAssignmentsForOrgUnit: mocks.getScopedAssignmentsForOrgUnit,
}));
vi.mock("@/lib/roles/tenant-queries", () => ({
  getEligibleTenantMembers: mocks.getEligibleTenantMembers,
}));
vi.mock("@/lib/roles/tenant-role-keys", () => ({
  getTenantClubAdminRoleKey: vi.fn(() => "club_admin"),
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    role: {
      findMany: mocks.roleFindMany,
    },
  },
}));
vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
}));
vi.mock("@/components/admin/teams/TeamCockpitShell", () => ({
  default: () => <div data-testid="team-cockpit-shell">TeamCockpitShell</div>,
}));
vi.mock("@/components/admin/shared/ScopedResponsibilitiesCard", () => ({
  default: (props: { title?: string }) => (
    <div data-testid="scoped-responsibilities-card">{props.title}</div>
  ),
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
      playerSquadMembers: [
        {
          id: "psm-1",
          status: "ACTIVE",
          shirtNumber: 9,
          positionLabel: null,
          isCaptain: false,
          isViceCaptain: false,
          isWebsiteVisible: true,
          sortOrder: 0,
          remarks: null,
          person: {
            id: "person-1",
            firstName: "Max",
            lastName: "Muster",
            displayName: null,
            email: null,
            phone: null,
            dateOfBirth: null,
          },
        },
      ],
      trainerTeamMembers: [
        {
          id: "ttm-1",
          status: "ACTIVE",
          roleLabel: "Cheftrainer",
          isWebsiteVisible: true,
          sortOrder: 0,
          remarks: null,
          person: {
            id: "person-2",
            firstName: "Tom",
            lastName: "Trainer",
            displayName: null,
            email: null,
            phone: null,
          },
        },
      ],
    },
  ],
};

async function renderPage() {
  const { default: TeamDetailPage } = await import("../page");
  return render(await TeamDetailPage({ params: Promise.resolve({ teamId: TEAM_ID }) }));
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.requireAnyPermission.mockResolvedValue({ user: { id: "user-1" } });
  mocks.hasPermission.mockReturnValue(true);
  mocks.getActiveTenant.mockResolvedValue({ id: TENANT_ID, key: "tenant-a" });
  mocks.getTeamDetailData.mockResolvedValue(TEAM_FIXTURE);
  mocks.getOrgUnits.mockResolvedValue([]);
  mocks.getEligibleCompetitions.mockResolvedValue([]);
  mocks.getScopedAssignmentsForOrgUnit.mockResolvedValue([]);
  mocks.getEligibleTenantMembers.mockResolvedValue([]);
  mocks.getTeamTrainingSchedule.mockResolvedValue([]);
  mocks.getTeamAttendanceOverview.mockResolvedValue({
    teamSeasonId: "ts-1",
    players: [],
  });
  mocks.getUpcomingParticipationForTeam.mockResolvedValue(null);
  mocks.roleFindMany.mockResolvedValue([]);
});

describe("TEAM-COCKPIT-01D — Team detail page", () => {
  it("renders premium cockpit shell with team identity", async () => {
    await renderPage();

    expect(screen.getByRole("heading", { name: "FC Test" })).toBeInTheDocument();
    expect(screen.getByTestId("team-cockpit-shell")).toBeInTheDocument();
  });

  it("loads training schedule for the canonical current team season", async () => {
    await renderPage();

    expect(mocks.getTeamTrainingSchedule).toHaveBeenCalledWith(TENANT_ID, "ts-1");
    expect(mocks.getTeamAttendanceOverview).toHaveBeenCalledWith(TENANT_ID, "ts-1");
  });

  it("keeps responsibilities available as a distinct section", async () => {
    await renderPage();

    expect(screen.getByTestId("scoped-responsibilities-card")).toHaveTextContent("Zuständigkeiten");
  });

  it("does not render legacy duplicate Spielerkader/Trainerteam stub sections", async () => {
    await renderPage();

    expect(screen.queryByLabelText("Spielerkader")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Trainerteam")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Kader-Zuordnungen werden hier hinterlegt/),
    ).not.toBeInTheDocument();
  });

  it("scopes team lookup to the active tenant", async () => {
    await renderPage();

    expect(mocks.getTeamDetailData).toHaveBeenCalledWith(TENANT_ID, TEAM_ID);
  });

  it("returns notFound when the team is outside the tenant", async () => {
    mocks.getTeamDetailData.mockResolvedValue(null);

    await expect(renderPage()).rejects.toThrow("NOT_FOUND");
  });

  it("shows consistent season messaging when no canonical current season exists", async () => {
    mocks.getTeamDetailData.mockResolvedValue({
      ...TEAM_FIXTURE,
      currentTeamSeasonId: null,
      teamSeasons: TEAM_FIXTURE.teamSeasons,
    });

    await renderPage();

    expect(
      screen.getByText(/Keine Saison im aktuellen Geschäftsjahr/),
    ).toBeInTheDocument();
    expect(mocks.getTeamTrainingSchedule).not.toHaveBeenCalled();
    expect(mocks.getTeamAttendanceOverview).not.toHaveBeenCalled();
  });
});
