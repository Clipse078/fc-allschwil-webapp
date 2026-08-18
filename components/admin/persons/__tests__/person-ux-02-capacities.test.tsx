/**
 * @vitest-environment jsdom
 *
 * components/admin/persons/__tests__/person-ux-02-capacities.test.tsx
 *
 * PERSON-UX-02 — Dynamic Capacities + External/Internal Person Context.
 *
 * Proves all 18 specified test cases:
 *
 *  1. current Spieler → Spieler tab visible
 *  2. former Spieler → Spieler tab remains visible
 *  3. never Spieler → Spieler tab hidden
 *  4. current Trainer → Trainer tab visible
 *  5. former Trainer → Trainer tab remains visible
 *  6. never Trainer → Trainer tab hidden
 *  7. simultaneous Spieler + Trainer → both tabs visible
 *  8. same-season player/trainer Teams remain distinct (not merged)
 *  9. former player + current trainer preserves both histories
 * 10. multiple simultaneous roles are never collapsed to one
 * 11. organisational-only Person workspace remains useful
 * 12. external-only Person workspace remains useful
 * 13. external-only Person has no irrelevant sports tabs
 * 14. Person without User remains valid
 * 15. header (overview) shows current context only
 * 16. historical biography uses persisted season data only
 * 17. existing invite/delete/access functionality unchanged
 * 18. tab architecture supports relevance + future permission gating
 *     without hardcoded role names
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import type { PlayerSquadStatus, TrainerTeamStatus } from "@prisma/client";
import PersonDetailTabs from "../PersonDetailTabs";
import PersonSpielerTab from "../PersonSpielerTab";
import PersonTrainerTab from "../PersonTrainerTab";
import PersonWorkspaceOverviewTab from "../PersonWorkspaceOverviewTab";
import PersonZugangTab from "../PersonZugangTab";
import { resolvePersonCapacities } from "@/lib/people/capacity";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Fixture factories ─────────────────────────────────────────────────────────

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

const BASE_PERSON: PersonFixture = {
  id: "person-1",
  firstName: "Kai",
  lastName: "Müller",
  displayName: null,
  email: "kai@example.test",
  phone: null,
  dateOfBirth: null,
  notes: null,
  imageUrl: null,
  isActive: true,
  isPlayer: false,
  isTrainer: false,
  tenantId: "tenant-1",
  createdAt: new Date("2023-01-01"),
  updatedAt: new Date("2024-01-01"),
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
  return { ...BASE_PERSON, ...overrides };
}

const SEASON_ACTIVE = {
  id: "s-2627",
  name: "2026/27",
  key: "2026-27",
  isActive: true,
  startDate: new Date("2026-08-01"),
  endDate: new Date("2027-05-31"),
};

const SEASON_PAST = {
  id: "s-2526",
  name: "2025/26",
  key: "2025-26",
  isActive: false,
  startDate: new Date("2025-08-01"),
  endDate: new Date("2026-05-31"),
};

const SEASON_OLDER = {
  id: "s-2425",
  name: "2024/25",
  key: "2024-25",
  isActive: false,
  startDate: new Date("2024-08-01"),
  endDate: new Date("2025-05-31"),
};

const TEAM_FIRST = { id: "t-1", name: "1. Mannschaft", shortName: "1M" };
const TEAM_E3 = { id: "t-e3", name: "E3-Junioren", shortName: "E3" };
const ORGUNIT_VL = { id: "ou-vl", name: "Vereinsleitung", key: "vereinsleitung" };

function makeSquad(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "sq-1",
    status: "ACTIVE" as PlayerSquadStatus,
    shirtNumber: 7,
    positionLabel: "Stürmer",
    isCaptain: false,
    isViceCaptain: false,
    remarks: null,
    teamSeason: {
      id: "ts-1",
      displayName: "1. Mannschaft 2026/27",
      shortName: "1M",
      participationType: "COMPETITION" as const,
      team: TEAM_FIRST,
      season: SEASON_ACTIVE,
    },
    ...overrides,
  };
}

function makeHistoricalSquad(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "sq-hist",
    status: "INACTIVE" as PlayerSquadStatus,
    shirtNumber: 9,
    positionLabel: "Mittelfeld",
    isCaptain: false,
    isViceCaptain: false,
    remarks: null,
    teamSeason: {
      id: "ts-hist",
      displayName: "1. Mannschaft 2025/26",
      shortName: "1M",
      participationType: "COMPETITION" as const,
      team: TEAM_FIRST,
      season: SEASON_PAST,
    },
    ...overrides,
  };
}

function makeTrainer(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "tr-1",
    status: "ACTIVE" as TrainerTeamStatus,
    roleLabel: "Cheftrainer",
    remarks: null,
    teamSeason: {
      id: "ts-tr-1",
      displayName: "E3 2026/27",
      shortName: "E3",
      team: TEAM_E3,
      season: SEASON_ACTIVE,
    },
    ...overrides,
  };
}

function makeHistoricalTrainer(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "tr-hist",
    status: "INACTIVE" as TrainerTeamStatus,
    roleLabel: "Co-Trainer",
    remarks: null,
    teamSeason: {
      id: "ts-tr-hist",
      displayName: "E3 2025/26",
      shortName: "E3",
      team: TEAM_E3,
      season: SEASON_PAST,
    },
    ...overrides,
  };
}

function makeAssignment(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "a-1",
    orgUnitId: "ou-vl",
    teamId: null,
    seasonId: null,
    functionKey: "KOORDINATOR",
    status: "ACTIVE" as const,
    notes: null,
    orgUnit: ORGUNIT_VL,
    team: null,
    season: null,
    tenantId: "tenant-1",
    createdAt: new Date("2023-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

const ACCESS_CARD_NO_USER = {
  linkedUser: null,
  isActiveTenantMember: false,
  roles: [],
  assignedRoleIds: [],
  canAssign: true,
};

function renderTabs(
  overrides: {
    squads?: ReturnType<typeof makeSquad>[];
    trainers?: ReturnType<typeof makeTrainer>[];
    assignments?: ReturnType<typeof makeAssignment>[];
    person?: Partial<PersonFixture>;
  } = {},
) {
  const person = makePerson(overrides.person ?? {});
  render(
    <PersonDetailTabs
      person={{
        ...person,
        assignments: overrides.assignments ?? [],
        squadMemberships: overrides.squads ?? [],
        trainerMemberships: overrides.trainers ?? [],
      }}
      canManage={true}
      canDelete={true}
      orgUnits={[]}
      teams={[]}
      activeSeason={SEASON_ACTIVE}
      accessRolesCard={ACCESS_CARD_NO_USER}
    />,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. current Spieler → Spieler tab visible
// ─────────────────────────────────────────────────────────────────────────────

describe("1. current Spieler → Spieler tab visible", () => {
  it("renders Spieler tab when person has active squad membership", () => {
    renderTabs({ squads: [makeSquad()] });
    expect(screen.getByRole("tab", { name: /Spieler/ })).toBeTruthy();
  });

  it("Spieler tab content shows team name", () => {
    renderTabs({ squads: [makeSquad()] });
    fireEvent.click(screen.getByRole("tab", { name: /Spieler/ }));
    expect(screen.getAllByText(TEAM_FIRST.name).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. former Spieler → Spieler tab remains visible
// ─────────────────────────────────────────────────────────────────────────────

describe("2. former Spieler → Spieler tab remains", () => {
  it("Spieler tab still present when all squad memberships are inactive", () => {
    renderTabs({ squads: [makeHistoricalSquad()] });
    expect(screen.getByRole("tab", { name: /Spieler/ })).toBeTruthy();
  });

  it("historical squad shows in Saison-Geschichte", () => {
    renderTabs({ squads: [makeHistoricalSquad()] });
    fireEvent.click(screen.getByRole("tab", { name: /Spieler/ }));
    const content = document.body.textContent ?? "";
    expect(content).toContain(SEASON_PAST.name);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. never Spieler → Spieler tab hidden
// ─────────────────────────────────────────────────────────────────────────────

describe("3. never Spieler → Spieler tab hidden", () => {
  it("Spieler tab absent when no squad memberships exist", () => {
    renderTabs({ squads: [] });
    expect(screen.queryByRole("tab", { name: /Spieler/ })).toBeNull();
  });

  it("DOM has zero Spieler tab nodes for external-only person", () => {
    renderTabs({ squads: [], trainers: [] });
    const tabs = screen.queryAllByRole("tab");
    const spielerTab = tabs.find((t) => t.textContent?.trim() === "Spieler");
    expect(spielerTab).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. current Trainer → Trainer tab visible
// ─────────────────────────────────────────────────────────────────────────────

describe("4. current Trainer → Trainer tab visible", () => {
  it("renders Trainer tab when person has active trainer membership", () => {
    renderTabs({ trainers: [makeTrainer()] });
    expect(screen.getByRole("tab", { name: /Trainer/ })).toBeTruthy();
  });

  it("Trainer tab content shows team name", () => {
    renderTabs({ trainers: [makeTrainer()] });
    fireEvent.click(screen.getByRole("tab", { name: /Trainer/ }));
    expect(screen.getAllByText(TEAM_E3.name).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. former Trainer → Trainer tab remains visible
// ─────────────────────────────────────────────────────────────────────────────

describe("5. former Trainer → Trainer tab remains", () => {
  it("Trainer tab still present when all trainer memberships are inactive", () => {
    renderTabs({ trainers: [makeHistoricalTrainer()] });
    expect(screen.getByRole("tab", { name: /Trainer/ })).toBeTruthy();
  });

  it("historical trainer season shows in Saison-Geschichte", () => {
    renderTabs({ trainers: [makeHistoricalTrainer()] });
    fireEvent.click(screen.getByRole("tab", { name: /Trainer/ }));
    const content = document.body.textContent ?? "";
    expect(content).toContain(SEASON_PAST.name);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. never Trainer → Trainer tab hidden
// ─────────────────────────────────────────────────────────────────────────────

describe("6. never Trainer → Trainer tab hidden", () => {
  it("Trainer tab absent when no trainer memberships exist", () => {
    renderTabs({ trainers: [] });
    expect(screen.queryByRole("tab", { name: /Trainer/ })).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. simultaneous Spieler + Trainer → both tabs
// ─────────────────────────────────────────────────────────────────────────────

describe("7. simultaneous Spieler + Trainer → both tabs visible", () => {
  it("shows both Spieler and Trainer tabs when person holds both roles", () => {
    renderTabs({ squads: [makeSquad()], trainers: [makeTrainer()] });
    expect(screen.getByRole("tab", { name: /Spieler/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Trainer/ })).toBeTruthy();
  });

  it("Sport & Entwicklung also visible for dual-role person", () => {
    renderTabs({ squads: [makeSquad()], trainers: [makeTrainer()] });
    expect(screen.getByRole("tab", { name: /Sport & Entwicklung/ })).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. same-season player/trainer Teams remain distinct
// ─────────────────────────────────────────────────────────────────────────────

describe("8. same-season player/trainer Teams remain distinct", () => {
  it("Spieler tab shows only player team, not trainer team", () => {
    renderTabs({ squads: [makeSquad()], trainers: [makeTrainer()] });
    fireEvent.click(screen.getByRole("tab", { name: /Spieler/ }));
    const content = document.body.textContent ?? "";
    expect(content).toContain(TEAM_FIRST.name);
    // E3 should NOT appear in the Spieler tab
    expect(content).not.toContain(TEAM_E3.name);
  });

  it("Trainer tab shows only trainer team, not player team", () => {
    renderTabs({ squads: [makeSquad()], trainers: [makeTrainer()] });
    fireEvent.click(screen.getByRole("tab", { name: /Trainer/ }));
    const content = document.body.textContent ?? "";
    expect(content).toContain(TEAM_E3.name);
    // 1. Mannschaft should NOT appear in the Trainer tab
    expect(content).not.toContain(TEAM_FIRST.name);
  });

  it("Sport & Entwicklung combined view shows both teams in same season accordion", () => {
    renderTabs({ squads: [makeSquad()], trainers: [makeTrainer()] });
    fireEvent.click(screen.getByRole("tab", { name: /Sport & Entwicklung/ }));
    const content = document.body.textContent ?? "";
    expect(content).toContain(TEAM_FIRST.name);
    expect(content).toContain(TEAM_E3.name);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. former player + current trainer preserves both histories
// ─────────────────────────────────────────────────────────────────────────────

describe("9. former player + current trainer → both histories preserved", () => {
  it("shows both Spieler and Trainer tabs", () => {
    renderTabs({
      squads: [makeHistoricalSquad()],
      trainers: [makeTrainer()],
    });
    expect(screen.getByRole("tab", { name: /Spieler/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Trainer/ })).toBeTruthy();
  });

  it("Spieler tab shows historical season entry", () => {
    renderTabs({
      squads: [makeHistoricalSquad()],
      trainers: [makeTrainer()],
    });
    fireEvent.click(screen.getByRole("tab", { name: /Spieler/ }));
    const content = document.body.textContent ?? "";
    expect(content).toContain(SEASON_PAST.name);
  });

  it("Trainer tab shows current season entry", () => {
    renderTabs({
      squads: [makeHistoricalSquad()],
      trainers: [makeTrainer()],
    });
    fireEvent.click(screen.getByRole("tab", { name: /Trainer/ }));
    const content = document.body.textContent ?? "";
    expect(content).toContain(SEASON_ACTIVE.name);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. multiple simultaneous roles are never collapsed to one
// ─────────────────────────────────────────────────────────────────────────────

describe("10. multiple simultaneous roles — never collapsed", () => {
  it("player in two teams same season shows two entries in Spieler tab", () => {
    const squad2 = makeSquad({
      id: "sq-2",
      teamSeason: {
        id: "ts-2",
        displayName: "E3 2026/27",
        shortName: "E3",
        participationType: "COMPETITION",
        team: TEAM_E3,
        season: SEASON_ACTIVE,
      },
    });
    render(
      <PersonSpielerTab squadMemberships={[makeSquad(), squad2]} />,
    );
    const content = document.body.textContent ?? "";
    expect(content).toContain(TEAM_FIRST.name);
    expect(content).toContain(TEAM_E3.name);
  });

  it("trainer in two teams same season shows two entries in Trainer tab", () => {
    const trainer2 = makeTrainer({
      id: "tr-2",
      roleLabel: "Co-Trainer",
      teamSeason: {
        id: "ts-tr-2",
        displayName: "1. Mannschaft 2026/27",
        shortName: "1M",
        team: TEAM_FIRST,
        season: SEASON_ACTIVE,
      },
    });
    render(
      <PersonTrainerTab trainerMemberships={[makeTrainer(), trainer2]} />,
    );
    const content = document.body.textContent ?? "";
    expect(content).toContain(TEAM_E3.name);
    expect(content).toContain(TEAM_FIRST.name);
  });

  it("overview shows all active roles simultaneously without collapsing to one", () => {
    const person = makePerson();
    render(
      <PersonWorkspaceOverviewTab
        person={{
          ...person,
          assignments: [makeAssignment({ functionKey: "VIZEPRAESIDENT" })],
          squadMemberships: [makeSquad()],
          trainerMemberships: [makeTrainer()],
        }}
        activeSeason={SEASON_ACTIVE}
      />,
    );
    // All three role badges must coexist
    expect(screen.getByText("Spieler/in")).toBeTruthy();
    expect(screen.getByText("Cheftrainer")).toBeTruthy();
    expect(screen.getByText("Vizepräsident/in")).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. organisational-only Person workspace remains useful
// ─────────────────────────────────────────────────────────────────────────────

describe("11. organisational-only Person workspace remains useful", () => {
  it("shows Organisation tab and function without sports-centric clutter", () => {
    renderTabs({
      squads: [],
      trainers: [],
      assignments: [makeAssignment({ functionKey: "PRAESIDENT" })],
    });

    // Base tabs present
    expect(screen.getByRole("tab", { name: /Übersicht/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Organisation/ })).toBeTruthy();

    // Sports tabs hidden
    expect(screen.queryByRole("tab", { name: /Spieler/ })).toBeNull();
    expect(screen.queryByRole("tab", { name: /Trainer/ })).toBeNull();
    expect(screen.queryByRole("tab", { name: /Sport & Entwicklung/ })).toBeNull();
  });

  it("overview shows org function label in Aktuelle Rollen", () => {
    const person = makePerson();
    render(
      <PersonWorkspaceOverviewTab
        person={{
          ...person,
          assignments: [makeAssignment({ functionKey: "PRAESIDENT" })],
          squadMemberships: [],
          trainerMemberships: [],
        }}
        activeSeason={null}
      />,
    );
    expect(screen.getByText("Präsident/in")).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. external-only Person workspace remains useful
// ─────────────────────────────────────────────────────────────────────────────

describe("12. external-only Person workspace remains useful", () => {
  it("shows Übersicht, Stammdaten, Organisation, Zugang for external person", () => {
    renderTabs({ squads: [], trainers: [], assignments: [] });

    expect(screen.getByRole("tab", { name: /Übersicht/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Stammdaten/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Organisation/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Zugang/ })).toBeTruthy();
  });

  it("overview shows 'Noch keine Zuordnung' for external person without assignments", () => {
    const person = makePerson();
    render(
      <PersonWorkspaceOverviewTab
        person={{ ...person, assignments: [], squadMemberships: [], trainerMemberships: [] }}
        activeSeason={null}
      />,
    );
    expect(screen.getByText("Noch keine Zuordnung")).toBeTruthy();
  });

  it("external sponsor contact shows SPONSORING_KONTAKT function label", () => {
    const person = makePerson();
    render(
      <PersonWorkspaceOverviewTab
        person={{
          ...person,
          assignments: [makeAssignment({ functionKey: "SPONSORING_KONTAKT" })],
          squadMemberships: [],
          trainerMemberships: [],
        }}
        activeSeason={null}
      />,
    );
    expect(screen.getByText("Sponsoring-Kontakt")).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 13. external-only Person has no irrelevant sports tabs
// ─────────────────────────────────────────────────────────────────────────────

describe("13. external-only Person has no irrelevant sports tabs", () => {
  it("Spieler, Trainer, Sport & Entwicklung are all absent from DOM", () => {
    renderTabs({ squads: [], trainers: [], assignments: [] });

    expect(screen.queryByRole("tab", { name: /Spieler/ })).toBeNull();
    expect(screen.queryByRole("tab", { name: /Trainer/ })).toBeNull();
    expect(screen.queryByRole("tab", { name: /Sport & Entwicklung/ })).toBeNull();
  });

  it("hidden sports tabs generate no tabpanel DOM nodes", () => {
    const { container } = render(
      <PersonDetailTabs
        person={{
          ...makePerson(),
          assignments: [],
          squadMemberships: [],
          trainerMemberships: [],
        }}
        canManage={false}
        canDelete={false}
        orgUnits={[]}
        teams={[]}
        activeSeason={null}
        accessRolesCard={null}
      />,
    );
    // No tabpanel for spieler/trainer/sport should exist
    expect(container.querySelector("#tabpanel-spieler")).toBeNull();
    expect(container.querySelector("#tabpanel-trainer")).toBeNull();
    expect(container.querySelector("#tabpanel-sport")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 14. Person without User remains valid
// ─────────────────────────────────────────────────────────────────────────────

describe("14. Person without User remains valid", () => {
  it("workspace renders without crash for Person without userId", () => {
    const person = makePerson({ userId: null, user: null });
    render(
      <PersonWorkspaceOverviewTab
        person={{ ...person, assignments: [], squadMemberships: [], trainerMemberships: [] }}
        activeSeason={null}
      />,
    );
    expect(screen.getByText("Kein Benutzerkonto verknüpft")).toBeTruthy();
  });

  it("Person without User still has a valid Zugang tab", () => {
    render(
      <PersonZugangTab
        personId="person-1"
        accessRolesCard={ACCESS_CARD_NO_USER}
      />,
    );
    expect(screen.getByText("Kein Benutzerkonto verknüpft")).toBeTruthy();
    expect(screen.getByText("Benutzerkonto verknüpfen")).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 15. header shows current context only
// ─────────────────────────────────────────────────────────────────────────────

describe("15. header shows current context only", () => {
  it("overview identity section shows current active teams", () => {
    const person = makePerson();
    render(
      <PersonWorkspaceOverviewTab
        person={{
          ...person,
          assignments: [],
          squadMemberships: [makeSquad()],
          trainerMemberships: [],
        }}
        activeSeason={SEASON_ACTIVE}
      />,
    );
    expect(screen.getByText("Aktuelle Teams")).toBeTruthy();
    const content = document.body.textContent ?? "";
    expect(content).toContain(TEAM_FIRST.name);
  });

  it("historical-only player does NOT appear in current teams list", () => {
    const person = makePerson();
    render(
      <PersonWorkspaceOverviewTab
        person={{
          ...person,
          assignments: [],
          squadMemberships: [makeHistoricalSquad()], // inactive membership
          trainerMemberships: [],
        }}
        activeSeason={SEASON_ACTIVE}
      />,
    );
    // Overview only shows current (active) teams — historical not in identity section
    expect(screen.queryByText("Aktuelle Teams")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 16. historical biography uses persisted season data only
// ─────────────────────────────────────────────────────────────────────────────

describe("16. historical biography uses persisted season data only", () => {
  it("capacity resolver derives hasPlayerEvidence from membership records, not isPlayer flag", () => {
    // isPlayer=true but NO squad memberships → no player evidence
    const caps1 = resolvePersonCapacities([], []);
    expect(caps1.hasPlayerEvidence).toBe(false);

    // isPlayer=false but squad memberships exist → player evidence found
    const caps2 = resolvePersonCapacities([makeSquad()], []);
    expect(caps2.hasPlayerEvidence).toBe(true);
  });

  it("capacity resolver derives hasTrainerEvidence from membership records, not isTrainer flag", () => {
    const caps1 = resolvePersonCapacities([], []);
    expect(caps1.hasTrainerEvidence).toBe(false);

    const caps2 = resolvePersonCapacities([], [makeTrainer()]);
    expect(caps2.hasTrainerEvidence).toBe(true);
  });

  it("Sport biography shows only seasons with persisted data, not fabricated seasons", () => {
    renderTabs({
      squads: [makeSquad()], // only active season
      trainers: [],
    });
    fireEvent.click(screen.getByRole("tab", { name: /Sport & Entwicklung/ }));

    expect(screen.getByText(SEASON_ACTIVE.name)).toBeTruthy();
    expect(screen.queryByText(SEASON_OLDER.name)).toBeNull();
  });

  it("isCurrentPlayer is false for historical-only player (all statuses inactive)", () => {
    const caps = resolvePersonCapacities([makeHistoricalSquad()], []);
    expect(caps.isCurrentPlayer).toBe(false);
    expect(caps.hasPlayerEvidence).toBe(true); // still shows Spieler tab
  });

  it("isCurrentTrainer is false for historical-only trainer", () => {
    const caps = resolvePersonCapacities([], [makeHistoricalTrainer()]);
    expect(caps.isCurrentTrainer).toBe(false);
    expect(caps.hasTrainerEvidence).toBe(true); // still shows Trainer tab
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 17. existing invite/delete/access functionality unchanged
// ─────────────────────────────────────────────────────────────────────────────

describe("17. existing invite/delete/access functionality unchanged", () => {
  it("Zugang tab still renders with access control panel", () => {
    renderTabs({});
    fireEvent.click(screen.getByRole("tab", { name: /Zugang/ }));
    expect(screen.getByText("Benutzerkonto verknüpfen")).toBeTruthy();
  });

  it("Zugang tab security principle notice still present", () => {
    renderTabs({});
    fireEvent.click(screen.getByRole("tab", { name: /Zugang/ }));
    expect(screen.getByText(/Sicherheitsprinzip/)).toBeTruthy();
  });

  it("tab navigation switches content when clicked", () => {
    renderTabs({ squads: [makeSquad()] });

    // Start on Übersicht
    expect(screen.getByText("Identität & Status")).toBeTruthy();

    // Switch to Spieler
    fireEvent.click(screen.getByRole("tab", { name: /Spieler/ }));
    expect(screen.getByText("Saison-Geschichte")).toBeTruthy();

    // Switch back to Übersicht
    fireEvent.click(screen.getByRole("tab", { name: /Übersicht/ }));
    expect(screen.getByText("Identität & Status")).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 18. tab architecture supports relevance + future permission gating
// ─────────────────────────────────────────────────────────────────────────────

describe("18. permission-ready tab architecture", () => {
  it("tab nav uses flex-wrap for responsive layout (no overflow-x)", () => {
    const { container } = render(
      <PersonDetailTabs
        person={{
          ...makePerson(),
          assignments: [],
          squadMemberships: [],
          trainerMemberships: [],
        }}
        canManage={false}
        canDelete={false}
        orgUnits={[]}
        teams={[]}
        activeSeason={null}
        accessRolesCard={null}
      />,
    );
    const nav = container.querySelector("nav");
    expect(nav).toBeTruthy();
    expect(nav!.className).toContain("flex-wrap");
    expect(nav!.className).not.toContain("overflow-x");
  });

  it("resolvePersonCapacities is a pure function — same input same output", () => {
    const squads = [makeSquad()];
    const trainers = [makeTrainer()];
    const caps1 = resolvePersonCapacities(squads, trainers);
    const caps2 = resolvePersonCapacities(squads, trainers);
    expect(caps1).toEqual(caps2);
  });

  it("resolvePersonCapacities: all false for empty Person", () => {
    const caps = resolvePersonCapacities([], []);
    expect(caps.hasPlayerEvidence).toBe(false);
    expect(caps.hasTrainerEvidence).toBe(false);
    expect(caps.isCurrentPlayer).toBe(false);
    expect(caps.isCurrentTrainer).toBe(false);
    expect(caps.hasSportingEvidence).toBe(false);
  });

  it("resolvePersonCapacities: isCurrentPlayer true only for active statuses", () => {
    // INJURED counts as active (player is still in the squad)
    const injured = makeSquad({ id: "sq-inj", status: "INJURED" as PlayerSquadStatus });
    const caps = resolvePersonCapacities([injured], []);
    expect(caps.isCurrentPlayer).toBe(true);

    // INACTIVE does NOT count
    const inactive = makeHistoricalSquad();
    const caps2 = resolvePersonCapacities([inactive], []);
    expect(caps2.isCurrentPlayer).toBe(false);
    expect(caps2.hasPlayerEvidence).toBe(true);
  });

  it("Spieler tab hidden flag is determined by capacity, not by isPlayer flag", () => {
    // isPlayer=true but no squad memberships → Spieler tab hidden
    const { container } = render(
      <PersonDetailTabs
        person={{
          ...makePerson({ isPlayer: true }),
          assignments: [],
          squadMemberships: [], // no actual evidence
          trainerMemberships: [],
        }}
        canManage={false}
        canDelete={false}
        orgUnits={[]}
        teams={[]}
        activeSeason={null}
        accessRolesCard={null}
      />,
    );
    // Tab must not appear
    const tabs = container.querySelectorAll("[role='tab']");
    const spielerTab = Array.from(tabs).find((t) => t.textContent?.trim() === "Spieler");
    expect(spielerTab).toBeUndefined();
  });

  it("Trainer tab hidden flag is determined by capacity, not by isTrainer flag", () => {
    // isTrainer=true but no trainer memberships → Trainer tab hidden
    const { container } = render(
      <PersonDetailTabs
        person={{
          ...makePerson({ isTrainer: true }),
          assignments: [],
          squadMemberships: [],
          trainerMemberships: [], // no actual evidence
        }}
        canManage={false}
        canDelete={false}
        orgUnits={[]}
        teams={[]}
        activeSeason={null}
        accessRolesCard={null}
      />,
    );
    const tabs = container.querySelectorAll("[role='tab']");
    const trainerTab = Array.from(tabs).find((t) => t.textContent?.trim() === "Trainer");
    expect(trainerTab).toBeUndefined();
  });
});
