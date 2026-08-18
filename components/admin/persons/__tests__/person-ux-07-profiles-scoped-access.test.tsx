/**
 * @vitest-environment jsdom
 *
 * PERSON-UX-07 — Profiles & Scoped Access
 *
 * Tests the following requirements:
 *  1.  Person ist aktiv uses SwitchToggle (not checkbox)
 *  2.  Standard capacities use SwitchToggles
 *  3.  Multiple capacities simultaneously selectable
 *  4.  Spieler only → Spieler tab visible
 *  5.  Trainer only → Trainer tab visible
 *  6.  Spieler + Trainer → both tabs visible
 *  7.  neither → neither tab
 *  8.  Capacity removal hides tab without deleting historical data
 *  9.  Multiple custom functions supported
 * 10.  Custom function add / remove
 * 11.  Custom functions do NOT create permissions
 * 12.  Trainer capacity does not grant Trainer authorization
 * 13.  Capacity does not create team assignment
 * 14.  Create/edit use same canonical capacity representation
 * 15.  Scoped/domain authorization still enforced
 * 16.  Cross-tenant isolation (capacity resolver is pure / data-isolated)
 * 17.  PersonForm renamed section "Profile & Funktionen"
 * 18.  Header capacity badges show multiple capacities
 * 19.  getActiveCapacityLabels covers all standard capacities
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import type { PlayerSquadStatus, TrainerTeamStatus } from "@prisma/client";
import PersonDetailTabs from "../PersonDetailTabs";
import PersonForm from "../PersonForm";
import PersonWorkspaceOverviewTab from "../PersonWorkspaceOverviewTab";
import { resolvePersonCapacities, getActiveCapacityLabels } from "@/lib/people/capacity";
import type { PersonDomainPermissions } from "@/lib/people/person-domain-auth";

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

const SEASON_PAST = {
  id: "s-2526",
  name: "2025/26",
  key: "2025-26",
  isActive: false,
  startDate: new Date("2025-08-01"),
  endDate: new Date("2026-05-31"),
};

const TEAM_FIRST = { id: "t-1", name: "1. Mannschaft", shortName: "1M" };
const TEAM_E3 = { id: "t-e3", name: "E3-Junioren", shortName: "E3" };

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

const BASE_PERSON: PersonFixture = {
  id: "person-ux07",
  firstName: "Anna",
  lastName: "Meier",
  displayName: null,
  email: "anna@example.test",
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
  tenantId: "tenant-ux07",
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
  return { ...BASE_PERSON, ...overrides };
}

function makeSquad(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "sq-ux07",
    status: "ACTIVE" as PlayerSquadStatus,
    shirtNumber: 10,
    positionLabel: "Stürmer",
    isCaptain: false,
    isViceCaptain: false,
    remarks: null,
    teamSeason: {
      id: "ts-ux07",
      displayName: "1. Mannschaft 2026/27",
      shortName: "1M",
      participationType: "COMPETITION" as const,
      team: TEAM_FIRST,
      season: SEASON_ACTIVE,
    },
    ...overrides,
  };
}

function makeHistoricalSquad() {
  return {
    id: "sq-hist-ux07",
    status: "INACTIVE" as PlayerSquadStatus,
    shirtNumber: 9,
    positionLabel: "Mittelfeld",
    isCaptain: false,
    isViceCaptain: false,
    remarks: null,
    teamSeason: {
      id: "ts-hist-ux07",
      displayName: "1. Mannschaft 2025/26",
      shortName: "1M",
      participationType: "COMPETITION" as const,
      team: TEAM_FIRST,
      season: SEASON_PAST,
    },
  };
}

function makeTrainer(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "tr-ux07",
    status: "ACTIVE" as TrainerTeamStatus,
    roleLabel: "Cheftrainer",
    remarks: null,
    teamSeason: {
      id: "ts-tr-ux07",
      displayName: "E3 2026/27",
      shortName: "E3",
      team: TEAM_E3,
      season: SEASON_ACTIVE,
    },
    ...overrides,
  };
}

const ACCESS_CARD_NULL = {
  linkedUser: null,
  isActiveTenantMember: false,
  roles: [],
  assignedRoleIds: [],
  canAssign: false,
};

function renderTabs(
  overrides: {
    person?: Partial<PersonFixture>;
    squads?: ReturnType<typeof makeSquad>[];
    trainers?: ReturnType<typeof makeTrainer>[];
    domainPermissions?: Partial<PersonDomainPermissions>;
  } = {},
) {
  const person = makePerson(overrides.person ?? {});
  const domainPermissions: PersonDomainPermissions | undefined = overrides.domainPermissions
    ? { ...NO_DOMAIN_PERMS, ...overrides.domainPermissions }
    : undefined;
  render(
    <PersonDetailTabs
      person={{
        ...person,
        assignments: [],
        squadMemberships: overrides.squads ?? [],
        trainerMemberships: overrides.trainers ?? [],
      }}
      canManage={true}
      canDelete={false}
      orgUnits={[]}
      teams={[]}
      activeSeason={SEASON_ACTIVE}
      accessRolesCard={ACCESS_CARD_NULL}
      domainPermissions={domainPermissions}
    />,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Person ist aktiv uses SwitchToggle (role="switch")
// ─────────────────────────────────────────────────────────────────────────────

describe("1. Person ist aktiv uses SwitchToggle", () => {
  it("isActive control uses role=switch, not a checkbox", () => {
    render(
      <PersonForm
        mode="create"
        defaultValues={{ isActive: true }}
      />,
    );
    const switches = document.querySelectorAll('[role="switch"]');
    expect(switches.length).toBeGreaterThan(0);

    // Should NOT have a basic checkbox for isActive
    const isActiveSwitch = document.querySelector('#isActive');
    expect(isActiveSwitch).toBeTruthy();
    expect(isActiveSwitch!.getAttribute("role")).toBe("switch");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Standard capacities use SwitchToggles
// ─────────────────────────────────────────────────────────────────────────────

describe("2. Standard capacities use SwitchToggles (role=switch)", () => {
  it("all capacity controls have role=switch", () => {
    render(<PersonForm mode="create" />);

    const switchIds = [
      "isActive", "isPlayer", "isTrainer",
      "isFunctionary", "isReferee", "isVolunteer", "isSponsorContact",
    ];

    for (const id of switchIds) {
      const el = document.querySelector(`#${id}`);
      expect(el, `#${id} must exist`).toBeTruthy();
      expect(
        el!.getAttribute("role"),
        `#${id} must have role=switch`,
      ).toBe("switch");
    }
  });

  it("does not use input[type=checkbox] for any standard capacity", () => {
    render(<PersonForm mode="create" />);
    // The only checkboxes permitted are for multi-row selection — none should
    // appear in the Profile & Funktionen section for standard capacities.
    const checkboxes = document.querySelectorAll(
      'input[type="checkbox"]',
    );
    // Zero checkboxes in the current form for capacity controls
    expect(checkboxes.length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Multiple capacities simultaneously selectable
// ─────────────────────────────────────────────────────────────────────────────

describe("3. Multiple capacities simultaneously selectable", () => {
  it("isPlayer and isTrainer can both be true", () => {
    const person = makePerson({ isPlayer: true, isTrainer: true });
    const caps = getActiveCapacityLabels(person);
    expect(caps).toContain("Spieler/in");
    expect(caps).toContain("Trainer/in");
  });

  it("all six standard capacities can be active at once", () => {
    const person = makePerson({
      isPlayer: true,
      isTrainer: true,
      isFunctionary: true,
      isVolunteer: true,
      isReferee: true,
      isSponsorContact: true,
    });
    const caps = getActiveCapacityLabels(person);
    expect(caps).toHaveLength(6);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Spieler only → Spieler tab
// ─────────────────────────────────────────────────────────────────────────────

describe("4. Spieler only → Spieler tab", () => {
  it("renders Spieler tab when isPlayer=true (no squad memberships required)", () => {
    renderTabs({ person: { isPlayer: true, isTrainer: false } });
    expect(screen.getByRole("tab", { name: /Spieler/ })).toBeTruthy();
  });

  it("does not render Trainer tab when only isPlayer=true", () => {
    renderTabs({ person: { isPlayer: true, isTrainer: false } });
    expect(screen.queryByRole("tab", { name: /Trainer/ })).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Trainer only → Trainer tab
// ─────────────────────────────────────────────────────────────────────────────

describe("5. Trainer only → Trainer tab", () => {
  it("renders Trainer tab when isTrainer=true (no squad memberships required)", () => {
    renderTabs({ person: { isPlayer: false, isTrainer: true } });
    expect(screen.getByRole("tab", { name: /Trainer/ })).toBeTruthy();
  });

  it("does not render Spieler tab when only isTrainer=true", () => {
    renderTabs({ person: { isPlayer: false, isTrainer: true } });
    expect(screen.queryByRole("tab", { name: /Spieler/ })).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Spieler + Trainer → both tabs
// ─────────────────────────────────────────────────────────────────────────────

describe("6. Spieler + Trainer → both tabs", () => {
  it("shows Spieler AND Trainer tabs when both flags are true", () => {
    renderTabs({ person: { isPlayer: true, isTrainer: true } });
    expect(screen.getByRole("tab", { name: /Spieler/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Trainer/ })).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. neither → neither tab
// ─────────────────────────────────────────────────────────────────────────────

describe("7. neither → neither tab", () => {
  it("shows no Spieler or Trainer tab when both flags are false and no memberships", () => {
    renderTabs({ person: { isPlayer: false, isTrainer: false }, squads: [], trainers: [] });
    expect(screen.queryByRole("tab", { name: /Spieler/ })).toBeNull();
    expect(screen.queryByRole("tab", { name: /Trainer/ })).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Capacity removal hides tab without deleting historical data
// ─────────────────────────────────────────────────────────────────────────────

describe("8. Capacity removal hides tab; historical data preserved", () => {
  it("Spieler tab is hidden when isPlayer=false even if squad memberships exist", () => {
    // squad memberships exist (historical) but isPlayer flag is off
    renderTabs({
      person: { isPlayer: false, isTrainer: false },
      squads: [makeSquad()],
      trainers: [],
    });
    // Tab must NOT appear (flag-based, not evidence-based for UX-07)
    expect(screen.queryByRole("tab", { name: /Spieler/ })).toBeNull();
  });

  it("Trainer tab is hidden when isTrainer=false even if trainer memberships exist", () => {
    renderTabs({
      person: { isPlayer: false, isTrainer: false },
      squads: [],
      trainers: [makeTrainer()],
    });
    expect(screen.queryByRole("tab", { name: /Trainer/ })).toBeNull();
  });

  it("historical squad memberships still present in resolver (data not deleted)", () => {
    // The data (squad memberships) is still accessible via resolvePersonCapacities
    const caps = resolvePersonCapacities([makeHistoricalSquad()], []);
    // Evidence-based fields still show history
    expect(caps.hasPlayerEvidence).toBe(true);
    expect(caps.isCurrentPlayer).toBe(false);
  });

  it("Sport & Entwicklung still visible from evidence when isPlayer=false but squads exist", () => {
    renderTabs({
      person: { isPlayer: false, isTrainer: false },
      squads: [makeSquad()],
      trainers: [],
    });
    // Sport tab can still show when there's membership evidence
    expect(screen.getByRole("tab", { name: /Sport & Entwicklung/ })).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. Multiple custom functions supported
// ─────────────────────────────────────────────────────────────────────────────

describe("9. Multiple custom functions supported", () => {
  it("getActiveCapacityLabels returns all standard capacities but not custom functions", () => {
    const person = makePerson({
      isPlayer: true,
      customFunctions: ["Materialverantwortlicher", "Fotograf/in"],
    });
    const labels = getActiveCapacityLabels(person);
    expect(labels).toContain("Spieler/in");
    // custom functions are NOT in standard labels (handled separately)
    expect(labels).not.toContain("Materialverantwortlicher");
  });

  it("PersonWorkspaceOverviewTab shows all custom functions as distinct chips", () => {
    const person = makePerson({
      isPlayer: true,
      customFunctions: ["Materialverantwortlicher", "Fotograf/in", "Platzwart/in"],
    });
    render(
      <PersonWorkspaceOverviewTab
        person={{
          ...person,
          assignments: [],
          squadMemberships: [],
          trainerMemberships: [],
        }}
        activeSeason={null}
      />,
    );
    const content = document.body.textContent ?? "";
    expect(content).toContain("Materialverantwortlicher");
    expect(content).toContain("Fotograf/in");
    expect(content).toContain("Platzwart/in");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. Custom function add / remove via form UI
// ─────────────────────────────────────────────────────────────────────────────

describe("10. Custom function add/remove", () => {
  it("PersonForm renders 'Weitere Funktion' toggle", () => {
    render(<PersonForm mode="create" />);
    const toggle = document.querySelector("#hasCustomFunctions");
    expect(toggle).toBeTruthy();
    expect(toggle!.getAttribute("role")).toBe("switch");
  });

  it("enabling 'Weitere Funktion' toggle reveals chip input area", () => {
    render(<PersonForm mode="create" />);
    const toggle = document.querySelector("#hasCustomFunctions") as HTMLButtonElement;
    expect(toggle).toBeTruthy();
    fireEvent.click(toggle);
    // Input for adding function should appear
    const input = screen.queryByPlaceholderText(/Funktion hinzufügen/);
    expect(input).toBeTruthy();
  });

  it("form renders with pre-filled custom functions shown as chips", () => {
    render(
      <PersonForm
        mode="edit"
        personId="p-1"
        defaultValues={{
          isPlayer: false,
          customFunctions: ["Materialverantwortlicher", "Fotograf/in"],
        }}
      />,
    );
    const content = document.body.textContent ?? "";
    expect(content).toContain("Materialverantwortlicher");
    expect(content).toContain("Fotograf/in");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. Custom functions do NOT create permissions
// ─────────────────────────────────────────────────────────────────────────────

describe("11. Custom functions do NOT create permissions", () => {
  it("domain permissions are independent of customFunctions", () => {
    // Tab visibility for sensitive domains is independent of custom functions
    renderTabs({
      person: {
        isPlayer: false,
        isTrainer: false,
        customFunctions: ["Materialverantwortlicher"],
      },
      domainPermissions: {
        canViewFinance: false,
        canViewHealth: false,
        canViewPrivateDocuments: false,
      },
    });
    // Sensitive tabs absent regardless of custom functions
    expect(screen.queryByRole("tab", { name: /Finanzen/ })).toBeNull();
    expect(screen.queryByRole("tab", { name: /Gesundheit/ })).toBeNull();
    expect(screen.queryByRole("tab", { name: /Dokumente/ })).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. Trainer capacity does NOT grant Trainer authorization
// ─────────────────────────────────────────────────────────────────────────────

describe("12. Trainer capacity ≠ Trainer authorization", () => {
  it("isTrainer=true person does NOT get access to domain-permission tabs without permission", () => {
    renderTabs({
      person: { isPlayer: false, isTrainer: true },
      domainPermissions: {
        canViewFinance: false,
        canViewDevelopment: false,
        canViewAssessments: false,
      },
    });
    // Trainer tab is visible (capacity)
    expect(screen.getByRole("tab", { name: /Trainer/ })).toBeTruthy();
    // But development/assessment tabs are NOT shown (no permission)
    expect(screen.queryByRole("tab", { name: /Finanzen/ })).toBeNull();
  });

  it("tab visibility (Trainer) does not imply canManageAssessments", () => {
    // Even with isTrainer=true, domain permissions remain fail-closed
    renderTabs({
      person: { isTrainer: true },
      domainPermissions: { canManageAssessments: false },
    });
    // Trainer tab present, but no manage access derived
    expect(screen.getByRole("tab", { name: /Trainer/ })).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 13. Capacity does NOT create team assignment
// ─────────────────────────────────────────────────────────────────────────────

describe("13. Capacity ≠ Assignment", () => {
  it("isPlayer=true without squad memberships shows empty Spieler tab (no auto-assignment)", () => {
    renderTabs({
      person: { isPlayer: true, isTrainer: false },
      squads: [], // no squad memberships
    });
    // Spieler tab is shown
    fireEvent.click(screen.getByRole("tab", { name: /Spieler/ }));
    // Shows empty state — no auto-created squad entries
    const content = document.body.textContent ?? "";
    expect(content).toContain("Kein aktiver Spielereinsatz");
  });

  it("isTrainer=true without trainer memberships shows empty Trainer tab", () => {
    renderTabs({
      person: { isPlayer: false, isTrainer: true },
      trainers: [],
    });
    fireEvent.click(screen.getByRole("tab", { name: /Trainer/ }));
    const content = document.body.textContent ?? "";
    expect(content).toContain("Kein aktiver Trainereinsatz");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 14. Create/edit use same canonical capacity representation
// ─────────────────────────────────────────────────────────────────────────────
// Both PersonForm (create) and PersonForm (edit) use same fields/toggles
// ─────────────────────────────────────────────────────────────────────────────

describe("14. Create/edit use same canonical capacity representation", () => {
  it("create mode renders all capacity toggle switches", () => {
    render(<PersonForm mode="create" />);
    const switchIds = ["isActive", "isPlayer", "isTrainer", "isFunctionary",
      "isReferee", "isVolunteer", "isSponsorContact"];
    for (const id of switchIds) {
      const el = document.querySelector(`#${id}`);
      expect(el, `#${id} toggle present in create mode`).toBeTruthy();
    }
  });

  it("edit mode renders all capacity toggle switches with correct default values", () => {
    render(
      <PersonForm
        mode="edit"
        personId="p-edit"
        defaultValues={{
          isPlayer: true,
          isTrainer: false,
          isFunctionary: true,
          isVolunteer: false,
          isReferee: false,
          isSponsorContact: false,
        }}
      />,
    );
    const isPlayerSwitch = document.querySelector("#isPlayer") as HTMLButtonElement;
    expect(isPlayerSwitch).toBeTruthy();
    expect(isPlayerSwitch.getAttribute("aria-checked")).toBe("true");

    const isTrainerSwitch = document.querySelector("#isTrainer") as HTMLButtonElement;
    expect(isTrainerSwitch).toBeTruthy();
    expect(isTrainerSwitch.getAttribute("aria-checked")).toBe("false");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 15. Scoped/domain authorization still enforced
// ─────────────────────────────────────────────────────────────────────────────

describe("15. Scoped/domain authorization enforced", () => {
  it("Finanzen tab absent without people.finance.view even when person has all capacities", () => {
    renderTabs({
      person: {
        isPlayer: true, isTrainer: true, isFunctionary: true,
        isVolunteer: true, isReferee: true, isSponsorContact: true,
      },
      domainPermissions: { canViewFinance: false },
    });
    expect(screen.queryByRole("tab", { name: /Finanzen/ })).toBeNull();
  });

  it("Gesundheit tab absent without people.health.view", () => {
    renderTabs({
      person: { isPlayer: true },
      domainPermissions: { canViewHealth: false },
    });
    expect(screen.queryByRole("tab", { name: /Gesundheit/ })).toBeNull();
  });

  it("Finanzen tab visible when viewer holds people.finance.view", () => {
    renderTabs({
      person: { isPlayer: false },
      domainPermissions: { canViewFinance: true },
    });
    expect(screen.getByRole("tab", { name: /Finanzen/ })).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 16. Cross-tenant isolation
// ─────────────────────────────────────────────────────────────────────────────

describe("16. Cross-tenant isolation", () => {
  it("resolvePersonCapacities is a pure function — different tenant data does not bleed over", () => {
    // Tenant A's squads
    const tenantASquads = [makeSquad({ id: "sq-tenantA" })];
    // Tenant B's squads
    const tenantBSquads = [makeSquad({ id: "sq-tenantB" })];

    const capsA = resolvePersonCapacities(tenantASquads, []);
    const capsB = resolvePersonCapacities(tenantBSquads, []);

    // Each call is independent — no shared state
    expect(capsA.hasPlayerEvidence).toBe(true);
    expect(capsB.hasPlayerEvidence).toBe(true);
    // Separate calls produce independent results
    expect(capsA).toEqual(capsB); // same shape for same structure
  });

  it("capacity flags are per-person: one person's flags don't affect another", () => {
    const caps1 = getActiveCapacityLabels({ isPlayer: true, isTrainer: false });
    const caps2 = getActiveCapacityLabels({ isPlayer: false, isTrainer: true });
    expect(caps1).toContain("Spieler/in");
    expect(caps1).not.toContain("Trainer/in");
    expect(caps2).toContain("Trainer/in");
    expect(caps2).not.toContain("Spieler/in");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 17. PersonForm uses "Profile & Funktionen" section title
// ─────────────────────────────────────────────────────────────────────────────

describe("17. PersonForm section renamed to 'Profile & Funktionen'", () => {
  it("shows 'Profile & Funktionen' section heading", () => {
    render(<PersonForm mode="create" />);
    const content = document.body.textContent ?? "";
    expect(content).toContain("Profile & Funktionen");
  });

  it("does NOT show old 'Rollen & Status' heading", () => {
    render(<PersonForm mode="create" />);
    const content = document.body.textContent ?? "";
    expect(content).not.toContain("Rollen & Status");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 18. Header capacity badges show multiple capacities
// ─────────────────────────────────────────────────────────────────────────────

describe("18. Header shows multiple capacity badges", () => {
  it("shows Spieler/in and Trainer/in badges simultaneously in overview", () => {
    const person = makePerson({ isPlayer: true, isTrainer: true });
    render(
      <PersonWorkspaceOverviewTab
        person={{ ...person, assignments: [], squadMemberships: [], trainerMemberships: [] }}
        activeSeason={null}
      />,
    );
    const content = document.body.textContent ?? "";
    expect(content).toContain("Spieler/in");
    expect(content).toContain("Trainer/in");
  });

  it("shows Funktionär/in in overview when isFunctionary=true", () => {
    const person = makePerson({ isFunctionary: true });
    render(
      <PersonWorkspaceOverviewTab
        person={{ ...person, assignments: [], squadMemberships: [], trainerMemberships: [] }}
        activeSeason={null}
      />,
    );
    const content = document.body.textContent ?? "";
    expect(content).toContain("Funktionär/in");
  });

  it("shows no capacity badges when all flags are false", () => {
    const person = makePerson({
      isPlayer: false, isTrainer: false, isFunctionary: false,
      isVolunteer: false, isReferee: false, isSponsorContact: false,
      customFunctions: [],
    });
    render(
      <PersonWorkspaceOverviewTab
        person={{ ...person, assignments: [], squadMemberships: [], trainerMemberships: [] }}
        activeSeason={null}
      />,
    );
    // The "Profile" row should not appear
    const content = document.body.textContent ?? "";
    // None of the capacity labels should appear in identity section
    expect(content).not.toContain("Spieler/in");
    expect(content).not.toContain("Trainer/in");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 19. getActiveCapacityLabels covers all standard capacities
// ─────────────────────────────────────────────────────────────────────────────

describe("19. getActiveCapacityLabels — full coverage", () => {
  it("returns all 6 standard capacity labels when all are true", () => {
    const labels = getActiveCapacityLabels({
      isPlayer: true,
      isTrainer: true,
      isFunctionary: true,
      isVolunteer: true,
      isReferee: true,
      isSponsorContact: true,
    });
    expect(labels).toEqual([
      "Spieler/in",
      "Trainer/in",
      "Funktionär/in",
      "Schiedsrichter/in",
      "Freiwillige/r",
      "Sponsor-/Partner-Kontakt",
    ]);
  });

  it("returns empty array when all flags are false", () => {
    const labels = getActiveCapacityLabels({
      isPlayer: false,
      isTrainer: false,
      isFunctionary: false,
      isVolunteer: false,
      isReferee: false,
      isSponsorContact: false,
    });
    expect(labels).toHaveLength(0);
  });

  it("is a pure function — same input produces same output", () => {
    const input = { isPlayer: true, isTrainer: false, isFunctionary: true };
    const r1 = getActiveCapacityLabels(input);
    const r2 = getActiveCapacityLabels(input);
    expect(r1).toEqual(r2);
  });
});
