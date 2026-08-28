/**
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), back: vi.fn(), push: vi.fn() }),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

import TeamSportingSnapshot from "../TeamSportingSnapshot";
import TeamTrainingSummary from "../TeamTrainingSummary";
import TeamCompositionSummary from "../TeamCompositionSummary";
import TeamCockpitOverviewContent from "../TeamCockpitOverviewContent";
import type {
  TeamCockpitMatch,
  TeamCockpitResult,
  TeamCockpitStandings,
} from "@/lib/teams/team-cockpit-sporting-data";

const TEAM_ID = "team-1";
const FORMAT_CONFIG = { locale: "de-CH", timezone: "Europe/Zurich" };

const NEXT_MATCH: TeamCockpitMatch = {
  eventId: "event-upcoming",
  startAt: new Date("2026-08-29T16:00:00.000Z"),
  side: "HOME",
  status: "SCHEDULED",
  lifecycle: "UPCOMING",
  opponentName: "FC Example",
  home: {
    displayName: "FC Allschwil",
    isOwnTeam: true,
    clubName: "FC Allschwil",
    logoUrl: "/tenant-crest.svg",
  },
  away: {
    displayName: "FC Example",
    isOwnTeam: false,
    clubName: "FC Example",
    logoUrl: "/example-crest.svg",
  },
  venueName: "Im Brüel",
  location: "Im Brüel",
  competitionName: "Junioren A Promotion",
};

const LATEST_RESULT: TeamCockpitResult = {
  ...NEXT_MATCH,
  eventId: "event-completed",
  startAt: new Date("2026-08-20T16:00:00.000Z"),
  side: "AWAY",
  scoreHome: 1,
  scoreAway: 2,
  teamScore: 2,
  opponentScore: 1,
  resultPerspective: "WON",
};

const STANDINGS: TeamCockpitStandings = {
  competition: {
    name: "Junioren A Promotion",
    shortName: "JA Promo",
    source: "STANDINGS",
  },
  rows: Array.from({ length: 12 }, (_, index) => ({
    position: index + 1,
    teamName: `Team ${index + 1}`,
    shortName: null,
    isCurrentTeam: index === 2,
    logoUrl: null,
    played: 10,
    won: 5,
    drawn: 2,
    lost: 3,
    goalsFor: 15,
    goalsAgainst: 10,
    goalDifference: 5,
    points: index === 2 ? 18 : 10,
    penaltyPoints: null,
  })),
};

const TEAM_FIXTURE = {
  id: TEAM_ID,
  name: "FC Allschwil Junioren A",
  shortName: "Junioren A",
  alternativeName: null,
  infoboardDisplayName: null,
  infoboardTrainingDisplayName: null,
  infoboardMatchDisplayName: null,
  infoboardTournamentDisplayName: null,
  slug: "junioren-a",
  category: "JUNIOREN",
  genderGroup: null,
  ageGroup: null,
  sortOrder: 0,
  isActive: true,
  websiteVisible: true,
  infoboardVisible: true,
  orgUnitId: "ou-1",
  competition: {
    id: "comp-1",
    name: "Junioren A Promotion",
    shortName: "JA Promo",
  },
  currentTeamSeasonId: "ts-1",
  currentParticipationType: "COMPETITION",
  currentSeasonOrgUnit: { id: "ou-1", name: "Junioren", key: "junioren", type: "DIVISION" },
};

describe("TEAM-COCKPIT-PREMIUM-01E — sporting snapshot", () => {
  it("A. renders next match summary with detail link", () => {
    const { container } = render(
      <TeamSportingSnapshot
        teamId={TEAM_ID}
        nextMatch={NEXT_MATCH}
        latestResult={null}
        standings={null}
        formatConfig={FORMAT_CONFIG}
      />,
    );

    expect(screen.getByTestId("team-next-match-summary")).toHaveAttribute(
      "href",
      `/dashboard/teams/${TEAM_ID}/spiele`,
    );
    expect(screen.getByText("FC Allschwil")).toBeInTheDocument();
    expect(screen.getByText("FC Example")).toBeInTheDocument();
    expect(screen.getByText("Im Brüel")).toBeInTheDocument();
    expect(
      Array.from(container.querySelectorAll("img")).map((image) => image.getAttribute("src")),
    ).toEqual(["/tenant-crest.svg", "/example-crest.svg"]);
  });

  it("B. renders next match empty state", () => {
    render(
      <TeamSportingSnapshot
        teamId={TEAM_ID}
        nextMatch={null}
        latestResult={null}
        standings={null}
        formatConfig={FORMAT_CONFIG}
      />,
    );

    expect(screen.getByTestId("team-next-match-empty")).toHaveTextContent(
      "Kein nächstes Spiel geplant.",
    );
  });

  it("C. renders latest result with score and perspective", () => {
    const { container } = render(
      <TeamSportingSnapshot
        teamId={TEAM_ID}
        nextMatch={null}
        latestResult={LATEST_RESULT}
        standings={null}
        formatConfig={FORMAT_CONFIG}
      />,
    );

    expect(screen.getByTestId("team-latest-result-summary")).toHaveAttribute(
      "href",
      `/dashboard/teams/${TEAM_ID}/resultate`,
    );
    expect(screen.getByTestId("team-latest-result-score")).toHaveTextContent("1 : 2");
    expect(screen.getByTestId("team-latest-result-perspective")).toHaveTextContent("Sieg");
    expect(
      Array.from(container.querySelectorAll("img")).map((image) => image.getAttribute("src")),
    ).toEqual(["/tenant-crest.svg", "/example-crest.svg"]);
  });

  it("C2. keeps the tenant crest with the own team when it is away", () => {
    const awayResult: TeamCockpitResult = {
      ...LATEST_RESULT,
      home: {
        displayName: "Host FC",
        isOwnTeam: false,
        clubName: "Host FC",
        logoUrl: "/host-crest.svg",
      },
      away: {
        displayName: "1. Mannschaft",
        isOwnTeam: true,
        clubName: "FC Allschwil",
        logoUrl: "/tenant-crest.svg",
      },
    };

    const { container } = render(
      <TeamSportingSnapshot
        teamId={TEAM_ID}
        nextMatch={null}
        latestResult={awayResult}
        standings={null}
        formatConfig={FORMAT_CONFIG}
      />,
    );

    expect(
      Array.from(container.querySelectorAll("img")).map((image) => image.getAttribute("src")),
    ).toEqual(["/host-crest.svg", "/tenant-crest.svg"]);
    expect(screen.getByTestId("team-latest-result-score")).toHaveTextContent("1 : 2");
  });

  it("C3. uses the shield fallback for a missing compact-summary logo", () => {
    const { container } = render(
      <TeamSportingSnapshot
        teamId={TEAM_ID}
        nextMatch={{ ...NEXT_MATCH, away: { ...NEXT_MATCH.away, logoUrl: null } }}
        latestResult={null}
        standings={null}
        formatConfig={FORMAT_CONFIG}
      />,
    );

    expect(container.querySelectorAll("img")).toHaveLength(1);
    expect(container.querySelectorAll("svg.lucide-shield")).toHaveLength(1);
  });

  it("D. renders result empty state", () => {
    render(
      <TeamSportingSnapshot
        teamId={TEAM_ID}
        nextMatch={null}
        latestResult={null}
        standings={null}
        formatConfig={FORMAT_CONFIG}
      />,
    );

    expect(screen.getByTestId("team-latest-result-empty")).toHaveTextContent(
      "Keine Resultate vorhanden.",
    );
  });

  it("E. renders standings summary with position and points", () => {
    render(
      <TeamSportingSnapshot
        teamId={TEAM_ID}
        nextMatch={null}
        latestResult={null}
        standings={STANDINGS}
        formatConfig={FORMAT_CONFIG}
      />,
    );

    expect(screen.getByTestId("team-standings-summary")).toHaveAttribute(
      "href",
      `/dashboard/teams/${TEAM_ID}/rangliste`,
    );
    expect(screen.getByText(/3\./)).toBeInTheDocument();
    expect(screen.getByText(/von 12 Teams/)).toBeInTheDocument();
    expect(screen.getByText("18 Punkte")).toBeInTheDocument();
    expect(screen.getByText("JA Promo")).toBeInTheDocument();
  });

  it("F. renders standings unavailable state", () => {
    render(
      <TeamSportingSnapshot
        teamId={TEAM_ID}
        nextMatch={null}
        latestResult={null}
        standings={null}
        formatConfig={FORMAT_CONFIG}
      />,
    );

    expect(screen.getByTestId("team-standings-empty")).toHaveTextContent(
      "Rangliste derzeit nicht verfügbar.",
    );
  });

  it("H. links sporting panels to detailed routes", () => {
    render(
      <TeamSportingSnapshot
        teamId={TEAM_ID}
        nextMatch={NEXT_MATCH}
        latestResult={LATEST_RESULT}
        standings={STANDINGS}
        formatConfig={FORMAT_CONFIG}
      />,
    );

    expect(screen.getByTestId("team-next-match-summary")).toHaveAttribute(
      "href",
      `/dashboard/teams/${TEAM_ID}/spiele`,
    );
    expect(screen.getByTestId("team-latest-result-summary")).toHaveAttribute(
      "href",
      `/dashboard/teams/${TEAM_ID}/resultate`,
    );
    expect(screen.getByTestId("team-standings-summary")).toHaveAttribute(
      "href",
      `/dashboard/teams/${TEAM_ID}/rangliste`,
    );
  });
});

describe("TEAM-COCKPIT-PREMIUM-01E — training summary", () => {
  it("I. renders canonical training schedule entries", () => {
    render(
      <TeamTrainingSummary
        entries={[
          {
            weekday: "MONDAY",
            weekdayLabel: "Montag",
            startsAt: "17:00",
            endsAt: "18:30",
            locationLabel: "Kunstrasen 2",
            seriesId: "series-1",
            seriesTitle: "Training",
          },
        ]}
      />,
    );

    expect(screen.getByTestId("team-training-summary")).toBeInTheDocument();
    expect(screen.getByText("Montag")).toBeInTheDocument();
    expect(screen.getByText(/17:00–18:30/)).toBeInTheDocument();
    expect(screen.getByText(/Kunstrasen 2/)).toBeInTheDocument();
    expect(screen.queryByText(/KUNSTRASEN_2/)).not.toBeInTheDocument();
  });

  it("J. renders empty training state", () => {
    render(<TeamTrainingSummary entries={[]} />);

    expect(screen.getByTestId("team-training-empty")).toHaveTextContent(
      "Keine Trainingszeiten für die aktuelle Saison hinterlegt.",
    );
  });
});

describe("TEAM-COCKPIT-PREMIUM-01E — team composition", () => {
  it("K. shows player count with kader link", () => {
    render(
      <TeamCompositionSummary teamId={TEAM_ID} playerCount={18} trainerCount={2} />,
    );

    expect(screen.getByTestId("team-spieler-count")).toHaveTextContent("18");
    expect(screen.getByLabelText("Spieler: 18 — Details öffnen")).toHaveAttribute(
      "href",
      `/dashboard/teams/${TEAM_ID}/kader`,
    );
  });

  it("L. shows trainer count with trainerteam link", () => {
    render(
      <TeamCompositionSummary teamId={TEAM_ID} playerCount={18} trainerCount={2} />,
    );

    expect(screen.getByTestId("team-trainer-count")).toHaveTextContent("2");
    expect(screen.getByLabelText("Trainer: 2 — Details öffnen")).toHaveAttribute(
      "href",
      `/dashboard/teams/${TEAM_ID}/trainerteam`,
    );
  });
});

describe("TEAM-COCKPIT-PREMIUM-01E — overview regression", () => {
  it("M. does not render full Kader section on root", () => {
    render(
      <TeamCockpitOverviewContent
        team={TEAM_FIXTURE}
        nextMatch={null}
        latestResult={null}
        standings={null}
        trainingSchedule={[]}
        playerCount={18}
        trainerCount={2}
        formatConfig={FORMAT_CONFIG}
        canManage={false}
        canManagePhoto={false}
        availableOrgUnits={[]}
        availableCompetitions={[]}
      />,
    );

    expect(screen.queryByText("Spielerkader")).not.toBeInTheDocument();
    expect(screen.queryByTestId("team-squad-management")).not.toBeInTheDocument();
  });

  it("N. does not render full Trainerteam section on root", () => {
    render(
      <TeamCockpitOverviewContent
        team={TEAM_FIXTURE}
        nextMatch={null}
        latestResult={null}
        standings={null}
        trainingSchedule={[]}
        playerCount={18}
        trainerCount={2}
        formatConfig={FORMAT_CONFIG}
        canManage={false}
        canManagePhoto={false}
        availableOrgUnits={[]}
        availableCompetitions={[]}
      />,
    );

    expect(screen.queryByTestId("team-trainer-management")).not.toBeInTheDocument();
  });

  it("O. does not render full Administration section on root", () => {
    render(
      <TeamCockpitOverviewContent
        team={TEAM_FIXTURE}
        nextMatch={null}
        latestResult={null}
        standings={null}
        trainingSchedule={[]}
        playerCount={18}
        trainerCount={2}
        formatConfig={FORMAT_CONFIG}
        canManage={true}
        canManagePhoto={true}
        availableOrgUnits={[]}
        availableCompetitions={[]}
      />,
    );

    expect(screen.queryByTestId("team-administration-section")).not.toBeInTheDocument();
    expect(screen.queryByText("Zuständigkeiten")).not.toBeInTheDocument();
  });

  it("P. preserves attendance and participation access links", () => {
    render(
      <TeamCockpitOverviewContent
        team={TEAM_FIXTURE}
        nextMatch={null}
        latestResult={null}
        standings={null}
        trainingSchedule={[]}
        playerCount={18}
        trainerCount={2}
        formatConfig={FORMAT_CONFIG}
        canManage={false}
        canManagePhoto={false}
        availableOrgUnits={[]}
        availableCompetitions={[]}
      />,
    );

    expect(screen.getByTestId("team-overview-link-anwesenheit")).toHaveAttribute(
      "href",
      `/dashboard/teams/${TEAM_ID}/anwesenheit`,
    );
    expect(screen.getByTestId("team-overview-link-teilnahmen")).toHaveAttribute(
      "href",
      `/dashboard/teams/${TEAM_ID}/teilnahmen`,
    );
  });
});
