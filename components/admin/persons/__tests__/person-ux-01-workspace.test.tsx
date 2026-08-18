/**
 * @vitest-environment jsdom
 *
 * components/admin/persons/__tests__/person-ux-01-workspace.test.tsx
 *
 * PERSON-UX-01 — Person 360° Workspace focused tests.
 *
 * Proves:
 * 1. Person Workspace renders canonical Person (name, status)
 * 2. Multiple simultaneous assignments/capacities render correctly
 * 3. Current Team relationships (squad + trainer + assignment) render
 * 4. Current OrgUnit relationships render correctly
 * 5. Person↔User/account state renders correctly
 * 6. Existing invite/delete actions remain authorized (Zugang tab)
 * 7. Season history does NOT invent unsupported history (only persisted data)
 * 8. Person with no sporting role still has a valid useful workspace
 * 9. Person with multiple roles is not collapsed to one role
 * 10. Responsive structure: tab bar wraps (no forced desktop-only layout)
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import PersonWorkspaceOverviewTab from "../PersonWorkspaceOverviewTab";
import PersonSportTab from "../PersonSportTab";
import PersonDetailTabs from "../PersonDetailTabs";
import PersonZugangTab from "../PersonZugangTab";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

// ── Shared fixture factories ──────────────────────────────────────────────────

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

function makePerson(overrides: Partial<PersonFixture> = {}): PersonFixture {
  return { ...BASE_PERSON, ...overrides };
}

const BASE_PERSON: PersonFixture = {
  id: "person-1",
  firstName: "Maria",
  lastName: "Muster",
  displayName: null,
  email: "maria@example.test",
  phone: "+41 79 000 00 00",
  dateOfBirth: new Date("1995-06-15"),
  notes: null,
  imageUrl: null,
  isActive: true,
  isPlayer: true,
  isTrainer: false,
  isFunctionary: false,
  isVolunteer: false,
  isReferee: false,
  isSponsorContact: false,
  customFunctions: [],
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

const SEASON_ACTIVE = {
  id: "season-2526",
  name: "2025/26",
  key: "2025-26",
  isActive: true,
  startDate: new Date("2025-08-01"),
  endDate: new Date("2026-05-31"),
};

const SEASON_PAST = {
  id: "season-2425",
  name: "2024/25",
  key: "2024-25",
  isActive: false,
  startDate: new Date("2024-08-01"),
  endDate: new Date("2025-05-31"),
};

const TEAM_A = { id: "team-a", name: "FC Allschwil 1", shortName: "FCA 1" };
const TEAM_B = { id: "team-b", name: "FC Allschwil 2", shortName: "FCA 2" };
const ORGUNIT_A = { id: "ou-a", name: "Aktive", key: "aktive" };

function makeSquadMembership(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "sq-1",
    status: "ACTIVE" as const,
    shirtNumber: 10,
    positionLabel: "Mittelfeld",
    isCaptain: false,
    isViceCaptain: false,
    remarks: null,
    teamSeason: {
      id: "ts-1",
      displayName: "FC Allschwil 1 2025/26",
      shortName: "FCA 1",
      participationType: "COMPETITION" as const,
      team: TEAM_A,
      season: SEASON_ACTIVE,
    },
    ...overrides,
  };
}

function makeTrainerMembership(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "tr-1",
    status: "ACTIVE" as const,
    roleLabel: "Trainer/in",
    remarks: null,
    teamSeason: {
      id: "ts-2",
      displayName: "FC Allschwil 2 2025/26",
      shortName: "FCA 2",
      team: TEAM_B,
      season: SEASON_ACTIVE,
    },
    ...overrides,
  };
}

function makeAssignment(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "a-1",
    orgUnitId: "ou-a",
    teamId: null,
    seasonId: null,
    functionKey: "KOORDINATOR",
    status: "ACTIVE" as const,
    notes: null,
    orgUnit: ORGUNIT_A,
    team: null,
    season: null,
    tenantId: "tenant-1",
    createdAt: new Date("2023-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

const NO_ACCESS_CARD = null;
const ACCESS_CARD_NO_USER = {
  linkedUser: null,
  isActiveTenantMember: false,
  roles: [],
  assignedRoleIds: [],
  canAssign: true,
};
const ACCESS_CARD_WITH_USER = {
  linkedUser: { id: "user-1", email: "maria@example.test" },
  isActiveTenantMember: true,
  roles: [{ id: "r1", name: "Club Admin", isSystem: true, isArchived: false, activeAssigneeCount: 2 }],
  assignedRoleIds: ["r1"],
  canAssign: true,
};

afterEach(() => {
  vi.restoreAllMocks();
});

// ── 1. Person Workspace renders canonical Person ──────────────────────────────

describe("1. PersonWorkspaceOverviewTab — renders canonical Person", () => {
  it("renders the identity section with active status", () => {
    const person = makePerson();
    render(
      <PersonWorkspaceOverviewTab
        person={{ ...person, assignments: [], squadMemberships: [], trainerMemberships: [] }}
        activeSeason={SEASON_ACTIVE}
      />,
    );
    expect(screen.getByText("Status")).toBeTruthy();
    expect(screen.getByText("Aktiv")).toBeTruthy();
    expect(screen.getByText(SEASON_ACTIVE.name)).toBeTruthy();
  });

  it("shows inactive status correctly", () => {
    const person = makePerson({ isActive: false });
    render(
      <PersonWorkspaceOverviewTab
        person={{ ...person, assignments: [], squadMemberships: [], trainerMemberships: [] }}
        activeSeason={null}
      />,
    );
    expect(screen.getByText("Inaktiv")).toBeTruthy();
  });

  it("renders birth date and age when available", () => {
    const person = makePerson({ dateOfBirth: new Date("1995-06-15") });
    render(
      <PersonWorkspaceOverviewTab
        person={{ ...person, assignments: [], squadMemberships: [], trainerMemberships: [] }}
        activeSeason={null}
      />,
    );
    expect(screen.getByText("Geburtsdatum")).toBeTruthy();
    // Date is rendered somewhere in the output
    const content = document.body.textContent ?? "";
    expect(content).toContain("1995");
  });
});

// ── 2. Multiple simultaneous assignments/capacities ───────────────────────────

describe("2. Multiple simultaneous roles — all render, none collapsed", () => {
  it("renders squad membership AND trainer membership AND assignment simultaneously", () => {
    const person = makePerson();
    render(
      <PersonWorkspaceOverviewTab
        person={{
          ...person,
          assignments: [makeAssignment()],
          squadMemberships: [makeSquadMembership()],
          trainerMemberships: [makeTrainerMembership()],
        }}
        activeSeason={SEASON_ACTIVE}
      />,
    );

    // All three roles must be visible — none collapsed to a single "primary"
    // Note: "Spieler/in" may appear in both the CapacitiesRow (profile badge) AND
    // the role card (active assignment). Use getAllByText for multi-occurrence labels.
    expect(screen.getAllByText("Spieler/in").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Trainer/in").length).toBeGreaterThan(0);
    expect(screen.getByText("Koordinator/in")).toBeTruthy();
  });

  it("9. shows multiple role badges without reducing to one", () => {
    const person = makePerson();
    const { container } = render(
      <PersonWorkspaceOverviewTab
        person={{
          ...person,
          assignments: [
            makeAssignment({ functionKey: "KOORDINATOR" }),
            makeAssignment({ id: "a-2", functionKey: "VORSTANDSMITGLIED", orgUnit: { id: "ou-b", name: "Vorstand", key: "vorstand" } }),
          ],
          squadMemberships: [makeSquadMembership()],
          trainerMemberships: [],
        }}
        activeSeason={null}
      />,
    );

    // "Spieler/in" may appear in CapacitiesRow (profile) AND role card (assignment)
    expect(screen.getAllByText("Spieler/in").length).toBeGreaterThan(0);
    expect(screen.getByText("Koordinator/in")).toBeTruthy();
    expect(screen.getByText("Vorstandsmitglied")).toBeTruthy();

    // Must have at least 3 role cards (sce-accent badges)
    const roleBadges = container.querySelectorAll(".rounded-full.bg-\\[var\\(--sce-accent\\)\\]");
    expect(roleBadges.length).toBeGreaterThanOrEqual(3);
  });
});

// ── 3. Team relationships render correctly ────────────────────────────────────

describe("3. Current Team relationships", () => {
  it("renders squad team name", () => {
    const person = makePerson();
    render(
      <PersonWorkspaceOverviewTab
        person={{
          ...person,
          assignments: [],
          squadMemberships: [makeSquadMembership()],
          trainerMemberships: [],
        }}
        activeSeason={null}
      />,
    );
    expect(screen.getAllByText(TEAM_A.name).length).toBeGreaterThan(0);
  });

  it("renders trainer team name", () => {
    const person = makePerson();
    render(
      <PersonWorkspaceOverviewTab
        person={{
          ...person,
          assignments: [],
          squadMemberships: [],
          trainerMemberships: [makeTrainerMembership()],
        }}
        activeSeason={null}
      />,
    );
    expect(screen.getAllByText(TEAM_B.name).length).toBeGreaterThan(0);
  });

  it("renders assignment team name when present", () => {
    const person = makePerson();
    const assignmentWithTeam = makeAssignment({ teamId: "team-a", team: TEAM_A });
    render(
      <PersonWorkspaceOverviewTab
        person={{
          ...person,
          assignments: [assignmentWithTeam],
          squadMemberships: [],
          trainerMemberships: [],
        }}
        activeSeason={null}
      />,
    );
    expect(screen.getAllByText(TEAM_A.name).length).toBeGreaterThan(0);
  });

  it("shows active teams in the identity section", () => {
    const person = makePerson();
    render(
      <PersonWorkspaceOverviewTab
        person={{
          ...person,
          assignments: [],
          squadMemberships: [makeSquadMembership()],
          trainerMemberships: [makeTrainerMembership()],
        }}
        activeSeason={null}
      />,
    );
    expect(screen.getByText("Aktuelle Teams")).toBeTruthy();
    const content = document.body.textContent ?? "";
    expect(content).toContain(TEAM_A.name);
    expect(content).toContain(TEAM_B.name);
  });
});

// ── 4. OrgUnit relationships ──────────────────────────────────────────────────

describe("4. OrgUnit relationships render correctly", () => {
  it("renders OrgUnit name from assignment", () => {
    const person = makePerson();
    render(
      <PersonWorkspaceOverviewTab
        person={{
          ...person,
          assignments: [makeAssignment()],
          squadMemberships: [],
          trainerMemberships: [],
        }}
        activeSeason={null}
      />,
    );
    const content = document.body.textContent ?? "";
    expect(content).toContain(ORGUNIT_A.name);
  });

  it("shows OrgUnits in identity section", () => {
    const person = makePerson();
    render(
      <PersonWorkspaceOverviewTab
        person={{
          ...person,
          assignments: [makeAssignment()],
          squadMemberships: [],
          trainerMemberships: [],
        }}
        activeSeason={null}
      />,
    );
    expect(screen.getByText("Organisationseinheiten")).toBeTruthy();
  });
});

// ── 5. Person↔User/account state ─────────────────────────────────────────────

describe("5. Person↔User/account state", () => {
  it("shows 'Kein Benutzerkonto verknüpft' when user is null", () => {
    const person = makePerson({ user: null, userId: null });
    render(
      <PersonWorkspaceOverviewTab
        person={{ ...person, assignments: [], squadMemberships: [], trainerMemberships: [] }}
        activeSeason={null}
      />,
    );
    expect(screen.getByText("Kein Benutzerkonto verknüpft")).toBeTruthy();
  });

  it("shows 'Benutzerkonto verknüpft' and email when user is linked", () => {
    const person = makePerson({
      userId: "user-1",
      user: { id: "user-1", email: "maria@example.test", isActive: true },
    });
    render(
      <PersonWorkspaceOverviewTab
        person={{ ...person, assignments: [], squadMemberships: [], trainerMemberships: [] }}
        activeSeason={null}
      />,
    );
    expect(screen.getByText("Benutzerkonto verknüpft")).toBeTruthy();
    expect(screen.getByText("maria@example.test")).toBeTruthy();
  });

  it("shows 'Konto deaktiviert' warning for inactive user", () => {
    const person = makePerson({
      userId: "user-1",
      user: { id: "user-1", email: "old@example.test", isActive: false },
    });
    render(
      <PersonWorkspaceOverviewTab
        person={{ ...person, assignments: [], squadMemberships: [], trainerMemberships: [] }}
        activeSeason={null}
      />,
    );
    expect(screen.getByText("Konto deaktiviert")).toBeTruthy();
  });
});

// ── 6. Zugang tab — invite/delete actions remain authorized ───────────────────

describe("6. Zugang tab — access management", () => {
  it("shows no-permission message when accessRolesCard is null", () => {
    render(
      <PersonZugangTab personId="person-1" accessRolesCard={NO_ACCESS_CARD} />,
    );
    expect(screen.getByText(/Keine Berechtigung/)).toBeTruthy();
  });

  it("shows 'Kein Benutzerkonto verknüpft' when no user linked and canAssign is true", () => {
    render(
      <PersonZugangTab personId="person-1" accessRolesCard={ACCESS_CARD_NO_USER} />,
    );
    expect(screen.getByText("Kein Benutzerkonto verknüpft")).toBeTruthy();
    // Picker button should be visible since canAssign=true
    expect(screen.getByText("Benutzerkonto verknüpfen")).toBeTruthy();
  });

  it("shows linked user email in Zugang tab", () => {
    render(
      <PersonZugangTab personId="person-1" accessRolesCard={ACCESS_CARD_WITH_USER} />,
    );
    expect(screen.getByText("maria@example.test")).toBeTruthy();
  });

  it("shows security principle notice", () => {
    render(
      <PersonZugangTab personId="person-1" accessRolesCard={ACCESS_CARD_NO_USER} />,
    );
    expect(screen.getByText(/Sicherheitsprinzip/)).toBeTruthy();
  });
});

// ── 7. Season history does NOT invent unsupported history ─────────────────────

describe("7. Season history — only persisted data, no fabrication", () => {
  it("shows empty state when no squad/trainer memberships exist", () => {
    render(
      <PersonSportTab
        personId="p-test"
        squadMemberships={[]}
        trainerMemberships={[]}
        assignments={[]}
      />,
    );
    expect(screen.getByText("Noch keine Saison-Einträge")).toBeTruthy();
  });

  it("renders only seasons that have persisted squad/trainer data", () => {
    render(
      <PersonSportTab
        personId="p-test"
        squadMemberships={[makeSquadMembership()]}
        trainerMemberships={[]}
        assignments={[]}
      />,
    );
    // Only SEASON_ACTIVE should appear — no fabricated seasons
    expect(screen.getByText(SEASON_ACTIVE.name)).toBeTruthy();
    expect(screen.queryByText(SEASON_PAST.name)).toBeNull();
  });

  it("renders both seasons when data exists for both", () => {
    const pastSquad = makeSquadMembership({
      id: "sq-2",
      teamSeason: {
        id: "ts-3",
        displayName: "FC Allschwil 1 2024/25",
        shortName: "FCA 1",
        participationType: "COMPETITION",
        team: TEAM_A,
        season: SEASON_PAST,
      },
    });
    render(
      <PersonSportTab
        personId="p-test"
        squadMemberships={[makeSquadMembership(), pastSquad]}
        trainerMemberships={[]}
        assignments={[]}
      />,
    );
    expect(screen.getByText(SEASON_ACTIVE.name)).toBeTruthy();
    expect(screen.getByText(SEASON_PAST.name)).toBeTruthy();
  });

  it("shows gap notice for active assignments without seasonId", () => {
    render(
      <PersonSportTab
        personId="p-test"
        squadMemberships={[]}
        trainerMemberships={[]}
        assignments={[makeAssignment()]} // no seasonId
      />,
    );
    expect(screen.getByText(/keine Saison-Verknüpfung/)).toBeTruthy();
  });

  it("does NOT show gap notice when all active assignments have a seasonId", () => {
    const aWithSeason = makeAssignment({
      seasonId: SEASON_ACTIVE.id,
      season: SEASON_ACTIVE,
    });
    render(
      <PersonSportTab
        personId="p-test"
        squadMemberships={[]}
        trainerMemberships={[]}
        assignments={[aWithSeason]}
      />,
    );
    expect(screen.queryByText(/keine Saison-Verknüpfung/)).toBeNull();
  });
});

// ── 8. Person with no sporting role still has a valid workspace ───────────────

describe("8. Person with no sporting role", () => {
  it("renders Übersicht without crashing when all sport arrays are empty", () => {
    const adminPerson = makePerson({ isPlayer: false, isTrainer: false });
    render(
      <PersonWorkspaceOverviewTab
        person={{
          ...adminPerson,
          assignments: [makeAssignment({ functionKey: "VORSTANDSMITGLIED" })],
          squadMemberships: [],
          trainerMemberships: [],
        }}
        activeSeason={null}
      />,
    );
    expect(screen.getByText("Vorstandsmitglied")).toBeTruthy();
    // No crash — valid workspace
    expect(screen.getByText("Identität & Status")).toBeTruthy();
  });

  it("shows 'Noch keine Zuordnung' empty state for a Person with no assignments at all", () => {
    const newPerson = makePerson({ isPlayer: false, isTrainer: false });
    render(
      <PersonWorkspaceOverviewTab
        person={{
          ...newPerson,
          assignments: [],
          squadMemberships: [],
          trainerMemberships: [],
        }}
        activeSeason={null}
      />,
    );
    expect(screen.getByText("Noch keine Zuordnung")).toBeTruthy();
  });
});

// ── 9. Person with multiple roles is not collapsed to one ─────────────────────
// (Covered above in test 2 — explicit label here for cross-reference)

// ── 10. Responsive structure — tab bar wraps ──────────────────────────────────

describe("10. Responsive tab structure", () => {
  it("renders base tabs for a person with no sporting history when viewer holds all domain permissions", () => {
    // PERSON-UX-02: sports tabs are hidden when Person has no sporting evidence.
    // PERSON-UX-03: sensitive domain tabs only appear with the corresponding
    // domain permission. Pass all flags=true to assert the full domain workspace.
    const allDomainPerms = {
      canViewFinance: true,
      canManageFinance: true,
      canViewHealth: true,
      canManageHealth: true,
      canViewPrivateDocuments: true,
      canManagePrivateDocuments: true,
      canViewDevelopment: true,
      canManageDevelopment: true,
      canViewAssessments: true,
      canManageAssessments: true,
      canViewAudit: true,
    };
    const person = makePerson({ isPlayer: false, isTrainer: false });
    render(
      <PersonDetailTabs
        person={{ ...person, assignments: [], squadMemberships: [], trainerMemberships: [] }}
        canManage={true}
        canDelete={true}
        orgUnits={[]}
        teams={[]}
        activeSeason={null}
        accessRolesCard={ACCESS_CARD_NO_USER}
        domainPermissions={allDomainPerms}
      />,
    );

    // Base tabs always present
    expect(screen.getByText("Übersicht")).toBeTruthy();
    expect(screen.getByText("Stammdaten")).toBeTruthy();
    expect(screen.getByText("Organisation")).toBeTruthy();
    expect(screen.getByText("Mitgliedschaft")).toBeTruthy();
    expect(screen.getByText("Finanzen")).toBeTruthy();
    expect(screen.getByText("Gesundheit")).toBeTruthy();
    expect(screen.getByText("Dokumente")).toBeTruthy();
    expect(screen.getByText("Zugang")).toBeTruthy();

    // Sports tabs are hidden — zero DOM presence (no sporting evidence)
    expect(screen.queryByText("Spieler")).toBeNull();
    expect(screen.queryByText("Trainer")).toBeNull();
    expect(screen.queryByText("Sport & Entwicklung")).toBeNull();
  });

  it("renders all sports tabs for a person with both player and trainer history", () => {
    // PERSON-UX-03: domain tabs require explicit viewer permissions.
    // PERSON-UX-07: Spieler/Trainer tabs driven by isPlayer/isTrainer flags.
    const person = makePerson({ isPlayer: true, isTrainer: true });
    render(
      <PersonDetailTabs
        person={{
          ...person,
          assignments: [],
          squadMemberships: [makeSquadMembership()],
          trainerMemberships: [makeTrainerMembership()],
        }}
        canManage={true}
        canDelete={true}
        orgUnits={[]}
        teams={[]}
        activeSeason={null}
        accessRolesCard={ACCESS_CARD_NO_USER}
        domainPermissions={{
          canViewFinance: true,
          canManageFinance: false,
          canViewHealth: true,
          canManageHealth: false,
          canViewPrivateDocuments: true,
          canManagePrivateDocuments: false,
          canViewDevelopment: false,
          canManageDevelopment: false,
          canViewAssessments: false,
          canManageAssessments: false,
          canViewAudit: false,
        }}
      />,
    );

    // All tabs including dynamic ones
    expect(screen.getByText("Übersicht")).toBeTruthy();
    expect(screen.getByText("Stammdaten")).toBeTruthy();
    expect(screen.getByText("Organisation")).toBeTruthy();
    expect(screen.getByText("Spieler")).toBeTruthy();
    expect(screen.getByText("Trainer")).toBeTruthy();
    expect(screen.getByText("Sport & Entwicklung")).toBeTruthy();
    expect(screen.getByText("Mitgliedschaft")).toBeTruthy();
    expect(screen.getByText("Finanzen")).toBeTruthy();
    expect(screen.getByText("Gesundheit")).toBeTruthy();
    expect(screen.getByText("Dokumente")).toBeTruthy();
    expect(screen.getByText("Zugang")).toBeTruthy();
  });

  it("renders only non-sensitive tabs when no domain permissions are provided", () => {
    // PERSON-UX-03: without domain permissions, sensitive tabs (Finanzen,
    // Gesundheit, Dokumente) must be completely absent — no locked state or hint.
    // PERSON-UX-02: sports tabs require sporting evidence; person with a squad
    // membership gets Sport & Entwicklung, but person with no evidence does not.
    const person = makePerson();
    render(
      <PersonDetailTabs
        person={{
          ...person,
          assignments: [],
          squadMemberships: [makeSquadMembership()],
          trainerMemberships: [],
        }}
        canManage={true}
        canDelete={true}
        orgUnits={[]}
        teams={[]}
        activeSeason={null}
        accessRolesCard={ACCESS_CARD_NO_USER}
        // domainPermissions omitted — defaults to fail-closed
      />,
    );

    // Non-sensitive tabs present
    expect(screen.getByText("Übersicht")).toBeTruthy();
    expect(screen.getByText("Stammdaten")).toBeTruthy();
    expect(screen.getByText("Organisation")).toBeTruthy();
    // Sport & Entwicklung is visible: person has squad membership (non-sensitive)
    expect(screen.getByText("Sport & Entwicklung")).toBeTruthy();
    expect(screen.getByText("Mitgliedschaft")).toBeTruthy();
    expect(screen.getByText("Zugang")).toBeTruthy();

    // Sensitive domain tabs absent — fail-closed
    expect(screen.queryByText("Finanzen")).toBeNull();
    expect(screen.queryByText("Gesundheit")).toBeNull();
    expect(screen.queryByText("Dokumente")).toBeNull();
  });

  it("tab nav uses flex-wrap (not overflow-x-scroll) for responsive wrapping", () => {
    const person = makePerson();
    const { container } = render(
      <PersonDetailTabs
        person={{ ...person, assignments: [], squadMemberships: [], trainerMemberships: [] }}
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

  it("switches tab content when a tab button is clicked", () => {
    const person = makePerson();
    render(
      <PersonDetailTabs
        person={{ ...person, assignments: [], squadMemberships: [], trainerMemberships: [] }}
        canManage={false}
        canDelete={false}
        orgUnits={[]}
        teams={[]}
        activeSeason={null}
        accessRolesCard={ACCESS_CARD_NO_USER}
      />,
    );

    // Initially on Übersicht
    expect(screen.getByText("Identität & Status")).toBeTruthy();

    // Click Zugang
    fireEvent.click(screen.getByRole("tab", { name: /Zugang/ }));
    expect(screen.getByText(/Sicherheitsprinzip/)).toBeTruthy();
  });

  it("Sport & Entwicklung tab shows season content", () => {
    const person = makePerson();
    render(
      <PersonDetailTabs
        person={{
          ...person,
          assignments: [],
          squadMemberships: [makeSquadMembership()],
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

    fireEvent.click(screen.getByRole("tab", { name: /Sport & Entwicklung/ }));

    expect(screen.getByText("Saison-Biografie")).toBeTruthy();
    expect(screen.getByText(SEASON_ACTIVE.name)).toBeTruthy();
  });

  it("deferred tabs show placeholder content without fake data when permissions are present", () => {
    // PERSON-UX-03: Gesundheit and Dokumente are only rendered when the viewer
    // holds the corresponding domain permission. Pass the flags to verify the
    // placeholder content renders correctly (no fake data shown).
    const person = makePerson();
    render(
      <PersonDetailTabs
        person={{ ...person, assignments: [], squadMemberships: [], trainerMemberships: [] }}
        canManage={false}
        canDelete={false}
        orgUnits={[]}
        teams={[]}
        activeSeason={null}
        accessRolesCard={null}
        domainPermissions={{
          canViewFinance: false,
          canManageFinance: false,
          canViewHealth: true,
          canManageHealth: false,
          canViewPrivateDocuments: true,
          canManagePrivateDocuments: false,
          canViewDevelopment: false,
          canManageDevelopment: false,
          canViewAssessments: false,
          canManageAssessments: false,
          canViewAudit: false,
        }}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: /Gesundheit/ }));
    // Must show the health placeholder title (no restricted note in new placeholder)
    expect(screen.getAllByText("Gesundheit").length).toBeGreaterThanOrEqual(2); // tab + placeholder title

    fireEvent.click(screen.getByRole("tab", { name: /Dokumente/ }));
    // "Persönliche Dokumente" appears as the placeholder title
    expect(screen.getAllByText(/Persönliche Dokumente/).length).toBeGreaterThan(0);
  });
});
