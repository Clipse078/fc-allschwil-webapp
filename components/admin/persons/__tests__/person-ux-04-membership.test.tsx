/**
 * @vitest-environment jsdom
 *
 * components/admin/persons/__tests__/person-ux-04-membership.test.tsx
 *
 * PERSON-UX-04 — Club Membership Foundation.
 *
 * Proves:
 *  1.  canonical Person can have membership
 *  2.  Person can have no membership
 *  3.  external/non-sport Person can have no membership without UX noise
 *  4.  membership is independent from User/TenantMembership
 *  5.  membership is independent from PersonAssignment
 *  6.  ACTIVE membership renders
 *  7.  ENDED membership remains in history
 *  8.  multiple historical periods render newest first
 * 18.  PERSON-UX-02 capacity behavior remains intact (Spieler/Trainer tabs)
 * 19.  PERSON-UX-03 sensitive tab authorization remains intact (Finanzen/Gesundheit)
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import PersonDetailTabs from "../PersonDetailTabs";
import PersonMembershipTab from "../PersonMembershipTab";
import { DOMAIN_PERMISSIONS_DENIED } from "@/lib/people/person-domain-auth";
import type { PersonDomainPermissions } from "@/lib/people/person-domain-auth";
import type { PersonMembershipRecord } from "@/lib/people/queries";
import { PersonMembershipStatus, PersonMembershipType } from "@prisma/client";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BASE_PERSON = {
  id: "person-ux-04",
  firstName: "Karl",
  lastName: "Müller",
  displayName: null as string | null,
  email: "karl@example.test" as string | null,
  phone: null as string | null,
  dateOfBirth: null as Date | null,
  notes: null as string | null,
  imageUrl: null as string | null,
  isActive: true,
  isPlayer: false,
  isTrainer: false,
  tenantId: "tenant-1",
  createdAt: new Date("2020-01-01"),
  updatedAt: new Date("2024-01-01"),
  street: null as string | null,
  houseNumber: null as string | null,
  postalCode: null as string | null,
  city: null as string | null,
  country: null as string | null,
  guardianFirstName: null as string | null,
  guardianLastName: null as string | null,
  guardianEmail: null as string | null,
  guardianPhone: null as string | null,
  userId: null as string | null,
  user: null as { id: string; email: string; isActive: boolean } | null,
};

const SEASON = {
  id: "season-1",
  name: "2024/25",
  key: "2024-25",
  isActive: true,
  startDate: new Date("2024-08-01"),
  endDate: new Date("2025-05-31"),
};
const TEAM = { id: "team-1", name: "FC Test", shortName: "FCT" };

function makeSquad(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "sq-1",
    status: "ACTIVE" as const,
    shirtNumber: 10,
    positionLabel: null,
    isCaptain: false,
    isViceCaptain: false,
    remarks: null,
    teamSeason: {
      id: "ts-1",
      displayName: "FC Test 2024/25",
      shortName: "FCT",
      participationType: "COMPETITION" as const,
      team: TEAM,
      season: SEASON,
    },
    ...overrides,
  };
}

function makeTrainer(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "tr-1",
    status: "ACTIVE" as const,
    roleLabel: "Trainer/in",
    remarks: null,
    teamSeason: {
      id: "ts-2",
      displayName: "FC Test 2024/25",
      shortName: "FCT",
      team: TEAM,
      season: SEASON,
    },
    ...overrides,
  };
}

function makeMembership(overrides: Partial<PersonMembershipRecord> = {}): PersonMembershipRecord {
  return {
    id: "memb-1",
    tenantId: "tenant-1",
    personId: "person-ux-04",
    membershipType: PersonMembershipType.ACTIVE_MEMBER,
    status: PersonMembershipStatus.ACTIVE,
    memberNumber: "1001",
    startsAt: new Date("2020-01-01"),
    endsAt: null,
    notes: null,
    createdAt: new Date("2020-01-01"),
    updatedAt: new Date("2020-01-01"),
    ...overrides,
  };
}

const NO_DOMAIN_PERMS: PersonDomainPermissions = DOMAIN_PERMISSIONS_DENIED;
const ALL_DOMAIN_PERMS: PersonDomainPermissions = {
  canViewFinance: true,
  canManageFinance: true,
  canViewHealth: true,
  canManageHealth: true,
  canViewPrivateDocuments: true,
  canManagePrivateDocuments: true,
  canViewDevelopment: true,
  canManageDevelopment: true,
  canViewAudit: true,
};

function renderTabs(
  overrides: {
    memberships?: PersonMembershipRecord[];
    canManage?: boolean;
    squadMemberships?: ReturnType<typeof makeSquad>[];
    trainerMemberships?: ReturnType<typeof makeTrainer>[];
    domainPermissions?: PersonDomainPermissions;
    person?: typeof BASE_PERSON;
  } = {},
) {
  const {
    memberships = [],
    canManage = false,
    squadMemberships = [],
    trainerMemberships = [],
    domainPermissions = NO_DOMAIN_PERMS,
    person = BASE_PERSON,
  } = overrides;
  return render(
    <PersonDetailTabs
      person={{ ...person, assignments: [], squadMemberships, trainerMemberships }}
      canManage={canManage}
      canDelete={false}
      orgUnits={[]}
      teams={[]}
      activeSeason={null}
      accessRolesCard={null}
      domainPermissions={domainPermissions}
      memberships={memberships}
    />,
  );
}

// ── 1. canonical Person can have membership ───────────────────────────────────

describe("1. canonical Person can have membership", () => {
  it("Mitgliedschaft tab is always present for any Person", () => {
    renderTabs({ memberships: [makeMembership()] });
    expect(screen.getByRole("tab", { name: /Mitgliedschaft/ })).toBeTruthy();
  });

  it("renders membership type label when membership exists", () => {
    renderTabs({ memberships: [makeMembership()] });
    const tab = screen.getByRole("tab", { name: /Mitgliedschaft/ });
    fireEvent.click(tab);
    expect(screen.getByText("Aktivmitglied")).toBeTruthy();
  });
});

// ── 2. Person can have no membership ─────────────────────────────────────────

describe("2. Person can have no membership", () => {
  it("tab is still present when person has no memberships", () => {
    renderTabs({ memberships: [] });
    expect(screen.getByRole("tab", { name: /Mitgliedschaft/ })).toBeTruthy();
  });

  it("shows empty state when no memberships", () => {
    renderTabs({ memberships: [] });
    const tab = screen.getByRole("tab", { name: /Mitgliedschaft/ });
    fireEvent.click(tab);
    expect(screen.getByText("Keine Mitgliedschaft")).toBeTruthy();
  });
});

// ── 3. external/non-sport Person can have no membership without UX noise ──────

describe("3. external/non-sport Person — clean empty state", () => {
  it("external Person (no squads, no trainer) shows Mitgliedschaft tab without noise", () => {
    // External Person: no squad, no trainer, no sport tab
    renderTabs({ memberships: [] });
    // Tab is present
    expect(screen.getByRole("tab", { name: /Mitgliedschaft/ })).toBeTruthy();
    // No "Spieler" or "Trainer" or "Sport" tabs — external person
    expect(screen.queryByRole("tab", { name: /^Spieler$/ })).toBeNull();
    expect(screen.queryByRole("tab", { name: /^Trainer$/ })).toBeNull();
    expect(screen.queryByRole("tab", { name: /Sport/ })).toBeNull();
  });

  it("empty state message for non-manager is informative, not just an error", () => {
    renderTabs({ memberships: [], canManage: false });
    const tab = screen.getByRole("tab", { name: /Mitgliedschaft/ });
    fireEvent.click(tab);
    // Non-manager sees informative empty text mentioning external persons
    expect(screen.getByText(/Externe Personen/i)).toBeTruthy();
  });
});

// ── 4. membership is independent from User/TenantMembership ──────────────────

describe("4. membership independent from User/TenantMembership", () => {
  it("Person linked to a User can still have zero memberships (no coupling)", () => {
    const personWithUser = {
      ...BASE_PERSON,
      userId: "user-linked",
      user: { id: "user-linked", email: "user@example.com", isActive: true },
    };
    renderTabs({ memberships: [], person: personWithUser });
    const tab = screen.getByRole("tab", { name: /Mitgliedschaft/ });
    fireEvent.click(tab);
    expect(screen.getByText("Keine Mitgliedschaft")).toBeTruthy();
  });

  it("Person without a User can have an ACTIVE membership", () => {
    renderTabs({ memberships: [makeMembership()] });
    const tab = screen.getByRole("tab", { name: /Mitgliedschaft/ });
    fireEvent.click(tab);
    expect(screen.getByText("Aktivmitglied")).toBeTruthy();
  });
});

// ── 5. membership is independent from PersonAssignment ───────────────────────

describe("5. membership independent from PersonAssignment", () => {
  it("Person with no assignments can still have ACTIVE membership", () => {
    renderTabs({ memberships: [makeMembership()] });
    const tab = screen.getByRole("tab", { name: /Mitgliedschaft/ });
    fireEvent.click(tab);
    expect(screen.getByText("Aktivmitglied")).toBeTruthy();
  });

  it("PersonMembershipTab does not reference assignment data", () => {
    const { container } = render(
      <PersonMembershipTab
        personId="person-1"
        memberships={[makeMembership()]}
        canManage={false}
      />,
    );
    // Should not mention "Organisation" or "Funktion" assignment language
    expect(container.textContent).not.toContain("Funktion");
  });
});

// ── 6. ACTIVE membership renders ─────────────────────────────────────────────

describe("6. ACTIVE membership renders", () => {
  it("shows ACTIVE badge", () => {
    const { getByText } = render(
      <PersonMembershipTab
        personId="person-1"
        memberships={[makeMembership({ status: PersonMembershipStatus.ACTIVE })]}
        canManage={false}
      />,
    );
    expect(getByText("Aktiv")).toBeTruthy();
  });

  it("shows member number when present", () => {
    const { getByText } = render(
      <PersonMembershipTab
        personId="person-1"
        memberships={[makeMembership({ memberNumber: "9999" })]}
        canManage={false}
      />,
    );
    expect(getByText(/9999/)).toBeTruthy();
  });

  it("shows Mitglied seit date", () => {
    const { getByText } = render(
      <PersonMembershipTab
        personId="person-1"
        memberships={[makeMembership({ startsAt: new Date("2020-03-15") })]}
        canManage={false}
      />,
    );
    expect(getByText(/Mitglied seit/i)).toBeTruthy();
  });
});

// ── 7. ENDED membership remains in history ────────────────────────────────────

describe("7. ENDED membership remains in history", () => {
  it("ENDED membership is still rendered in the membership list", () => {
    const ended = makeMembership({
      id: "memb-ended",
      status: PersonMembershipStatus.ENDED,
      endsAt: new Date("2022-12-31"),
    });
    const { getByText } = render(
      <PersonMembershipTab
        personId="person-1"
        memberships={[ended]}
        canManage={false}
      />,
    );
    expect(getByText("Beendet")).toBeTruthy();
  });

  it("shows Austritt date for ENDED membership", () => {
    const ended = makeMembership({
      status: PersonMembershipStatus.ENDED,
      endsAt: new Date("2022-12-31"),
    });
    const { getByText } = render(
      <PersonMembershipTab
        personId="person-1"
        memberships={[ended]}
        canManage={false}
      />,
    );
    expect(getByText(/Austritt/i)).toBeTruthy();
  });

  it("history section label appears when ENDED record exists", () => {
    const active = makeMembership({ id: "memb-active" });
    const ended = makeMembership({
      id: "memb-ended",
      status: PersonMembershipStatus.ENDED,
      startsAt: new Date("2018-01-01"),
      endsAt: new Date("2019-12-31"),
    });
    const { getByText } = render(
      <PersonMembershipTab
        personId="person-1"
        memberships={[active, ended]}
        canManage={false}
      />,
    );
    expect(getByText(/Mitgliedschaftsverlauf/i)).toBeTruthy();
  });
});

// ── 8. multiple historical periods render newest first ─────────────────────────

describe("8. multiple historical periods render newest first", () => {
  it("renders all memberships ordered by startsAt desc", () => {
    const old = makeMembership({
      id: "memb-old",
      status: PersonMembershipStatus.ENDED,
      memberNumber: "0001",
      startsAt: new Date("2015-01-01"),
      endsAt: new Date("2018-12-31"),
    });
    const recent = makeMembership({
      id: "memb-recent",
      status: PersonMembershipStatus.ACTIVE,
      memberNumber: "0002",
      startsAt: new Date("2020-01-01"),
    });
    const { container } = render(
      <PersonMembershipTab
        personId="person-1"
        memberships={[recent, old]}
        canManage={false}
      />,
    );
    const text = container.textContent ?? "";
    const pos0001 = text.indexOf("0001");
    const pos0002 = text.indexOf("0002");
    // newest (0002) appears before oldest (0001)
    expect(pos0002).toBeLessThan(pos0001);
  });
});

// ── 18. PERSON-UX-02 capacity behavior remains intact ─────────────────────────

describe("18. PERSON-UX-02 capacity behavior remains intact", () => {
  it("Spieler tab appears when Person has squad evidence", () => {
    renderTabs({ squadMemberships: [makeSquad()] });
    expect(screen.getByRole("tab", { name: /^Spieler$/ })).toBeTruthy();
  });

  it("Trainer tab appears when Person has trainer evidence", () => {
    renderTabs({ trainerMemberships: [makeTrainer()] });
    expect(screen.getByRole("tab", { name: /^Trainer$/ })).toBeTruthy();
  });

  it("Sport & Entwicklung tab appears when any sporting evidence exists", () => {
    renderTabs({ squadMemberships: [makeSquad()] });
    expect(screen.getByRole("tab", { name: /Sport & Entwicklung/ })).toBeTruthy();
  });

  it("Spieler tab absent for Person with zero squad memberships", () => {
    renderTabs({});
    expect(screen.queryByRole("tab", { name: /^Spieler$/ })).toBeNull();
  });

  it("simultaneous Spieler + Trainer show both tabs", () => {
    renderTabs({ squadMemberships: [makeSquad()], trainerMemberships: [makeTrainer()] });
    expect(screen.getByRole("tab", { name: /^Spieler$/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /^Trainer$/ })).toBeTruthy();
  });
});

// ── 19. PERSON-UX-03 sensitive tab authorization remains intact ───────────────

describe("19. PERSON-UX-03 sensitive tab authorization remains intact", () => {
  it("Finanzen tab absent when canViewFinance=false", () => {
    renderTabs({ domainPermissions: NO_DOMAIN_PERMS });
    expect(screen.queryByRole("tab", { name: /Finanzen/ })).toBeNull();
  });

  it("Finanzen tab visible when canViewFinance=true", () => {
    renderTabs({ domainPermissions: { ...NO_DOMAIN_PERMS, canViewFinance: true } });
    expect(screen.getByRole("tab", { name: /Finanzen/ })).toBeTruthy();
  });

  it("Gesundheit tab absent when canViewHealth=false", () => {
    renderTabs({ domainPermissions: NO_DOMAIN_PERMS });
    expect(screen.queryByRole("tab", { name: /Gesundheit/ })).toBeNull();
  });

  it("Gesundheit tab visible when canViewHealth=true", () => {
    renderTabs({ domainPermissions: { ...NO_DOMAIN_PERMS, canViewHealth: true } });
    expect(screen.getByRole("tab", { name: /Gesundheit/ })).toBeTruthy();
  });

  it("Dokumente tab absent when canViewPrivateDocuments=false", () => {
    renderTabs({ domainPermissions: NO_DOMAIN_PERMS });
    expect(screen.queryByRole("tab", { name: /Dokumente/ })).toBeNull();
  });

  it("Mitgliedschaft tab remains always visible regardless of domain permissions", () => {
    renderTabs({ domainPermissions: NO_DOMAIN_PERMS });
    expect(screen.getByRole("tab", { name: /Mitgliedschaft/ })).toBeTruthy();
    renderTabs({ domainPermissions: ALL_DOMAIN_PERMS });
    expect(screen.getAllByRole("tab", { name: /Mitgliedschaft/ })[0]).toBeTruthy();
  });
});

// ── Service-layer: validateDates ──────────────────────────────────────────────

describe("validateDates service function", () => {
  it("returns ok:true when endsAt > startsAt", async () => {
    const { validateDates } = await import("@/lib/people/membership-service");
    const result = validateDates(new Date("2020-01-01"), new Date("2021-01-01"));
    expect(result.ok).toBe(true);
  });

  it("returns ok:false when endsAt < startsAt", async () => {
    const { validateDates } = await import("@/lib/people/membership-service");
    const result = validateDates(new Date("2021-01-01"), new Date("2020-01-01"));
    expect(result.ok).toBe(false);
  });

  it("returns ok:true when endsAt is null", async () => {
    const { validateDates } = await import("@/lib/people/membership-service");
    const result = validateDates(new Date("2020-01-01"), null);
    expect(result.ok).toBe(true);
  });

  it("returns ok:false when endsAt < existing startsAt (update scenario)", async () => {
    const { validateDates } = await import("@/lib/people/membership-service");
    const result = validateDates(undefined, new Date("2019-12-31"), new Date("2020-01-01"));
    expect(result.ok).toBe(false);
  });
});
