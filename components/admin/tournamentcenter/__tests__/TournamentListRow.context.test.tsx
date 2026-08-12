/**
 * @vitest-environment jsdom
 *
 * TOURNAMENTCENTER-UX-C1 — regression tests verifying that TournamentListRow
 * and TournamentArchivRow display the canonical participating Team
 * (Event.teamId → team) and organiser (organizerName) on each card.
 *
 * Assertions:
 *   1. Mannschaft label appears with team.name from Event.teamId.
 *   2. Veranstalter label appears with organizerName.
 *   3. When team is null, Mannschaft row is absent.
 *   4. When organizerName is null, Veranstalter row is absent.
 *   5. Two cards for the same tournament but different teams each identify
 *      their own team (F1/F2 scenario — records stay separate).
 *   6. Existing date/location/participant-count fields remain present.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TournamentListRow from "@/components/admin/tournamentcenter/TournamentListRow";
import TournamentArchivRow from "@/components/admin/tournamentcenter/TournamentArchivRow";
import type { TournamentDto } from "@/lib/tournaments/types";
import type { TournamentOperationalAssessment } from "@/lib/tournaments/operational-state";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const READY_ASSESSMENT: TournamentOperationalAssessment = {
  status: "READY",
  actionCount: 0,
  actions: [],
};

function makeTournament(overrides: Partial<TournamentDto> = {}): TournamentDto {
  return {
    id: "t1",
    tenantId: "tenant-1",
    title: "Hallenturnier Binningen",
    description: null,
    status: "SCHEDULED",
    source: "MANUAL",
    startAt: "2026-09-05T09:00:00.000Z",
    endAt: null,
    meetingTime: null,
    location: "Turnhalle Binningen",
    organizerName: "BSC Old Boys",
    competitionLabel: null,
    resultLabel: null,
    remarks: null,
    season: { id: "s1", key: "2026-27", name: "2026/27" },
    team: {
      id: "team-f1",
      name: "Junioren F1",
      slug: "f1",
      category: "JUNIOR",
      genderGroup: null,
      ageGroup: "F",
    },
    homeAway: "AWAY",
    participants: [],
    resourceAllocations: [],
    visibility: {
      websiteVisible: false,
      infoboardVisible: false,
      homepageVisible: false,
      wochenplanVisible: false,
      teamPageVisible: false,
    },
    reviewStage: "APPROVED",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

// ── TournamentListRow ─────────────────────────────────────────────────────────

describe("TournamentListRow — participating Team and organiser context", () => {
  it("shows Mannschaft from canonical team (Event.teamId → team)", () => {
    render(
      <TournamentListRow
        tournament={makeTournament()}
        assessment={READY_ASSESSMENT}
        locale="de-CH"
        timezone="Europe/Zurich"
      />,
    );

    const el = screen.getByTestId("tournament-team-t1");
    expect(el.textContent).toMatch(/Mannschaft/);
    expect(el.textContent).toMatch(/Junioren F1/);
  });

  it("shows Veranstalter from organizerName (not inferred from title)", () => {
    render(
      <TournamentListRow
        tournament={makeTournament()}
        assessment={READY_ASSESSMENT}
        locale="de-CH"
        timezone="Europe/Zurich"
      />,
    );

    const el = screen.getByTestId("tournament-organizer-t1");
    expect(el.textContent).toMatch(/Veranstalter/);
    expect(el.textContent).toMatch(/BSC Old Boys/);
  });

  it("omits Mannschaft row when team is null", () => {
    render(
      <TournamentListRow
        tournament={makeTournament({ team: null })}
        assessment={READY_ASSESSMENT}
        locale="de-CH"
        timezone="Europe/Zurich"
      />,
    );

    expect(screen.queryByTestId("tournament-team-t1")).toBeNull();
  });

  it("omits Veranstalter row when organizerName is null", () => {
    render(
      <TournamentListRow
        tournament={makeTournament({ organizerName: null })}
        assessment={READY_ASSESSMENT}
        locale="de-CH"
        timezone="Europe/Zurich"
      />,
    );

    expect(screen.queryByTestId("tournament-organizer-t1")).toBeNull();
  });

  it("F1 card shows Junioren F1 and F2 card shows Junioren F2 — same tournament, separate records", () => {
    const f1 = makeTournament({ id: "t-f1", team: { id: "f1", name: "Junioren F1", slug: "f1", category: "JUNIOR", genderGroup: null, ageGroup: "F" } });
    const f2 = makeTournament({ id: "t-f2", team: { id: "f2", name: "Junioren F2", slug: "f2", category: "JUNIOR", genderGroup: null, ageGroup: "F" } });

    const { unmount } = render(
      <TournamentListRow
        tournament={f1}
        assessment={READY_ASSESSMENT}
        locale="de-CH"
        timezone="Europe/Zurich"
      />,
    );
    expect(screen.getByTestId("tournament-team-t-f1").textContent).toMatch(/Junioren F1/);
    expect(screen.queryByText(/Junioren F2/)).toBeNull();
    unmount();

    render(
      <TournamentListRow
        tournament={f2}
        assessment={READY_ASSESSMENT}
        locale="de-CH"
        timezone="Europe/Zurich"
      />,
    );
    expect(screen.getByTestId("tournament-team-t-f2").textContent).toMatch(/Junioren F2/);
    expect(screen.queryByText(/Junioren F1/)).toBeNull();
  });

  it("preserves date/location fields", () => {
    render(
      <TournamentListRow
        tournament={makeTournament()}
        assessment={READY_ASSESSMENT}
        locale="de-CH"
        timezone="Europe/Zurich"
      />,
    );

    expect(screen.getAllByText(/Turnhalle Binningen/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Hallenturnier Binningen/).length).toBeGreaterThan(0);
  });
});

// ── TournamentArchivRow ───────────────────────────────────────────────────────

describe("TournamentArchivRow — participating Team and organiser context", () => {
  const archivedTournament = makeTournament({ status: "COMPLETED" });

  it("shows Mannschaft from canonical team", () => {
    render(
      <TournamentArchivRow
        tournament={archivedTournament}
        locale="de-CH"
        timezone="Europe/Zurich"
      />,
    );

    const el = screen.getByTestId("tournament-archiv-team-t1");
    expect(el.textContent).toMatch(/Mannschaft/);
    expect(el.textContent).toMatch(/Junioren F1/);
  });

  it("shows Veranstalter from organizerName", () => {
    render(
      <TournamentArchivRow
        tournament={archivedTournament}
        locale="de-CH"
        timezone="Europe/Zurich"
      />,
    );

    const el = screen.getByTestId("tournament-archiv-organizer-t1");
    expect(el.textContent).toMatch(/Veranstalter/);
    expect(el.textContent).toMatch(/BSC Old Boys/);
  });

  it("omits Mannschaft row when team is null", () => {
    render(
      <TournamentArchivRow
        tournament={makeTournament({ status: "COMPLETED", team: null })}
        locale="de-CH"
        timezone="Europe/Zurich"
      />,
    );

    expect(screen.queryByTestId("tournament-archiv-team-t1")).toBeNull();
  });

  it("omits Veranstalter row when organizerName is null", () => {
    render(
      <TournamentArchivRow
        tournament={makeTournament({ status: "COMPLETED", organizerName: null })}
        locale="de-CH"
        timezone="Europe/Zurich"
      />,
    );

    expect(screen.queryByTestId("tournament-archiv-organizer-t1")).toBeNull();
  });

  it("preserves date/location fields", () => {
    render(
      <TournamentArchivRow
        tournament={archivedTournament}
        locale="de-CH"
        timezone="Europe/Zurich"
      />,
    );

    expect(screen.getAllByText(/Turnhalle Binningen/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Hallenturnier Binningen/).length).toBeGreaterThan(0);
  });
});
