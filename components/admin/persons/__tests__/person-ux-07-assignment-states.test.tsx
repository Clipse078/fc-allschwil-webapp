/**
 * @vitest-environment jsdom
 *
 * PERSON-UX-07 UX-ACCEPTANCE-POLISH — Assignment State Semantics Tests
 *
 * Verifies the three-state model for Player/Trainer assignment display:
 *
 *   A. NO RELATIONSHIP
 *      No PersonAssignment with player/trainer function AND no canonical membership.
 *      Must render "Noch keinem Team als …/in zugeordnet".
 *      Must NOT render "Zuordnung unvollständig".
 *
 *   B. RELATIONSHIP EXISTS BUT INCOMPLETE
 *      PersonAssignment with player/trainer functionKey exists for a specific team,
 *      but no canonical PlayerSquadMember / TrainerTeamMember exists.
 *      Must render "Zuordnung unvollständig" + affected team name.
 *      Must NOT render "Noch keinem Team als …/in zugeordnet".
 *
 *   C. COMPLETE CURRENT-SEASON RELATIONSHIP
 *      Canonical squad/trainer membership exists (active status).
 *      Normal assignment card shown.
 *
 * Test matrix:
 *  1.  Player profile, no relationship (State A)
 *  2.  Trainer profile, no relationship (State A)
 *  3.  Player relationship exists, no squad membership (State B)
 *  4.  Trainer relationship exists, no trainer membership (State B)
 *  5.  Complete player membership (State C)
 *  6.  Complete trainer membership (State C)
 *  7.  Simultaneous Player+Trainer: player complete, trainer incomplete
 *  8.  Simultaneous Player+Trainer: player incomplete, trainer complete
 *  9.  Multi-team Trainer: complete + complete
 * 10.  Multi-team Trainer: complete + incomplete
 * 11.  Multi-team Trainer: incomplete + incomplete
 * 12.  Incomplete state names correct team
 * 13.  Incomplete state never renders "noch keinem Team" when relationship exists
 * 14.  True no-relationship state renders "noch keinem Team" message
 * 15.  Zero-capacity Person regression (no capacity, no nudge)
 * 16.  CTA for State A (Spieler): Zur Organisation callback
 * 17.  CTA for State A (Trainer): Zur Organisation callback
 * 18.  CTA for State B (Spieler): team link present
 * 19.  CTA for State B (Trainer): team link present
 * 20.  Weitere Funktionen — incomplete trainer assignment NOT duplicated there
 * 21.  Weitere Funktionen — non-trainer assignment still shown
 * 22.  Overview State B — names the team, shows "Zuordnung unvollständig"
 * 23.  Overview State A — shows nudge "Spielerprofil vorhanden"
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import type { PlayerSquadStatus, TrainerTeamStatus } from "@prisma/client";
import PersonWorkspaceOverviewTab from "../PersonWorkspaceOverviewTab";
import PersonSpielerTab from "../PersonSpielerTab";
import PersonTrainerTab from "../PersonTrainerTab";
import type { PersonAssignment } from "@/lib/people/queries";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), back: vi.fn(), push: vi.fn() }),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SEASON_ACTIVE = {
  id: "s-2627",
  name: "2026/27",
  key: "2026-27",
  isActive: true,
  startDate: new Date("2026-08-01"),
  endDate: new Date("2027-05-31"),
};

const TEAM_F2 = { id: "t-f2", name: "FC Allschwil Junioren F2", shortName: "F2" };
const TEAM_E3 = { id: "t-e3", name: "FC Allschwil Junioren E3", shortName: "E3" };
const TEAM_B1 = { id: "t-b1", name: "FC Allschwil B1", shortName: "B1" };

type PersonFixture = {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  dateOfBirth: Date | null;
  notes: string | null;
  imageUrl: string | null;
  isActive: boolean;
  isPlayer: boolean;
  isTrainer: boolean;
  isFunctionary: boolean;
  isVolunteer: boolean;
  isReferee: boolean;
  isSponsorContact: boolean;
  customFunctions: string[];
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
  street: string | null;
  houseNumber: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  guardianFirstName: string | null;
  guardianLastName: string | null;
  guardianEmail: string | null;
  guardianPhone: string | null;
  userId: string | null;
  user: { id: string; email: string; isActive: boolean } | null;
};

const BASE: PersonFixture = {
  id: "person-state-test",
  firstName: "Michael",
  lastName: "Duijster",
  displayName: null,
  email: "m@example.test",
  phone: null,
  dateOfBirth: null,
  notes: null,
  imageUrl: null,
  isActive: true,
  isPlayer: false,
  isTrainer: false,
  isFunctionary: false,
  isVolunteer: false,
  isReferee: false,
  isSponsorContact: false,
  customFunctions: [],
  tenantId: "tenant-test",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2025-01-01"),
  street: null,
  houseNumber: null,
  postalCode: null,
  city: null,
  country: null,
  guardianFirstName: null,
  guardianLastName: null,
  guardianEmail: null,
  guardianPhone: null,
  userId: null,
  user: null,
};

function makePerson(overrides: Partial<PersonFixture> = {}): PersonFixture {
  return { ...BASE, ...overrides };
}

function makeSquad(teamOverride = TEAM_F2, seasonOverride = SEASON_ACTIVE) {
  return {
    id: `sq-${teamOverride.id}`,
    status: "ACTIVE" as PlayerSquadStatus,
    shirtNumber: null,
    positionLabel: null,
    isCaptain: false,
    isViceCaptain: false,
    remarks: null,
    teamSeason: {
      id: `ts-${teamOverride.id}`,
      displayName: `${teamOverride.name} ${seasonOverride.name}`,
      shortName: teamOverride.shortName,
      participationType: "COMPETITION" as const,
      team: teamOverride,
      season: seasonOverride,
    },
  };
}

function makeTrainer(teamOverride = TEAM_E3, seasonOverride = SEASON_ACTIVE, roleLabel = "Trainer/in") {
  return {
    id: `tr-${teamOverride.id}`,
    status: "ACTIVE" as TrainerTeamStatus,
    roleLabel,
    remarks: null,
    teamSeason: {
      id: `ts-tr-${teamOverride.id}`,
      displayName: `${teamOverride.name} ${seasonOverride.name}`,
      shortName: teamOverride.shortName,
      team: teamOverride,
      season: seasonOverride,
    },
  };
}

/** PersonAssignment with SPIELER functionKey for a team — represents generic player relationship */
function makePlayerAssignment(teamOverride = TEAM_F2): PersonAssignment {
  return {
    id: `a-player-${teamOverride.id}`,
    orgUnitId: null,
    teamId: teamOverride.id,
    seasonId: null,
    functionKey: "SPIELER",
    status: "ACTIVE",
    notes: null,
    orgUnit: null,
    team: teamOverride,
    season: null,
  } as unknown as PersonAssignment;
}

/** PersonAssignment with TRAINER functionKey for a team — represents generic trainer relationship */
function makeTrainerAssignment(teamOverride = TEAM_F2, seasonId: string | null = null): PersonAssignment {
  return {
    id: `a-trainer-${teamOverride.id}`,
    orgUnitId: null,
    teamId: teamOverride.id,
    seasonId,
    functionKey: "TRAINER",
    status: "ACTIVE",
    notes: null,
    orgUnit: null,
    team: teamOverride,
    season: seasonId ? { id: seasonId, name: "2026/27", key: "2026-27" } : null,
  } as unknown as PersonAssignment;
}

function makeOtherAssignment(id = "a-board"): PersonAssignment {
  return {
    id,
    orgUnitId: "ou-1",
    teamId: null,
    seasonId: null,
    functionKey: "VORSTANDSMITGLIED",
    status: "ACTIVE",
    notes: null,
    orgUnit: { id: "ou-1", name: "Vereinsleitung", key: "vereinsleitung" },
    team: null,
    season: null,
  } as unknown as PersonAssignment;
}

function renderOverview(opts: {
  person?: Partial<PersonFixture>;
  squads?: ReturnType<typeof makeSquad>[];
  trainers?: ReturnType<typeof makeTrainer>[];
  assignments?: PersonAssignment[];
  onNavigate?: (tab: "spieler" | "trainer" | "organisation") => void;
} = {}) {
  const person = makePerson(opts.person ?? {});
  render(
    <PersonWorkspaceOverviewTab
      person={{
        ...person,
        assignments: opts.assignments ?? [],
        squadMemberships: opts.squads ?? [],
        trainerMemberships: opts.trainers ?? [],
      }}
      activeSeason={SEASON_ACTIVE}
      onNavigateToTab={opts.onNavigate}
    />,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1 + 2. State A: profile only, no relationship at all
// ─────────────────────────────────────────────────────────────────────────────

describe("1. State A — player profile, no relationship", () => {
  it("overview shows 'Spielerprofil vorhanden' nudge when no squads and no player assignments", () => {
    renderOverview({ person: { isPlayer: true }, squads: [], assignments: [] });
    expect(document.body.textContent).toContain("Spielerprofil vorhanden");
    expect(document.body.textContent).toContain("noch keinem Team für die aktuelle Saison zugeordnet");
  });

  it("Spieler tab shows 'Noch keinem Team als Spieler/in zugeordnet' when no squads and no assignments", () => {
    render(<PersonSpielerTab squadMemberships={[]} assignments={[]} />);
    expect(document.body.textContent).toContain("Noch keinem Team als Spieler/in zugeordnet");
  });

  it("State A overview does NOT show 'Zuordnung unvollständig'", () => {
    renderOverview({ person: { isPlayer: true }, squads: [], assignments: [] });
    expect(document.body.textContent).not.toContain("Zuordnung unvollständig");
  });
});

describe("2. State A — trainer profile, no relationship", () => {
  it("overview shows 'Trainerprofil vorhanden' nudge when no trainers and no trainer assignments", () => {
    renderOverview({ person: { isTrainer: true }, trainers: [], assignments: [] });
    expect(document.body.textContent).toContain("Trainerprofil vorhanden");
    expect(document.body.textContent).toContain("noch keinem Team für die aktuelle Saison zugeordnet");
  });

  it("Trainer tab shows 'Noch keinem Team als Trainer/in zugeordnet' when no trainers and no assignments", () => {
    render(<PersonTrainerTab trainerMemberships={[]} assignments={[]} />);
    expect(document.body.textContent).toContain("Noch keinem Team als Trainer/in zugeordnet");
  });

  it("State A overview does NOT show 'Zuordnung unvollständig'", () => {
    renderOverview({ person: { isTrainer: true }, trainers: [], assignments: [] });
    expect(document.body.textContent).not.toContain("Zuordnung unvollständig");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3 + 4. State B: relationship exists but incomplete
// ─────────────────────────────────────────────────────────────────────────────

describe("3. State B — player assignment exists, no squad membership", () => {
  it("overview shows 'Zuordnung unvollständig' for the player assignment", () => {
    renderOverview({
      person: { isPlayer: true },
      squads: [],
      assignments: [makePlayerAssignment(TEAM_F2)],
    });
    expect(document.body.textContent).toContain("Zuordnung unvollständig");
  });

  it("overview names the correct team in State B", () => {
    renderOverview({
      person: { isPlayer: true },
      squads: [],
      assignments: [makePlayerAssignment(TEAM_F2)],
    });
    expect(document.body.textContent).toContain("FC Allschwil Junioren F2");
  });

  it("overview does NOT show 'noch keinem Team' when State B applies", () => {
    renderOverview({
      person: { isPlayer: true },
      squads: [],
      assignments: [makePlayerAssignment(TEAM_F2)],
    });
    expect(document.body.textContent).not.toContain("noch keinem Team für die aktuelle Saison zugeordnet");
    expect(document.body.textContent).not.toContain("Spielerprofil vorhanden");
  });

  it("Spieler tab shows 'Zuordnung unvollständig' when player assignment exists but no squad membership", () => {
    render(
      <PersonSpielerTab
        squadMemberships={[]}
        assignments={[makePlayerAssignment(TEAM_F2)]}
      />,
    );
    expect(document.body.textContent).toContain("Zuordnung unvollständig");
  });

  it("Spieler tab names the correct team in State B", () => {
    render(
      <PersonSpielerTab
        squadMemberships={[]}
        assignments={[makePlayerAssignment(TEAM_F2)]}
      />,
    );
    expect(document.body.textContent).toContain("FC Allschwil Junioren F2");
  });

  it("Spieler tab does NOT show 'Noch keinem Team als Spieler/in zugeordnet' when State B applies", () => {
    render(
      <PersonSpielerTab
        squadMemberships={[]}
        assignments={[makePlayerAssignment(TEAM_F2)]}
      />,
    );
    expect(document.body.textContent).not.toContain("Noch keinem Team als Spieler/in zugeordnet");
  });
});

describe("4. State B — trainer assignment exists, no trainer membership", () => {
  it("overview shows 'Zuordnung unvollständig' for the trainer assignment", () => {
    renderOverview({
      person: { isTrainer: true },
      trainers: [],
      assignments: [makeTrainerAssignment(TEAM_F2)],
    });
    expect(document.body.textContent).toContain("Zuordnung unvollständig");
  });

  it("overview names the correct team in State B", () => {
    renderOverview({
      person: { isTrainer: true },
      trainers: [],
      assignments: [makeTrainerAssignment(TEAM_F2)],
    });
    expect(document.body.textContent).toContain("FC Allschwil Junioren F2");
  });

  it("overview does NOT show 'noch keinem Team' when State B applies", () => {
    renderOverview({
      person: { isTrainer: true },
      trainers: [],
      assignments: [makeTrainerAssignment(TEAM_F2)],
    });
    expect(document.body.textContent).not.toContain("noch keinem Team für die aktuelle Saison zugeordnet");
    expect(document.body.textContent).not.toContain("Trainerprofil vorhanden");
  });

  it("Trainer tab shows 'Zuordnung unvollständig' when trainer assignment exists but no membership", () => {
    render(
      <PersonTrainerTab
        trainerMemberships={[]}
        assignments={[makeTrainerAssignment(TEAM_F2)]}
      />,
    );
    expect(document.body.textContent).toContain("Zuordnung unvollständig");
  });

  it("Trainer tab names the correct team in State B", () => {
    render(
      <PersonTrainerTab
        trainerMemberships={[]}
        assignments={[makeTrainerAssignment(TEAM_F2)]}
      />,
    );
    expect(document.body.textContent).toContain("FC Allschwil Junioren F2");
  });

  it("Trainer tab does NOT show 'Noch keinem Team als Trainer/in zugeordnet' when State B applies", () => {
    render(
      <PersonTrainerTab
        trainerMemberships={[]}
        assignments={[makeTrainerAssignment(TEAM_F2)]}
      />,
    );
    expect(document.body.textContent).not.toContain("Noch keinem Team als Trainer/in zugeordnet");
  });

  it("Trainer tab shows 'Saison-Verknüpfung fehlt' when assignment has no season", () => {
    render(
      <PersonTrainerTab
        trainerMemberships={[]}
        assignments={[makeTrainerAssignment(TEAM_F2, null)]}
      />,
    );
    expect(document.body.textContent).toContain("Saison-Verknüpfung fehlt");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5 + 6. State C: complete current-season membership
// ─────────────────────────────────────────────────────────────────────────────

describe("5. State C — complete player membership", () => {
  it("overview shows team name with no incomplete warning when squad membership exists", () => {
    renderOverview({
      person: { isPlayer: true },
      squads: [makeSquad(TEAM_F2)],
      assignments: [],
    });
    expect(document.body.textContent).toContain("FC Allschwil Junioren F2");
    expect(document.body.textContent).not.toContain("Zuordnung unvollständig");
  });

  it("overview does not show 'noch keinem Team' when squad membership exists", () => {
    renderOverview({
      person: { isPlayer: true },
      squads: [makeSquad(TEAM_F2)],
      assignments: [],
    });
    expect(document.body.textContent).not.toContain("noch keinem Team für die aktuelle Saison zugeordnet");
  });
});

describe("6. State C — complete trainer membership", () => {
  it("overview shows team name with no incomplete warning when trainer membership exists", () => {
    renderOverview({
      person: { isTrainer: true },
      trainers: [makeTrainer(TEAM_E3)],
      assignments: [],
    });
    expect(document.body.textContent).toContain("FC Allschwil Junioren E3");
    expect(document.body.textContent).not.toContain("Zuordnung unvollständig");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7 + 8. Simultaneous Player + Trainer: one complete, one incomplete
// ─────────────────────────────────────────────────────────────────────────────

describe("7. Simultaneous: player complete (State C), trainer incomplete (State B)", () => {
  it("shows player team name (State C) and trainer 'Zuordnung unvollständig' (State B)", () => {
    renderOverview({
      person: { isPlayer: true, isTrainer: true },
      squads: [makeSquad(TEAM_F2)],
      trainers: [],
      assignments: [makeTrainerAssignment(TEAM_E3)],
    });
    const content = document.body.textContent ?? "";
    expect(content).toContain("FC Allschwil Junioren F2");
    expect(content).toContain("FC Allschwil Junioren E3");
    expect(content).toContain("Zuordnung unvollständig");
    expect(content).not.toContain("Trainerprofil vorhanden");
    expect(content).not.toContain("noch keinem Team für die aktuelle Saison zugeordnet");
  });
});

describe("8. Simultaneous: player incomplete (State B), trainer complete (State C)", () => {
  it("shows trainer team name (State C) and player 'Zuordnung unvollständig' (State B)", () => {
    renderOverview({
      person: { isPlayer: true, isTrainer: true },
      squads: [],
      trainers: [makeTrainer(TEAM_E3)],
      assignments: [makePlayerAssignment(TEAM_F2)],
    });
    const content = document.body.textContent ?? "";
    expect(content).toContain("FC Allschwil Junioren E3");
    expect(content).toContain("FC Allschwil Junioren F2");
    expect(content).toContain("Zuordnung unvollständig");
    expect(content).not.toContain("Spielerprofil vorhanden");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9-11. Multi-team Trainer
// ─────────────────────────────────────────────────────────────────────────────

describe("9. Multi-team Trainer: complete + complete (State C + C)", () => {
  it("shows both teams with no incomplete warning", () => {
    renderOverview({
      person: { isTrainer: true },
      trainers: [makeTrainer(TEAM_E3), { ...makeTrainer(TEAM_B1, SEASON_ACTIVE, "Assistenztrainer"), id: "tr-b1" }],
      assignments: [],
    });
    const content = document.body.textContent ?? "";
    expect(content).toContain("FC Allschwil Junioren E3");
    expect(content).toContain("FC Allschwil B1");
    expect(content).not.toContain("Zuordnung unvollständig");
  });
});

describe("10. Multi-team Trainer: complete (E3) + incomplete (F2)", () => {
  it("shows E3 complete and F2 incomplete simultaneously", () => {
    renderOverview({
      person: { isTrainer: true },
      trainers: [makeTrainer(TEAM_E3)],
      assignments: [makeTrainerAssignment(TEAM_F2)],
    });
    const content = document.body.textContent ?? "";
    expect(content).toContain("FC Allschwil Junioren E3");
    expect(content).toContain("FC Allschwil Junioren F2");
    expect(content).toContain("Zuordnung unvollständig");
  });

  it("Trainer tab shows complete E3 and incomplete F2 simultaneously", () => {
    render(
      <PersonTrainerTab
        trainerMemberships={[makeTrainer(TEAM_E3)]}
        assignments={[makeTrainerAssignment(TEAM_F2)]}
      />,
    );
    const content = document.body.textContent ?? "";
    expect(content).toContain("FC Allschwil Junioren E3");
    expect(content).toContain("FC Allschwil Junioren F2");
    expect(content).toContain("Zuordnung unvollständig");
  });
});

describe("11. Multi-team Trainer: incomplete + incomplete (State B + B)", () => {
  it("shows both teams as 'Zuordnung unvollständig'", () => {
    renderOverview({
      person: { isTrainer: true },
      trainers: [],
      assignments: [
        makeTrainerAssignment(TEAM_E3),
        makeTrainerAssignment(TEAM_F2),
      ],
    });
    const content = document.body.textContent ?? "";
    expect(content).toContain("FC Allschwil Junioren E3");
    expect(content).toContain("FC Allschwil Junioren F2");
    expect(content).toContain("Zuordnung unvollständig");
    expect(content).not.toContain("noch keinem Team");
  });

  it("Trainer tab shows both incomplete assignments", () => {
    render(
      <PersonTrainerTab
        trainerMemberships={[]}
        assignments={[makeTrainerAssignment(TEAM_E3), makeTrainerAssignment(TEAM_F2)]}
      />,
    );
    const content = document.body.textContent ?? "";
    expect(content).toContain("FC Allschwil Junioren E3");
    expect(content).toContain("FC Allschwil Junioren F2");
    expect(content).toContain("Zuordnung unvollständig");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 12 + 13. Correctness invariants
// ─────────────────────────────────────────────────────────────────────────────

describe("12. Incomplete assignment names the correct team", () => {
  it("overview State B shows B1 team name (not E3 or F2)", () => {
    renderOverview({
      person: { isTrainer: true },
      trainers: [],
      assignments: [makeTrainerAssignment(TEAM_B1)],
    });
    const content = document.body.textContent ?? "";
    expect(content).toContain("FC Allschwil B1");
    expect(content).not.toContain("FC Allschwil Junioren E3");
    expect(content).not.toContain("FC Allschwil Junioren F2");
  });

  it("Trainer tab State B shows B1 team name", () => {
    render(
      <PersonTrainerTab
        trainerMemberships={[]}
        assignments={[makeTrainerAssignment(TEAM_B1)]}
      />,
    );
    expect(document.body.textContent).toContain("FC Allschwil B1");
  });
});

describe("13. Incomplete state NEVER renders 'noch keinem Team zugeordnet' when relationship exists", () => {
  it("overview: trainer assignment exists → no 'noch keinem Team' for trainer", () => {
    renderOverview({
      person: { isTrainer: true },
      trainers: [],
      assignments: [makeTrainerAssignment(TEAM_F2)],
    });
    expect(document.body.textContent).not.toContain("noch keinem Team als Trainer/in zugeordnet");
    expect(document.body.textContent).not.toContain("noch keinem Team für die aktuelle Saison zugeordnet");
  });

  it("Trainer tab: trainer assignment exists → no 'noch keinem Team' message", () => {
    render(
      <PersonTrainerTab
        trainerMemberships={[]}
        assignments={[makeTrainerAssignment(TEAM_F2)]}
      />,
    );
    expect(document.body.textContent).not.toContain("Noch keinem Team als Trainer/in zugeordnet");
  });

  it("overview: player assignment exists → no 'noch keinem Team' for player", () => {
    renderOverview({
      person: { isPlayer: true },
      squads: [],
      assignments: [makePlayerAssignment(TEAM_F2)],
    });
    expect(document.body.textContent).not.toContain("noch keinem Team als Spieler/in zugeordnet");
    expect(document.body.textContent).not.toContain("noch keinem Team für die aktuelle Saison zugeordnet");
  });

  it("Spieler tab: player assignment exists → no 'Noch keinem Team' message", () => {
    render(
      <PersonSpielerTab
        squadMemberships={[]}
        assignments={[makePlayerAssignment(TEAM_F2)]}
      />,
    );
    expect(document.body.textContent).not.toContain("Noch keinem Team als Spieler/in zugeordnet");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 14. True no-relationship still renders the no-team message
// ─────────────────────────────────────────────────────────────────────────────

describe("14. True no-relationship renders 'noch keinem Team' message", () => {
  it("Trainer tab with no trainers and no assignments shows State A message", () => {
    render(<PersonTrainerTab trainerMemberships={[]} assignments={[]} />);
    expect(document.body.textContent).toContain("Noch keinem Team als Trainer/in zugeordnet");
  });

  it("Spieler tab with no squads and no assignments shows State A message", () => {
    render(<PersonSpielerTab squadMemberships={[]} assignments={[]} />);
    expect(document.body.textContent).toContain("Noch keinem Team als Spieler/in zugeordnet");
  });

  it("overview with isTrainer and no trainers and no trainer assignments shows State A nudge", () => {
    renderOverview({
      person: { isTrainer: true },
      trainers: [],
      assignments: [],
    });
    expect(document.body.textContent).toContain("Trainerprofil vorhanden");
    expect(document.body.textContent).toContain("noch keinem Team für die aktuelle Saison zugeordnet");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 15. Zero-capacity regression
// ─────────────────────────────────────────────────────────────────────────────

describe("15. Zero-capacity Person regression", () => {
  it("overview shows no capacity nudge for zero-capacity person with no assignments", () => {
    renderOverview({
      person: { isPlayer: false, isTrainer: false },
      squads: [],
      trainers: [],
      assignments: [],
    });
    const content = document.body.textContent ?? "";
    expect(content).not.toContain("Spielerprofil vorhanden");
    expect(content).not.toContain("Trainerprofil vorhanden");
    expect(content).not.toContain("Zuordnung unvollständig");
    expect(content).toContain("Noch keine Zuordnung");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 16 + 17. CTA State A: Zur Organisation callback
// ─────────────────────────────────────────────────────────────────────────────

describe("16. CTA State A (Spieler): Zur Organisation callback invoked", () => {
  it("Spieler tab State A renders 'Zur Organisation' button", () => {
    const onNav = vi.fn();
    render(
      <PersonSpielerTab
        squadMemberships={[]}
        assignments={[]}
        onNavigateToTab={onNav}
      />,
    );
    const btn = screen.getByRole("button", { name: /Zur Organisation/ });
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(onNav).toHaveBeenCalledWith("organisation");
  });
});

describe("17. CTA State A (Trainer): Zur Organisation callback invoked", () => {
  it("Trainer tab State A renders 'Zur Organisation' button", () => {
    const onNav = vi.fn();
    render(
      <PersonTrainerTab
        trainerMemberships={[]}
        assignments={[]}
        onNavigateToTab={onNav}
      />,
    );
    const btn = screen.getByRole("button", { name: /Zur Organisation/ });
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(onNav).toHaveBeenCalledWith("organisation");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 18 + 19. CTA State B: team deep-link
// ─────────────────────────────────────────────────────────────────────────────

describe("18. CTA State B (Spieler): team link points to /dashboard/teams/:id", () => {
  it("Spieler tab State B renders team link with correct href", () => {
    render(
      <PersonSpielerTab
        squadMemberships={[]}
        assignments={[makePlayerAssignment(TEAM_F2)]}
      />,
    );
    const link = document.querySelector('[data-testid="spieler-incomplete-team-link"]');
    expect(link).not.toBeNull();
    expect(link?.getAttribute("href")).toBe(`/dashboard/teams/${TEAM_F2.id}`);
  });

  it("Spieler tab State B does NOT render 'Zur Organisation' button", () => {
    render(
      <PersonSpielerTab
        squadMemberships={[]}
        assignments={[makePlayerAssignment(TEAM_F2)]}
        onNavigateToTab={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /Zur Organisation/ })).toBeNull();
  });
});

describe("19. CTA State B (Trainer): team link points to /dashboard/teams/:id", () => {
  it("Trainer tab State B renders team link with correct href", () => {
    render(
      <PersonTrainerTab
        trainerMemberships={[]}
        assignments={[makeTrainerAssignment(TEAM_F2)]}
      />,
    );
    const link = document.querySelector('[data-testid="trainer-incomplete-team-link"]');
    expect(link).not.toBeNull();
    expect(link?.getAttribute("href")).toBe(`/dashboard/teams/${TEAM_F2.id}`);
  });

  it("Trainer tab State B does NOT render 'Zur Organisation' button", () => {
    render(
      <PersonTrainerTab
        trainerMemberships={[]}
        assignments={[makeTrainerAssignment(TEAM_F2)]}
        onNavigateToTab={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /Zur Organisation/ })).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 20 + 21. "Weitere Funktionen" deduplication
// ─────────────────────────────────────────────────────────────────────────────

describe("20. Weitere Funktionen — incomplete trainer assignment not duplicated", () => {
  it("overview does NOT show trainer assignment in Weitere Funktionen when shown as State B", () => {
    renderOverview({
      person: { isTrainer: true },
      trainers: [],
      assignments: [makeTrainerAssignment(TEAM_F2)],
    });
    // The assignment should appear exactly once — in the State B incomplete section,
    // not again in Weitere Funktionen.
    const cards = document.querySelectorAll('[data-testid="incomplete-assignment-card"]');
    expect(cards.length).toBeGreaterThanOrEqual(1);
    // "Weitere Funktionen" section label must NOT appear since the only assignment
    // is being shown in the capacity section.
    const content = document.body.textContent ?? "";
    expect(content).not.toContain("Weitere Funktionen");
  });

  it("overview does NOT show player assignment in Weitere Funktionen when shown as State B", () => {
    renderOverview({
      person: { isPlayer: true },
      squads: [],
      assignments: [makePlayerAssignment(TEAM_F2)],
    });
    const content = document.body.textContent ?? "";
    expect(content).not.toContain("Weitere Funktionen");
  });
});

describe("21. Weitere Funktionen — non-player/trainer assignments still shown", () => {
  it("overview shows board-member assignment in Weitere Funktionen alongside complete player", () => {
    renderOverview({
      person: { isPlayer: true },
      squads: [makeSquad(TEAM_F2)],
      assignments: [makeOtherAssignment()],
    });
    const content = document.body.textContent ?? "";
    expect(content).toContain("Vereinsleitung");
    expect(content).toContain("Weitere Funktionen");
  });

  it("board-member assignment NOT suppressed even when incomplete trainer assignment exists", () => {
    renderOverview({
      person: { isTrainer: true },
      trainers: [],
      assignments: [
        makeTrainerAssignment(TEAM_F2),
        makeOtherAssignment("a-board-other"),
      ],
    });
    const content = document.body.textContent ?? "";
    expect(content).toContain("Vereinsleitung");
    // The trainer assignment is shown in incomplete section
    expect(content).toContain("FC Allschwil Junioren F2");
    expect(content).toContain("Zuordnung unvollständig");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 22 + 23. Overview composite correctness
// ─────────────────────────────────────────────────────────────────────────────

describe("22. Overview State B — names team and shows Zuordnung unvollständig", () => {
  it("overview State B card includes team name and role label", () => {
    renderOverview({
      person: { isTrainer: true },
      trainers: [],
      assignments: [makeTrainerAssignment(TEAM_F2)],
    });
    const content = document.body.textContent ?? "";
    expect(content).toContain("Zuordnung unvollständig");
    expect(content).toContain("FC Allschwil Junioren F2");
    expect(content).toContain("Trainer/in");
  });
});

describe("23. Overview State A — shows nudge 'Spielerprofil vorhanden'", () => {
  it("overview State A shows actionable nudge for player with no assignment and no squad", () => {
    renderOverview({
      person: { isPlayer: true },
      squads: [],
      assignments: [],
    });
    const content = document.body.textContent ?? "";
    expect(content).toContain("Spielerprofil vorhanden");
    expect(content).toContain("noch keinem Team für die aktuelle Saison zugeordnet");
  });
});
