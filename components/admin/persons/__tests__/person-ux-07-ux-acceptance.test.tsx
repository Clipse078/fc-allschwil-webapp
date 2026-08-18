/**
 * @vitest-environment jsdom
 *
 * PERSON-UX-07 UX Acceptance — Operational capacity display tests.
 *
 * Verifies the UX acceptance requirements introduced after PERSON-UX-07
 * engineering completion:
 *
 *  A. Player + Trainer simultaneously visible in overview
 *  B. Multiple trainer teams all shown in overview
 *  C. Capacity profile with no current assignment → actionable nudge (not silent)
 *  D. Current assignment team names visible in overview
 *  E. Season visible where available
 *  F. Incomplete season-link nudge in Sport & Entwicklung
 *  G. Actionable CTA / deep-link where supported
 *  H. Zero-capacity Person regression (no capacity badges, no nudge)
 *  I. Player + Trainer simultaneously → both capacity sections in overview
 *  J. Unassigned Spieler + active Trainer: mixed state rendered correctly
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import type { PlayerSquadStatus, TrainerTeamStatus } from "@prisma/client";
import PersonDetailTabs from "../PersonDetailTabs";
import PersonWorkspaceOverviewTab from "../PersonWorkspaceOverviewTab";
import PersonSpielerTab from "../PersonSpielerTab";
import PersonTrainerTab from "../PersonTrainerTab";
import PersonSportTab from "../PersonSportTab";
import type { PersonDomainPermissions } from "@/lib/people/person-domain-auth";
import type { PersonAssignment } from "@/lib/people/queries";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), back: vi.fn(), push: vi.fn() }),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

const NO_DOMAIN_PERMS: PersonDomainPermissions = {
  canViewFinance: false,
  canManageFinance: false,
  canViewHealth: false,
  canManageHealth: false,
  canViewPrivateDocuments: false,
  canManagePrivateDocuments: false,
  canViewDevelopment: false,
  canManageDevelopment: false,
  canViewAssessments: false,
  canManageAssessments: false,
  canViewAudit: false,
};

const SEASON_ACTIVE = {
  id: "s-acc-2627",
  name: "2026/27",
  key: "2026-27",
  isActive: true,
  startDate: new Date("2026-08-01"),
  endDate: new Date("2027-05-31"),
};

const SEASON_PAST = {
  id: "s-acc-2526",
  name: "2025/26",
  key: "2025-26",
  isActive: false,
  startDate: new Date("2025-08-01"),
  endDate: new Date("2026-05-31"),
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
  id: "person-acc",
  firstName: "Markus",
  lastName: "Frei",
  displayName: null,
  email: "markus@example.test",
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
  tenantId: "tenant-acc",
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
    id: `sq-acc-${teamOverride.id}`,
    status: "ACTIVE" as PlayerSquadStatus,
    shirtNumber: 7,
    positionLabel: null,
    isCaptain: false,
    isViceCaptain: false,
    remarks: null,
    teamSeason: {
      id: `ts-acc-${teamOverride.id}`,
      displayName: `${teamOverride.name} ${seasonOverride.name}`,
      shortName: teamOverride.shortName,
      participationType: "COMPETITION" as const,
      team: teamOverride,
      season: seasonOverride,
    },
  };
}

function makeTrainer(teamOverride = TEAM_E3, seasonOverride = SEASON_ACTIVE, roleLabel = "Cheftrainer") {
  return {
    id: `tr-acc-${teamOverride.id}`,
    status: "ACTIVE" as TrainerTeamStatus,
    roleLabel,
    remarks: null,
    teamSeason: {
      id: `ts-tr-acc-${teamOverride.id}`,
      displayName: `${teamOverride.name} ${seasonOverride.name}`,
      shortName: teamOverride.shortName,
      team: teamOverride,
      season: seasonOverride,
    },
  };
}

const ACCESS_CARD_NULL = {
  linkedUser: null,
  isActiveTenantMember: false,
  roles: [],
  assignedRoleIds: [],
  canAssign: false,
};

function renderTabs(opts: {
  person?: Partial<PersonFixture>;
  squads?: ReturnType<typeof makeSquad>[];
  trainers?: ReturnType<typeof makeTrainer>[];
  assignments?: PersonAssignment[];
} = {}) {
  const person = makePerson(opts.person ?? {});
  render(
    <PersonDetailTabs
      person={{
        ...person,
        assignments: opts.assignments ?? [],
        squadMemberships: opts.squads ?? [],
        trainerMemberships: opts.trainers ?? [],
      }}
      canManage={true}
      canDelete={false}
      orgUnits={[]}
      teams={[]}
      activeSeason={SEASON_ACTIVE}
      accessRolesCard={ACCESS_CARD_NULL}
      domainPermissions={NO_DOMAIN_PERMS}
    />,
  );
}

function renderOverview(opts: {
  person?: Partial<PersonFixture>;
  squads?: ReturnType<typeof makeSquad>[];
  trainers?: ReturnType<typeof makeTrainer>[];
  assignments?: PersonAssignment[];
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
    />,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// A. Player + Trainer simultaneously visible in overview
// ─────────────────────────────────────────────────────────────────────────────

describe("A. Player + Trainer simultaneously visible in overview", () => {
  it("overview shows both Spieler/in and Trainer/in capacity sections when both flags set", () => {
    renderOverview({
      person: { isPlayer: true, isTrainer: true },
      squads: [makeSquad(TEAM_F2)],
      trainers: [makeTrainer(TEAM_E3)],
    });
    const content = document.body.textContent ?? "";
    // Both team names must appear
    expect(content).toContain("FC Allschwil Junioren F2");
    expect(content).toContain("FC Allschwil Junioren E3");
  });

  it("overview shows capacity sub-headings for both Spieler/in and Trainer/in", () => {
    renderOverview({
      person: { isPlayer: true, isTrainer: true },
      squads: [makeSquad(TEAM_F2)],
      trainers: [makeTrainer(TEAM_E3)],
    });
    const content = document.body.textContent ?? "";
    // Sub-section labels
    expect(content).toMatch(/Spieler\/in/);
    expect(content).toMatch(/Trainer\/in/);
  });

  it("Spieler tab is navigable and shows F2 assignment", () => {
    renderTabs({
      person: { isPlayer: true, isTrainer: true },
      squads: [makeSquad(TEAM_F2)],
      trainers: [makeTrainer(TEAM_E3)],
    });
    fireEvent.click(screen.getByRole("tab", { name: /Spieler/ }));
    const content = document.body.textContent ?? "";
    expect(content).toContain("FC Allschwil Junioren F2");
  });

  it("Trainer tab is navigable and shows E3 assignment", () => {
    renderTabs({
      person: { isPlayer: true, isTrainer: true },
      squads: [makeSquad(TEAM_F2)],
      trainers: [makeTrainer(TEAM_E3)],
    });
    fireEvent.click(screen.getByRole("tab", { name: /Trainer/ }));
    const content = document.body.textContent ?? "";
    expect(content).toContain("FC Allschwil Junioren E3");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B. Multiple trainer teams shown
// ─────────────────────────────────────────────────────────────────────────────

describe("B. Multiple trainer teams all shown", () => {
  it("overview shows all trainer teams when person trains multiple teams", () => {
    renderOverview({
      person: { isTrainer: true },
      trainers: [
        makeTrainer(TEAM_E3, SEASON_ACTIVE, "Cheftrainer"),
        { ...makeTrainer(TEAM_B1, SEASON_ACTIVE, "Assistenztrainer"), id: "tr-acc-b1" },
      ],
    });
    const content = document.body.textContent ?? "";
    expect(content).toContain("FC Allschwil Junioren E3");
    expect(content).toContain("FC Allschwil B1");
  });

  it("Trainer tab shows all active trainer memberships", () => {
    render(
      <PersonTrainerTab
        trainerMemberships={[
          makeTrainer(TEAM_E3, SEASON_ACTIVE, "Cheftrainer"),
          { ...makeTrainer(TEAM_B1, SEASON_ACTIVE, "Assistenztrainer"), id: "tr-b1-acc" },
        ]}
      />,
    );
    const content = document.body.textContent ?? "";
    expect(content).toContain("FC Allschwil Junioren E3");
    expect(content).toContain("Cheftrainer");
    expect(content).toContain("FC Allschwil B1");
    expect(content).toContain("Assistenztrainer");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// C. Capacity profile with no current assignment → actionable nudge
// ─────────────────────────────────────────────────────────────────────────────

describe("C. Capacity with no current assignment shows actionable nudge", () => {
  it("isPlayer=true with no squad memberships: overview shows unassigned nudge for Spieler", () => {
    renderOverview({
      person: { isPlayer: true },
      squads: [],
    });
    const content = document.body.textContent ?? "";
    // State A: compact neutral nudge — contains "Spielerprofil ist vorhanden"
    expect(content).toContain("Spielerprofil ist vorhanden");
    expect(content).toContain("keine Kaderzuordnung");
  });

  it("isTrainer=true with no trainer memberships: overview shows unassigned nudge for Trainer", () => {
    renderOverview({
      person: { isTrainer: true },
      trainers: [],
    });
    const content = document.body.textContent ?? "";
    // State A: compact neutral nudge — contains "Trainerprofil ist vorhanden"
    expect(content).toContain("Trainerprofil ist vorhanden");
    expect(content).toContain("keine Trainer-Zuordnung");
  });

  it("Spieler tab shows actionable nudge (not silent empty) when no active squad memberships", () => {
    render(
      <PersonSpielerTab
        squadMemberships={[]}
      />,
    );
    const content = document.body.textContent ?? "";
    expect(content).toContain("Noch keinem Team als Spieler/in zugeordnet");
    expect(content).toContain("Spielerprofil ist vorhanden");
  });

  it("Trainer tab shows actionable nudge (not silent empty) when no active trainer memberships", () => {
    render(
      <PersonTrainerTab
        trainerMemberships={[]}
      />,
    );
    const content = document.body.textContent ?? "";
    expect(content).toContain("Noch keinem Team als Trainer/in zugeordnet");
    expect(content).toContain("Trainerprofil ist vorhanden");
  });

  it("Spieler tab nudge mentions Kader-Verwaltung context", () => {
    render(<PersonSpielerTab squadMemberships={[]} />);
    const content = document.body.textContent ?? "";
    expect(content).toMatch(/Team-Management|Kader/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// D. Current assignment team names visible
// ─────────────────────────────────────────────────────────────────────────────

describe("D. Current assignment team names visible", () => {
  it("overview shows player team name in Aktuelle Funktionen section", () => {
    renderOverview({
      person: { isPlayer: true },
      squads: [makeSquad(TEAM_F2)],
    });
    const content = document.body.textContent ?? "";
    expect(content).toContain("FC Allschwil Junioren F2");
  });

  it("Spieler tab shows team name for active assignment", () => {
    render(
      <PersonSpielerTab
        squadMemberships={[makeSquad(TEAM_F2)]}
      />,
    );
    const content = document.body.textContent ?? "";
    expect(content).toContain("FC Allschwil Junioren F2");
  });

  it("Trainer tab shows team name and role label for active assignment", () => {
    render(
      <PersonTrainerTab
        trainerMemberships={[makeTrainer(TEAM_E3, SEASON_ACTIVE, "Cheftrainer")]}
      />,
    );
    const content = document.body.textContent ?? "";
    expect(content).toContain("FC Allschwil Junioren E3");
    expect(content).toContain("Cheftrainer");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// E. Season visible where available
// ─────────────────────────────────────────────────────────────────────────────

describe("E. Season visible where available", () => {
  it("overview shows season name alongside squad assignment", () => {
    renderOverview({
      person: { isPlayer: true },
      squads: [makeSquad(TEAM_F2, SEASON_ACTIVE)],
    });
    const content = document.body.textContent ?? "";
    expect(content).toContain("2026/27");
  });

  it("Spieler tab accordion shows active season with 'Aktuell' badge", () => {
    render(
      <PersonSpielerTab
        squadMemberships={[makeSquad(TEAM_F2, SEASON_ACTIVE)]}
      />,
    );
    const content = document.body.textContent ?? "";
    expect(content).toContain("2026/27");
    expect(content).toContain("Aktuell");
  });

  it("Spieler tab accordion shows historical season without Aktuell badge", () => {
    render(
      <PersonSpielerTab
        squadMemberships={[
          { ...makeSquad(TEAM_F2, SEASON_PAST), id: "sq-hist", status: "INACTIVE" as PlayerSquadStatus },
        ]}
      />,
    );
    const content = document.body.textContent ?? "";
    expect(content).toContain("2025/26");
  });

  it("Trainer tab shows season name for active trainer assignment", () => {
    render(
      <PersonTrainerTab
        trainerMemberships={[makeTrainer(TEAM_E3, SEASON_ACTIVE)]}
      />,
    );
    const content = document.body.textContent ?? "";
    expect(content).toContain("2026/27");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// F. Incomplete season-link nudge in Sport & Entwicklung
// ─────────────────────────────────────────────────────────────────────────────

describe("F. Incomplete season-link nudge in Sport & Entwicklung", () => {
  const unseasonedAssignment = {
    id: "a-unseasoned",
    orgUnitId: "ou-1",
    teamId: "t-f2",
    seasonId: null,
    functionKey: "PLAYER",
    status: "ACTIVE",
    notes: null,
    orgUnit: { id: "ou-1", name: "Fussball", key: "fussball" },
    team: { id: "t-f2", name: "FC Allschwil Junioren F2", shortName: "F2" },
    season: null,
  } as unknown as PersonAssignment;

  it("Sport tab shows actionable warning for unseasoned active assignment", () => {
    render(
      <PersonSportTab
        personId="p-acc"
        squadMemberships={[]}
        trainerMemberships={[]}
        assignments={[unseasonedAssignment]}
      />,
    );
    const content = document.body.textContent ?? "";
    expect(content).toContain("Zuordnung unvollständig");
  });

  it("Sport tab warning identifies the affected team/assignment name", () => {
    render(
      <PersonSportTab
        personId="p-acc"
        squadMemberships={[]}
        trainerMemberships={[]}
        assignments={[unseasonedAssignment]}
      />,
    );
    const content = document.body.textContent ?? "";
    expect(content).toContain("FC Allschwil Junioren F2");
    expect(content).toContain("Saison-Verknüpfung fehlt");
  });

  it("Sport tab warning explains operational impact", () => {
    render(
      <PersonSportTab
        personId="p-acc"
        squadMemberships={[]}
        trainerMemberships={[]}
        assignments={[unseasonedAssignment]}
      />,
    );
    const content = document.body.textContent ?? "";
    expect(content).toMatch(/Saison-Biografie|vollständig/);
  });

  it("Sport tab shows no warning when all assignments have seasons", () => {
    const seasonedAssignment = {
      ...unseasonedAssignment,
      seasonId: "s-acc-2627",
      season: { id: "s-acc-2627", name: "2026/27", key: "2026-27" },
    } as unknown as PersonAssignment;
    render(
      <PersonSportTab
        personId="p-acc"
        squadMemberships={[]}
        trainerMemberships={[]}
        assignments={[seasonedAssignment]}
      />,
    );
    const nudge = document.querySelector('[data-testid="unseasoned-assignment-warning"]');
    expect(nudge).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// G. Actionable CTA / deep-link where supported
// ─────────────────────────────────────────────────────────────────────────────

describe("G. Actionable CTA/deep-link where supported", () => {
  it("Spieler unassigned nudge renders Zur Organisation button when callback provided", () => {
    const onNavigate = vi.fn();
    render(
      <PersonSpielerTab
        squadMemberships={[]}
        onNavigateToTab={onNavigate}
      />,
    );
    const btn = screen.getByRole("button", { name: /Zur Organisation/ });
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(onNavigate).toHaveBeenCalledWith("organisation");
  });

  it("Trainer unassigned nudge renders Zur Organisation button when callback provided", () => {
    const onNavigate = vi.fn();
    render(
      <PersonTrainerTab
        trainerMemberships={[]}
        onNavigateToTab={onNavigate}
      />,
    );
    const btn = screen.getByRole("button", { name: /Zur Organisation/ });
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(onNavigate).toHaveBeenCalledWith("organisation");
  });

  it("Sport unseasoned warning renders 'Zuordnung vervollständigen' CTA when callback provided", () => {
    const onNavigate = vi.fn();
    render(
      <PersonSportTab
        personId="p-acc"
        squadMemberships={[]}
        trainerMemberships={[]}
        assignments={[{
          id: "a-uns",
          orgUnitId: "ou-1",
          teamId: "t-f2",
          seasonId: null,
          functionKey: "PLAYER",
          status: "ACTIVE",
          notes: null,
          orgUnit: { id: "ou-1", name: "Fussball", key: "fussball" },
          team: { id: "t-f2", name: "FC Allschwil Junioren F2", shortName: "F2" },
          season: null,
        } as unknown as PersonAssignment]}
        onNavigateToTab={onNavigate}
      />,
    );
    const btn = screen.getByRole("button", { name: /Zuordnung vervollständigen/ });
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(onNavigate).toHaveBeenCalledWith("organisation");
  });

  it("Overview unassigned Spieler nudge renders 'Zum Spieler-Tab' link when callback provided", () => {
    const onNavigate = vi.fn();
    render(
      <PersonWorkspaceOverviewTab
        person={{
          ...makePerson({ isPlayer: true }),
          assignments: [],
          squadMemberships: [],
          trainerMemberships: [],
        }}
        activeSeason={SEASON_ACTIVE}
        onNavigateToTab={onNavigate}
      />,
    );
    const btn = screen.getByRole("button", { name: /Zum Spieler-Tab/ });
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(onNavigate).toHaveBeenCalledWith("spieler");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// H. Zero-capacity Person regression
// ─────────────────────────────────────────────────────────────────────────────

describe("H. Zero-capacity Person regression", () => {
  it("no capacity badges shown for zero-capacity person", () => {
    renderOverview({
      person: {
        isPlayer: false, isTrainer: false, isFunctionary: false,
        isVolunteer: false, isReferee: false, isSponsorContact: false,
        customFunctions: [],
      },
    });
    const content = document.body.textContent ?? "";
    expect(content).not.toContain("Spieler/in");
    expect(content).not.toContain("Trainer/in");
  });

  it("no Spieler tab for zero-capacity person", () => {
    renderTabs({
      person: { isPlayer: false, isTrainer: false },
      squads: [],
      trainers: [],
    });
    expect(screen.queryByRole("tab", { name: /Spieler/ })).toBeNull();
  });

  it("no nudge in overview for zero-capacity person (profile section absent)", () => {
    renderOverview({
      person: { isPlayer: false, isTrainer: false },
      squads: [],
      trainers: [],
    });
    const nudge = document.querySelector('[data-testid="unassigned-capacity-nudge"]');
    expect(nudge).toBeNull();
  });

  it("zero-capacity person overview shows 'Noch keine Zuordnung' empty state when no assignments", () => {
    renderOverview({
      person: { isPlayer: false, isTrainer: false },
      squads: [],
      trainers: [],
      assignments: [],
    });
    const content = document.body.textContent ?? "";
    expect(content).toContain("Noch keine Zuordnung");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// I. Player + Trainer simultaneously: unassigned one, assigned other
// ─────────────────────────────────────────────────────────────────────────────

describe("I. Mixed state: assigned player, unassigned trainer", () => {
  it("shows player team in Spieler section and nudge in Trainer section", () => {
    renderOverview({
      person: { isPlayer: true, isTrainer: true },
      squads: [makeSquad(TEAM_F2)], // player assigned
      trainers: [],                  // trainer NOT assigned
    });
    const content = document.body.textContent ?? "";
    // Player team must be shown
    expect(content).toContain("FC Allschwil Junioren F2");
    // Trainer nudge must appear — neutral State A
    expect(content).toContain("Trainerprofil ist vorhanden");
    expect(content).toContain("keine Trainer-Zuordnung");
  });

  it("shows trainer team in Trainer section and nudge in Spieler section", () => {
    renderOverview({
      person: { isPlayer: true, isTrainer: true },
      squads: [],                    // player NOT assigned
      trainers: [makeTrainer(TEAM_E3)], // trainer assigned
    });
    const content = document.body.textContent ?? "";
    // Trainer team must be shown
    expect(content).toContain("FC Allschwil Junioren E3");
    // Spieler nudge must appear — neutral State A
    expect(content).toContain("Spielerprofil ist vorhanden");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// J. PersonAssignment functions shown alongside capacity assignments
// ─────────────────────────────────────────────────────────────────────────────

describe("J. PersonAssignment functions shown in overview", () => {
  it("overview shows active PersonAssignment functions alongside capacity sections", () => {
    renderOverview({
      person: { isPlayer: true },
      squads: [makeSquad(TEAM_F2)],
      assignments: [{
        id: "a-func",
        orgUnitId: "ou-1",
        teamId: null,
        seasonId: "s-acc-2627",
        functionKey: "BOARD_PRESIDENT",
        status: "ACTIVE",
        notes: null,
        orgUnit: { id: "ou-1", name: "Vereinsleitung", key: "vereinsleitung" },
        team: null,
        season: { id: "s-acc-2627", name: "2026/27", key: "2026-27" },
      } as unknown as PersonAssignment],
    });
    const content = document.body.textContent ?? "";
    // Player team present
    expect(content).toContain("FC Allschwil Junioren F2");
    // Function assignment org unit present
    expect(content).toContain("Vereinsleitung");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// K. NEW UX-ACCEPTANCE: Overview shows trainer team BEFORE incomplete status
// ─────────────────────────────────────────────────────────────────────────────

describe("K. Overview operational first: trainer team visible before incomplete status", () => {
  const trainerAssignment = {
    id: "a-trainer-b",
    orgUnitId: "ou-1",
    teamId: TEAM_F2.id,
    seasonId: null,
    functionKey: "TRAINER",
    status: "ACTIVE",
    notes: null,
    orgUnit: { id: "ou-1", name: "Fussball", key: "fussball" },
    team: TEAM_F2,
    season: null,
  } as unknown as PersonAssignment;

  it("overview State B shows team name as primary content (not warning title first)", () => {
    renderOverview({
      person: { isTrainer: true },
      trainers: [],
      assignments: [trainerAssignment],
    });
    const content = document.body.textContent ?? "";
    // Team name must appear
    expect(content).toContain("FC Allschwil Junioren F2");
    // "Zuordnung unvollständig" appears as status badge
    expect(content).toContain("Zuordnung unvollständig");
  });

  it("overview State B shows incomplete card is NOT wrapped in amber container (operational card)", () => {
    const { container } = render(
      <PersonWorkspaceOverviewTab
        person={{
          ...makePerson({ isTrainer: true }),
          assignments: [trainerAssignment],
          squadMemberships: [],
          trainerMemberships: [],
        }}
        activeSeason={SEASON_ACTIVE}
      />,
    );
    const card = container.querySelector('[data-testid="incomplete-assignment-card"]');
    expect(card).toBeTruthy();
    // Card uses neutral border, not amber background as primary container
    const classList = card?.className ?? "";
    expect(classList).not.toMatch(/bg-amber/);
  });

  it("overview State B shows season name from activeSeason", () => {
    renderOverview({
      person: { isTrainer: true },
      trainers: [],
      assignments: [trainerAssignment],
    });
    const content = document.body.textContent ?? "";
    expect(content).toContain(SEASON_ACTIVE.name);
  });

  it("overview State B trainer CTA includes trainerteam anchor in href", () => {
    const { container } = render(
      <PersonWorkspaceOverviewTab
        person={{
          ...makePerson({ isTrainer: true }),
          assignments: [trainerAssignment],
          squadMemberships: [],
          trainerMemberships: [],
        }}
        activeSeason={SEASON_ACTIVE}
      />,
    );
    const link = container.querySelector('[data-testid="incomplete-assignment-team-link"]') as HTMLAnchorElement | null;
    expect(link).toBeTruthy();
    expect(link?.href).toContain("#trainerteam");
  });

  it("overview State B trainer CTA wording is task-oriented", () => {
    renderOverview({
      person: { isTrainer: true },
      trainers: [],
      assignments: [trainerAssignment],
    });
    const content = document.body.textContent ?? "";
    expect(content).toContain("Trainer-Zuordnung vervollständigen");
    expect(content).not.toContain("Zum Team");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// L. NEW UX-ACCEPTANCE: Spieler CTA anchor precision
// ─────────────────────────────────────────────────────────────────────────────

describe("L. Spieler CTA deep-links to spielerkader anchor", () => {
  const playerAssignment = {
    id: "a-player-b",
    orgUnitId: "ou-1",
    teamId: TEAM_F2.id,
    seasonId: null,
    functionKey: "SPIELER",
    status: "ACTIVE",
    notes: null,
    orgUnit: { id: "ou-1", name: "Fussball", key: "fussball" },
    team: TEAM_F2,
    season: null,
  } as unknown as PersonAssignment;

  it("Spieler tab State B CTA href includes #spielerkader", () => {
    const { container } = render(
      <PersonSpielerTab
        squadMemberships={[]}
        assignments={[playerAssignment]}
        activeSeason={SEASON_ACTIVE}
      />,
    );
    const link = container.querySelector('[data-testid="spieler-incomplete-team-link"]') as HTMLAnchorElement | null;
    expect(link).toBeTruthy();
    expect(link?.href).toContain(`${TEAM_F2.id}#spielerkader`);
  });

  it("Spieler tab State B CTA wording is task-oriented", () => {
    render(
      <PersonSpielerTab
        squadMemberships={[]}
        assignments={[playerAssignment]}
        activeSeason={SEASON_ACTIVE}
      />,
    );
    const content = document.body.textContent ?? "";
    expect(content).toContain("Jetzt Kaderzuordnung ergänzen");
    expect(content).not.toContain("Zum Team");
  });

  it("Overview State B player CTA href includes #spielerkader", () => {
    const { container } = render(
      <PersonWorkspaceOverviewTab
        person={{
          ...makePerson({ isPlayer: true }),
          assignments: [playerAssignment],
          squadMemberships: [],
          trainerMemberships: [],
        }}
        activeSeason={SEASON_ACTIVE}
      />,
    );
    const link = container.querySelector('[data-testid="incomplete-assignment-team-link"]') as HTMLAnchorElement | null;
    expect(link).toBeTruthy();
    expect(link?.href).toContain("#spielerkader");
  });

  it("Spieler tab State A neutral card has no amber background", () => {
    const { container } = render(
      <PersonSpielerTab
        squadMemberships={[]}
        assignments={[]}
        activeSeason={SEASON_ACTIVE}
      />,
    );
    const nudge = container.querySelector('[data-testid="spieler-unassigned-nudge"]');
    expect(nudge).toBeTruthy();
    const classList = nudge?.className ?? "";
    expect(classList).not.toMatch(/bg-amber/);
  });

  it("Spieler tab section is labeled 'Aktuelle Spieler-Zuordnungen'", () => {
    render(
      <PersonSpielerTab
        squadMemberships={[]}
        assignments={[]}
        activeSeason={SEASON_ACTIVE}
      />,
    );
    const content = document.body.textContent ?? "";
    expect(content).toContain("Aktuelle Spieler-Zuordnungen");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// M. NEW UX-ACCEPTANCE: Trainer CTA anchor precision
// ─────────────────────────────────────────────────────────────────────────────

describe("M. Trainer CTA deep-links to trainerteam anchor", () => {
  const trainerAssignment = {
    id: "a-trainer-b2",
    orgUnitId: "ou-1",
    teamId: TEAM_E3.id,
    seasonId: null,
    functionKey: "TRAINER",
    status: "ACTIVE",
    notes: null,
    orgUnit: { id: "ou-1", name: "Fussball", key: "fussball" },
    team: TEAM_E3,
    season: null,
  } as unknown as PersonAssignment;

  it("Trainer tab State B CTA href includes #trainerteam", () => {
    const { container } = render(
      <PersonTrainerTab
        trainerMemberships={[]}
        assignments={[trainerAssignment]}
        activeSeason={SEASON_ACTIVE}
      />,
    );
    const link = container.querySelector('[data-testid="trainer-incomplete-team-link"]') as HTMLAnchorElement | null;
    expect(link).toBeTruthy();
    expect(link?.href).toContain(`${TEAM_E3.id}#trainerteam`);
  });

  it("Trainer tab State B CTA wording is task-oriented", () => {
    render(
      <PersonTrainerTab
        trainerMemberships={[]}
        assignments={[trainerAssignment]}
        activeSeason={SEASON_ACTIVE}
      />,
    );
    const content = document.body.textContent ?? "";
    expect(content).toContain("Trainer-Zuordnung vervollständigen");
    expect(content).not.toContain("Zum Team");
  });

  it("Trainer tab section is labeled 'Aktuelle Trainerteams'", () => {
    render(
      <PersonTrainerTab
        trainerMemberships={[]}
        assignments={[]}
        activeSeason={SEASON_ACTIVE}
      />,
    );
    const content = document.body.textContent ?? "";
    expect(content).toContain("Aktuelle Trainerteams");
  });

  it("Trainer tab State B shows season name", () => {
    render(
      <PersonTrainerTab
        trainerMemberships={[]}
        assignments={[trainerAssignment]}
        activeSeason={SEASON_ACTIVE}
      />,
    );
    const content = document.body.textContent ?? "";
    expect(content).toContain(SEASON_ACTIVE.name);
  });

  it("Trainer tab State B uses personFirstName in description", () => {
    render(
      <PersonTrainerTab
        trainerMemberships={[]}
        assignments={[trainerAssignment]}
        activeSeason={SEASON_ACTIVE}
        personFirstName="Michael"
      />,
    );
    const content = document.body.textContent ?? "";
    expect(content).toContain("Michael");
    expect(content).toContain("FC Allschwil Junioren E3");
  });

  it("Trainer tab State A neutral card has no amber background", () => {
    const { container } = render(
      <PersonTrainerTab
        trainerMemberships={[]}
        assignments={[]}
        activeSeason={SEASON_ACTIVE}
      />,
    );
    const nudge = container.querySelector('[data-testid="trainer-unassigned-nudge"]');
    expect(nudge).toBeTruthy();
    const classList = nudge?.className ?? "";
    expect(classList).not.toMatch(/bg-amber/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// N. NEW UX-ACCEPTANCE: No duplicate in Weitere Funktionen
// ─────────────────────────────────────────────────────────────────────────────

describe("N. No duplicate incomplete relationship in Weitere Funktionen", () => {
  it("incomplete trainer assignment not shown again in Weitere Funktionen", () => {
    const incompleteTrainer = {
      id: "a-trainer-dup",
      orgUnitId: "ou-1",
      teamId: TEAM_F2.id,
      seasonId: null,
      functionKey: "TRAINER",
      status: "ACTIVE",
      notes: null,
      orgUnit: { id: "ou-1", name: "Fussball", key: "fussball" },
      team: TEAM_F2,
      season: null,
    } as unknown as PersonAssignment;

    renderOverview({
      person: { isTrainer: true },
      trainers: [],
      assignments: [incompleteTrainer],
    });

    // Team name appears exactly once in the Trainer section, not duplicated in Weitere Funktionen
    const content = document.body.textContent ?? "";
    expect(content).toContain("FC Allschwil Junioren F2");
    // "Weitere Funktionen" heading must NOT appear (suppressed)
    expect(content).not.toContain("Weitere Funktionen");
  });

  it("incomplete player assignment not shown again in Weitere Funktionen", () => {
    const incompletePlayer = {
      id: "a-player-dup",
      orgUnitId: "ou-1",
      teamId: TEAM_F2.id,
      seasonId: null,
      functionKey: "SPIELER",
      status: "ACTIVE",
      notes: null,
      orgUnit: { id: "ou-1", name: "Fussball", key: "fussball" },
      team: TEAM_F2,
      season: null,
    } as unknown as PersonAssignment;

    renderOverview({
      person: { isPlayer: true },
      squads: [],
      assignments: [incompletePlayer],
    });

    const content = document.body.textContent ?? "";
    expect(content).toContain("FC Allschwil Junioren F2");
    // "Weitere Funktionen" heading must NOT appear (suppressed)
    expect(content).not.toContain("Weitere Funktionen");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// O. NEW UX-ACCEPTANCE: Sport tab warning appears before empty state
// ─────────────────────────────────────────────────────────────────────────────

describe("O. Sport tab incomplete warning appears before empty biography state", () => {
  const unseasonedAssignment = {
    id: "a-unseasoned-o",
    orgUnitId: "ou-1",
    teamId: "t-f2",
    seasonId: null,
    functionKey: "PLAYER",
    status: "ACTIVE",
    notes: null,
    orgUnit: { id: "ou-1", name: "Fussball", key: "fussball" },
    team: { id: "t-f2", name: "FC Allschwil Junioren F2", shortName: "F2" },
    season: null,
  } as unknown as PersonAssignment;

  it("Sport tab renders warning BEFORE the empty biography state in DOM order", () => {
    const { container } = render(
      <PersonSportTab
        personId="p-acc"
        squadMemberships={[]}
        trainerMemberships={[]}
        assignments={[unseasonedAssignment]}
      />,
    );

    const warning = container.querySelector('[data-testid="unseasoned-assignment-warning"]');
    const emptyHeading = Array.from(container.querySelectorAll("p, h3")).find(
      (el) => el.textContent?.includes("Noch keine Saison-Einträge"),
    );

    expect(warning).toBeTruthy();
    expect(emptyHeading).toBeTruthy();

    // Warning must appear before the empty state in the DOM
    if (warning && emptyHeading) {
      const position = warning.compareDocumentPosition(emptyHeading);
      // DOCUMENT_POSITION_FOLLOWING = 4: emptyHeading is after warning
      expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P. NEW UX-ACCEPTANCE: Multiple trainer teams all render (overview and tab)
// ─────────────────────────────────────────────────────────────────────────────

describe("P. Multiple trainer teams all render", () => {
  const trainerAssignmentF2 = {
    id: "a-tr-f2",
    orgUnitId: "ou-1",
    teamId: TEAM_F2.id,
    seasonId: null,
    functionKey: "TRAINER",
    status: "ACTIVE",
    notes: null,
    orgUnit: { id: "ou-1", name: "Fussball", key: "fussball" },
    team: TEAM_F2,
    season: null,
  } as unknown as PersonAssignment;
  const trainerAssignmentE3 = {
    id: "a-tr-e3",
    orgUnitId: "ou-1",
    teamId: TEAM_E3.id,
    seasonId: null,
    functionKey: "TRAINER",
    status: "ACTIVE",
    notes: null,
    orgUnit: { id: "ou-1", name: "Fussball", key: "fussball" },
    team: TEAM_E3,
    season: null,
  } as unknown as PersonAssignment;

  it("Trainer tab State B renders all incomplete assignments (not collapsed to one)", () => {
    render(
      <PersonTrainerTab
        trainerMemberships={[]}
        assignments={[trainerAssignmentF2, trainerAssignmentE3]}
        activeSeason={SEASON_ACTIVE}
      />,
    );
    const content = document.body.textContent ?? "";
    expect(content).toContain("FC Allschwil Junioren F2");
    expect(content).toContain("FC Allschwil Junioren E3");
  });

  it("overview State B renders all incomplete trainer assignments", () => {
    renderOverview({
      person: { isTrainer: true },
      trainers: [],
      assignments: [trainerAssignmentF2, trainerAssignmentE3],
    });
    const content = document.body.textContent ?? "";
    expect(content).toContain("FC Allschwil Junioren F2");
    expect(content).toContain("FC Allschwil Junioren E3");
  });
});
