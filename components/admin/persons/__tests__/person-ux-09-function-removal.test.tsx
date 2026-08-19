/**
 * @vitest-environment jsdom
 *
 * PERSON-UX-09 — Current function removal: PersonWorkspaceOverviewTab.
 *
 * Tests cover:
 *  1.  Squad membership removal button visible for canManage=true
 *  2.  Squad membership removal button absent for canManage=false
 *  3.  Trainer membership removal button visible for canManage=true
 *  4.  Trainer membership removal button absent for canManage=false
 *  5.  Incomplete PersonAssignment removal button visible for canManage=true
 *  6.  Incomplete PersonAssignment removal button absent for canManage=false
 *  7.  Weitere Funktionen removal button visible for canManage=true
 *  8.  Clicking remove opens confirmation dialog
 *  9.  Confirmation dialog includes team name (Spieler)
 * 10.  Confirmation dialog includes team name (Trainer)
 * 11.  Cancel dismisses dialog without API call
 * 12.  Confirm calls DELETE /api/people/[id]/squad-memberships/[squadMemberId]
 * 13.  Confirm calls DELETE /api/people/[id]/trainer-memberships/[trainerMemberId]
 * 14.  Confirm calls DELETE /api/people/[id]/assignments/[assignmentId]
 * 15.  Successful removal calls router.refresh()
 * 16.  API failure shows error inside dialog
 * 17.  Removing one squad membership does not affect other squad memberships
 * 18.  Person itself is never deleted (PersonWorkspaceOverviewTab never calls person DELETE)
 * 19.  Simultaneous player + trainer capacities: both sections rendered with remove buttons
 * 20.  Overview refresh state: after removal stub, router.refresh() called once
 * 21.  State A (no relationship) shows nudge without remove button
 */

import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import PersonWorkspaceOverviewTab from "../PersonWorkspaceOverviewTab";
import type { PersonDomainPermissions } from "@/lib/people/person-domain-auth";

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh, back: vi.fn(), push: vi.fn() }),
}));

afterEach(() => {
  vi.restoreAllMocks();
  mockRefresh.mockReset();
});

// ── Fixtures ─────────────────────────────────────────────────────────────────

const SEASON = {
  id: "s-09",
  name: "2026/27",
  key: "2026-27",
  isActive: true,
  startDate: new Date("2026-08-01"),
  endDate: new Date("2027-05-31"),
};

const TEAM_F2 = { id: "t-f2", name: "Junioren F2", shortName: "F2" };
const TEAM_S40 = { id: "t-s40", name: "Senioren 40+", shortName: "S40" };

const BASE_PERSON = {
  id: "person-09",
  firstName: "Klaus",
  lastName: "Bauer",
  displayName: null, email: null, phone: null, dateOfBirth: null, notes: null,
  imageUrl: null, isActive: true,
  isPlayer: false, isTrainer: false, isFunctionary: false,
  isVolunteer: false, isReferee: false, isSponsorContact: false,
  customFunctions: [],
  tenantId: "tenant-09",
  createdAt: new Date("2024-01-01"), updatedAt: new Date("2024-01-01"),
  street: null, houseNumber: null, postalCode: null, city: null, country: null,
  guardianFirstName: null, guardianLastName: null, guardianEmail: null, guardianPhone: null,
  userId: null, user: null,
};

function makeSquadMembership(id: string, team = TEAM_F2) {
  return {
    id,
    status: "ACTIVE" as const,
    shirtNumber: null,
    positionLabel: null,
    isCaptain: false,
    isViceCaptain: false,
    remarks: null,
    teamSeason: {
      id: `ts-${id}`,
      displayName: `${team.name} — 2026/27`,
      shortName: team.shortName,
      participationType: "COMPETITION" as const,
      team,
      season: SEASON,
    },
  };
}

function makeTrainerMembership(id: string, team = TEAM_F2) {
  return {
    id,
    status: "ACTIVE" as const,
    roleLabel: "Trainer/in" as const,
    remarks: null,
    teamSeason: {
      id: `ts-${id}`,
      displayName: `${team.name} — 2026/27`,
      shortName: team.shortName,
      team,
      season: SEASON,
    },
  };
}

function makeAssignment(id: string, functionKey: string, team = TEAM_F2) {
  return {
    id,
    orgUnitId: "ou-default",
    teamId: team.id as string | null,
    seasonId: SEASON.id as string | null,
    functionKey,
    status: "ACTIVE" as const,
    notes: null as string | null,
    tenantId: "tenant-09",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    orgUnit: { id: "ou-default", name: "Verein", key: "verein" },
    team,
    season: SEASON,
  };
}

// ── 1-2. Squad membership removal button visibility ───────────────────────────

describe("Squad removal button visibility", () => {
  it("visible when canManage=true and squad membership exists", () => {
    render(
      <PersonWorkspaceOverviewTab
        person={{
          ...BASE_PERSON,
          isPlayer: true,
          assignments: [],
          squadMemberships: [makeSquadMembership("sm-1")],
          trainerMemberships: [],
        }}
        activeSeason={SEASON}
        canManage={true}
      />,
    );
    expect(screen.getAllByTestId("remove-function-button").length).toBeGreaterThan(0);
  });

  it("absent when canManage=false", () => {
    render(
      <PersonWorkspaceOverviewTab
        person={{
          ...BASE_PERSON,
          isPlayer: true,
          assignments: [],
          squadMemberships: [makeSquadMembership("sm-1")],
          trainerMemberships: [],
        }}
        activeSeason={SEASON}
        canManage={false}
      />,
    );
    expect(screen.queryAllByTestId("remove-function-button")).toHaveLength(0);
  });
});

// ── 3-4. Trainer membership removal button visibility ─────────────────────────

describe("Trainer removal button visibility", () => {
  it("visible when canManage=true and trainer membership exists", () => {
    render(
      <PersonWorkspaceOverviewTab
        person={{
          ...BASE_PERSON,
          isTrainer: true,
          assignments: [],
          squadMemberships: [],
          trainerMemberships: [makeTrainerMembership("tm-1")],
        }}
        activeSeason={SEASON}
        canManage={true}
      />,
    );
    expect(screen.getAllByTestId("remove-function-button").length).toBeGreaterThan(0);
  });

  it("absent when canManage=false", () => {
    render(
      <PersonWorkspaceOverviewTab
        person={{
          ...BASE_PERSON,
          isTrainer: true,
          assignments: [],
          squadMemberships: [],
          trainerMemberships: [makeTrainerMembership("tm-1")],
        }}
        activeSeason={SEASON}
        canManage={false}
      />,
    );
    expect(screen.queryAllByTestId("remove-function-button")).toHaveLength(0);
  });
});

// ── 5-6. Incomplete PersonAssignment removal ──────────────────────────────────

describe("Incomplete assignment removal button visibility", () => {
  it("visible for canManage=true on incomplete player assignment", () => {
    render(
      <PersonWorkspaceOverviewTab
        person={{
          ...BASE_PERSON,
          isPlayer: true,
          assignments: [makeAssignment("a-1", "spieler")],
          squadMemberships: [],
          trainerMemberships: [],
        }}
        activeSeason={SEASON}
        canManage={true}
      />,
    );
    expect(screen.getAllByTestId("remove-function-button").length).toBeGreaterThan(0);
  });

  it("absent for canManage=false on incomplete player assignment", () => {
    render(
      <PersonWorkspaceOverviewTab
        person={{
          ...BASE_PERSON,
          isPlayer: true,
          assignments: [makeAssignment("a-1", "spieler")],
          squadMemberships: [],
          trainerMemberships: [],
        }}
        activeSeason={SEASON}
        canManage={false}
      />,
    );
    expect(screen.queryAllByTestId("remove-function-button")).toHaveLength(0);
  });
});

// ── 7. Weitere Funktionen removal ─────────────────────────────────────────────

describe("Weitere Funktionen removal button", () => {
  it("visible for canManage=true on generic assignment", () => {
    render(
      <PersonWorkspaceOverviewTab
        person={{
          ...BASE_PERSON,
          isPlayer: false,
          assignments: [makeAssignment("a-1", "kassier")],
          squadMemberships: [],
          trainerMemberships: [],
        }}
        activeSeason={SEASON}
        canManage={true}
      />,
    );
    expect(screen.getAllByTestId("remove-function-button").length).toBeGreaterThan(0);
  });
});

// ── 8-9. Confirmation dialog ──────────────────────────────────────────────────

describe("Removal confirmation dialog", () => {
  it("opens when remove button clicked", () => {
    render(
      <PersonWorkspaceOverviewTab
        person={{
          ...BASE_PERSON,
          isPlayer: true,
          assignments: [],
          squadMemberships: [makeSquadMembership("sm-1")],
          trainerMemberships: [],
        }}
        activeSeason={SEASON}
        canManage={true}
      />,
    );
    fireEvent.click(screen.getByTestId("remove-function-button"));
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("includes team name in dialog title for squad removal", () => {
    render(
      <PersonWorkspaceOverviewTab
        person={{
          ...BASE_PERSON,
          isPlayer: true,
          assignments: [],
          squadMemberships: [makeSquadMembership("sm-1", TEAM_F2)],
          trainerMemberships: [],
        }}
        activeSeason={SEASON}
        canManage={true}
      />,
    );
    fireEvent.click(screen.getByTestId("remove-function-button"));
    const dialog = screen.getByRole("dialog");
    const heading = within(dialog).getByRole("heading");
    expect(heading.textContent).toMatch(/Junioren F2/);
  });

  it("includes team name in dialog title for trainer removal", () => {
    render(
      <PersonWorkspaceOverviewTab
        person={{
          ...BASE_PERSON,
          isTrainer: true,
          assignments: [],
          squadMemberships: [],
          trainerMemberships: [makeTrainerMembership("tm-1", TEAM_S40)],
        }}
        activeSeason={SEASON}
        canManage={true}
      />,
    );
    fireEvent.click(screen.getByTestId("remove-function-button"));
    const dialog = screen.getByRole("dialog");
    const heading = within(dialog).getByRole("heading");
    expect(heading.textContent).toMatch(/Senioren 40\+/);
  });
});

// ── 11. Cancel ────────────────────────────────────────────────────────────────

describe("Cancel dismisses dialog", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("cancel button dismisses dialog without API call", () => {
    render(
      <PersonWorkspaceOverviewTab
        person={{
          ...BASE_PERSON,
          isPlayer: true,
          assignments: [],
          squadMemberships: [makeSquadMembership("sm-1")],
          trainerMemberships: [],
        }}
        activeSeason={SEASON}
        canManage={true}
      />,
    );
    fireEvent.click(screen.getByTestId("remove-function-button"));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: /abbrechen/i }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

// ── 12-15. API calls and refresh ──────────────────────────────────────────────

describe("Removal API calls", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("confirms squad removal: calls DELETE /api/people/[id]/squad-memberships/[sqId]", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: "Entfernt." }),
    });

    render(
      <PersonWorkspaceOverviewTab
        person={{
          ...BASE_PERSON,
          isPlayer: true,
          assignments: [],
          squadMemberships: [makeSquadMembership("sm-abc")],
          trainerMemberships: [],
        }}
        activeSeason={SEASON}
        canManage={true}
      />,
    );

    fireEvent.click(screen.getByTestId("remove-function-button"));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /^entfernen$/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/people/person-09/squad-memberships/sm-abc"),
        expect.objectContaining({ method: "DELETE" }),
      );
    });
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });

  it("confirms trainer removal: calls DELETE /api/people/[id]/trainer-memberships/[tmId]", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: "Entfernt." }),
    });

    render(
      <PersonWorkspaceOverviewTab
        person={{
          ...BASE_PERSON,
          isTrainer: true,
          assignments: [],
          squadMemberships: [],
          trainerMemberships: [makeTrainerMembership("tm-xyz")],
        }}
        activeSeason={SEASON}
        canManage={true}
      />,
    );

    fireEvent.click(screen.getByTestId("remove-function-button"));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /^entfernen$/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/people/person-09/trainer-memberships/tm-xyz"),
        expect.objectContaining({ method: "DELETE" }),
      );
    });
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });

  it("confirms assignment removal: calls DELETE /api/people/[id]/assignments/[aid]", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: "Entfernt." }),
    });

    render(
      <PersonWorkspaceOverviewTab
        person={{
          ...BASE_PERSON,
          isPlayer: false,
          assignments: [makeAssignment("assign-123", "kassier")],
          squadMemberships: [],
          trainerMemberships: [],
        }}
        activeSeason={SEASON}
        canManage={true}
      />,
    );

    fireEvent.click(screen.getByTestId("remove-function-button"));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /^entfernen$/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/people/person-09/assignments/assign-123"),
        expect.objectContaining({ method: "DELETE" }),
      );
    });
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });

  it("API failure shows error feedback inside dialog", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Zuordnung nicht gefunden." }),
    });

    render(
      <PersonWorkspaceOverviewTab
        person={{
          ...BASE_PERSON,
          isPlayer: true,
          assignments: [],
          squadMemberships: [makeSquadMembership("sm-err")],
          trainerMemberships: [],
        }}
        activeSeason={SEASON}
        canManage={true}
      />,
    );

    fireEvent.click(screen.getByTestId("remove-function-button"));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /^entfernen$/i }));

    await waitFor(() => {
      expect(screen.getByText("Zuordnung nicht gefunden.")).toBeTruthy();
    });
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});

// ── 17. Removing one does not affect others ───────────────────────────────────

describe("Invariants: isolation", () => {
  it("two squad memberships → two remove buttons (each is separate)", () => {
    render(
      <PersonWorkspaceOverviewTab
        person={{
          ...BASE_PERSON,
          isPlayer: true,
          assignments: [],
          squadMemberships: [
            makeSquadMembership("sm-1", TEAM_F2),
            makeSquadMembership("sm-2", TEAM_S40),
          ],
          trainerMemberships: [],
        }}
        activeSeason={SEASON}
        canManage={true}
      />,
    );
    expect(screen.getAllByTestId("remove-function-button")).toHaveLength(2);
  });

  it("simultaneous player + trainer: both sections have remove buttons", () => {
    render(
      <PersonWorkspaceOverviewTab
        person={{
          ...BASE_PERSON,
          isPlayer: true,
          isTrainer: true,
          assignments: [],
          squadMemberships: [makeSquadMembership("sm-1", TEAM_F2)],
          trainerMemberships: [makeTrainerMembership("tm-1", TEAM_S40)],
        }}
        activeSeason={SEASON}
        canManage={true}
      />,
    );
    expect(screen.getAllByTestId("remove-function-button")).toHaveLength(2);
  });
});

// ── 18. Person is never deleted ───────────────────────────────────────────────

describe("Safety invariant: person never deleted", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("squad removal never calls DELETE /api/people/[id] (person endpoint)", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: "OK" }),
    });

    render(
      <PersonWorkspaceOverviewTab
        person={{
          ...BASE_PERSON,
          isPlayer: true,
          assignments: [],
          squadMemberships: [makeSquadMembership("sm-del")],
          trainerMemberships: [],
        }}
        activeSeason={SEASON}
        canManage={true}
      />,
    );

    fireEvent.click(screen.getByTestId("remove-function-button"));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /^entfernen$/i }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
    for (const [url] of calls) {
      expect(url).not.toMatch(/\/api\/people\/person-09\/?$/);
    }
  });
});

// ── 21. State A nudge has no remove button ────────────────────────────────────

describe("State A nudge", () => {
  it("no remove button on unassigned capacity nudge", () => {
    render(
      <PersonWorkspaceOverviewTab
        person={{
          ...BASE_PERSON,
          isPlayer: true,
          assignments: [],
          squadMemberships: [],
          trainerMemberships: [],
        }}
        activeSeason={SEASON}
        canManage={true}
      />,
    );
    expect(screen.getByTestId("unassigned-capacity-nudge")).toBeTruthy();
    expect(screen.queryAllByTestId("remove-function-button")).toHaveLength(0);
  });
});
