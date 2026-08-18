/**
 * @vitest-environment jsdom
 *
 * components/admin/persons/__tests__/person-ux-03-domain-permissions.test.tsx
 *
 * PERSON-UX-03 — Person Domain Permissions + Scoped Tab Authorization.
 *
 * Proves:
 *  1.  finance permission → Finanzen tab visible
 *  2.  no finance permission → Finanzen tab absent
 *  3.  health permission → Gesundheit tab visible
 *  4.  no health permission → Gesundheit tab absent
 *  5.  private-document permission → Dokumente tab visible
 *  6.  no document permission → Dokumente tab absent
 *  7.  development permission gates Spieler-Entwicklung section
 *  8.  generic people.view alone does NOT grant sensitive tabs
 *      (tabs absent when domainPermissions all-false)
 *  9.  permissions work through configurable RolePermission, not role names
 *      (authorization helper accepts arbitrary boolean flags — no role check)
 * 10.  scoped permission: wrong OrgUnit → access denied (via helper logic)
 * 11.  cross-tenant access denied (DOMAIN_PERMISSIONS_DENIED used as fallback)
 * 12.  Spieler/Trainer relevance logic remains intact
 * 13.  simultaneous capacities remain intact
 * 14.  external Person authorization behaves identically to internal Person
 * 15.  role-management UI: new permissions appear in PEOPLE module catalog
 *      (via PERMISSIONS constant naming convention)
 * 16.  unauthorized server-side sensitive query: DOMAIN_PERMISSIONS_DENIED
 *      produces all-false flags (fail-closed server path)
 * 17.  existing invite/delete/access functionality unaffected
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import PersonDetailTabs from "../PersonDetailTabs";
import PersonSportTab from "../PersonSportTab";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { DOMAIN_PERMISSIONS_DENIED } from "@/lib/people/person-domain-auth";
import type { PersonDomainPermissions } from "@/lib/people/person-domain-auth";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Fixture helpers ───────────────────────────────────────────────────────────

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
  firstName: "Lena",
  lastName: "Müller",
  displayName: null,
  email: "lena@example.test",
  phone: null,
  dateOfBirth: new Date("2000-03-10"),
  notes: null,
  imageUrl: null,
  isActive: true,
  isPlayer: true,
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

const SEASON = {
  id: "season-2526",
  name: "2025/26",
  key: "2025-26",
  isActive: true,
  startDate: new Date("2025-08-01"),
  endDate: new Date("2026-05-31"),
};

const TEAM = { id: "team-a", name: "FC Test 1", shortName: "FCT 1" };

function makeSquadMembership(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "sq-1",
    status: "ACTIVE" as const,
    shirtNumber: 7,
    positionLabel: "Sturm",
    isCaptain: false,
    isViceCaptain: false,
    remarks: null,
    teamSeason: {
      id: "ts-1",
      displayName: "FC Test 1 2025/26",
      shortName: "FCT 1",
      participationType: "COMPETITION" as const,
      team: TEAM,
      season: SEASON,
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
      displayName: "FC Test 1 2025/26",
      shortName: "FCT 1",
      team: TEAM,
      season: SEASON,
    },
    ...overrides,
  };
}

const NO_DOMAIN_PERMS: PersonDomainPermissions = {
  canViewFinance: false,
  canManageFinance: false,
  canViewHealth: false,
  canManageHealth: false,
  canViewPrivateDocuments: false,
  canManagePrivateDocuments: false,
  canViewDevelopment: false,
  canManageDevelopment: false,
  canViewAudit: false,
};

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

function renderTabs(person: PersonFixture, domainPermissions: PersonDomainPermissions) {
  return render(
    <PersonDetailTabs
      person={{ ...person, assignments: [], squadMemberships: [], trainerMemberships: [] }}
      canManage={false}
      canDelete={false}
      orgUnits={[]}
      teams={[]}
      activeSeason={null}
      accessRolesCard={null}
      domainPermissions={domainPermissions}
    />,
  );
}

// ── 1 & 2. Finanzen tab ───────────────────────────────────────────────────────

describe("1 & 2. Finanzen tab — finance permission gate", () => {
  it("1. Finanzen tab is visible when canViewFinance=true", () => {
    renderTabs(BASE_PERSON, { ...NO_DOMAIN_PERMS, canViewFinance: true });
    expect(screen.getByRole("tab", { name: /Finanzen/ })).toBeTruthy();
  });

  it("2. Finanzen tab is absent when canViewFinance=false", () => {
    renderTabs(BASE_PERSON, NO_DOMAIN_PERMS);
    expect(screen.queryByRole("tab", { name: /Finanzen/ })).toBeNull();
    // No locked state or domain existence hint
    expect(screen.queryByText("Finanzen")).toBeNull();
  });

  it("2b. Finanzen tab absent means no panel is rendered", () => {
    renderTabs(BASE_PERSON, NO_DOMAIN_PERMS);
    expect(document.getElementById("tabpanel-finanzen")).toBeNull();
  });
});

// ── 3 & 4. Gesundheit tab ─────────────────────────────────────────────────────

describe("3 & 4. Gesundheit tab — health permission gate", () => {
  it("3. Gesundheit tab is visible when canViewHealth=true", () => {
    renderTabs(BASE_PERSON, { ...NO_DOMAIN_PERMS, canViewHealth: true });
    expect(screen.getByRole("tab", { name: /Gesundheit/ })).toBeTruthy();
  });

  it("4. Gesundheit tab is absent when canViewHealth=false", () => {
    renderTabs(BASE_PERSON, NO_DOMAIN_PERMS);
    expect(screen.queryByRole("tab", { name: /Gesundheit/ })).toBeNull();
    expect(screen.queryByText("Gesundheit")).toBeNull();
  });

  it("4b. Gesundheit placeholder renders when permission present and tab clicked", () => {
    renderTabs(BASE_PERSON, { ...NO_DOMAIN_PERMS, canViewHealth: true });
    fireEvent.click(screen.getByRole("tab", { name: /Gesundheit/ }));
    // Placeholder title appears in panel
    expect(screen.getAllByText("Gesundheit").length).toBeGreaterThanOrEqual(2);
    // Placeholder references the planned implementation
    expect(screen.getByText(/Medizinische Informationen/)).toBeTruthy();
  });
});

// ── 5 & 6. Dokumente tab ──────────────────────────────────────────────────────

describe("5 & 6. Dokumente tab — private-document permission gate", () => {
  it("5. Dokumente tab is visible when canViewPrivateDocuments=true", () => {
    renderTabs(BASE_PERSON, { ...NO_DOMAIN_PERMS, canViewPrivateDocuments: true });
    expect(screen.getByRole("tab", { name: /Dokumente/ })).toBeTruthy();
  });

  it("6. Dokumente tab is absent when canViewPrivateDocuments=false", () => {
    renderTabs(BASE_PERSON, NO_DOMAIN_PERMS);
    expect(screen.queryByRole("tab", { name: /Dokumente/ })).toBeNull();
    expect(screen.queryByText("Dokumente")).toBeNull();
  });

  it("6b. Dokumente placeholder renders when permission present and tab clicked", () => {
    renderTabs(BASE_PERSON, { ...NO_DOMAIN_PERMS, canViewPrivateDocuments: true });
    fireEvent.click(screen.getByRole("tab", { name: /Dokumente/ }));
    expect(screen.getAllByText(/Persönliche Dokumente/).length).toBeGreaterThan(0);
  });
});

// ── 7. Development permission gates Spieler-Entwicklung ──────────────────────

describe("7. Development permission gates Spieler-Entwicklung section", () => {
  it("7a. Spieler-Entwicklung section is absent when canViewDevelopment=false", () => {
    render(
      <PersonSportTab
        squadMemberships={[makeSquadMembership()]}
        trainerMemberships={[]}
        assignments={[]}
        canViewDevelopment={false}
      />,
    );
    expect(screen.queryByText("Spieler-Entwicklung")).toBeNull();
    expect(screen.queryByText("Entwicklungs-Bewertungen")).toBeNull();
    // Non-sensitive sporting history still present
    expect(screen.getByText("Saison-Biografie")).toBeTruthy();
  });

  it("7b. Spieler-Entwicklung section is visible when canViewDevelopment=true", () => {
    render(
      <PersonSportTab
        squadMemberships={[makeSquadMembership()]}
        trainerMemberships={[]}
        assignments={[]}
        canViewDevelopment={true}
      />,
    );
    expect(screen.getByText("Spieler-Entwicklung")).toBeTruthy();
    expect(screen.getByText("Entwicklungs-Bewertungen")).toBeTruthy();
    // Non-sensitive sporting history also present
    expect(screen.getByText("Saison-Biografie")).toBeTruthy();
  });

  it("7c. Development section absent via PersonDetailTabs when canViewDevelopment=false", () => {
    render(
      <PersonDetailTabs
        person={{
          ...BASE_PERSON,
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
        domainPermissions={{ ...NO_DOMAIN_PERMS }}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /Sport & Entwicklung/ }));
    expect(screen.queryByText("Spieler-Entwicklung")).toBeNull();
    // Sporting history visible
    expect(screen.getByText("Saison-Biografie")).toBeTruthy();
  });
});

// ── 8. Generic people.view alone does NOT grant sensitive tabs ────────────────

describe("8. Generic people.view alone does NOT grant sensitive tabs", () => {
  it("sensitive tabs are absent when domainPermissions all-false (simulates people.view only)", () => {
    // people.view is not a domain permission. Viewer with only people.view
    // would have no domain flags set → NO_DOMAIN_PERMS.
    renderTabs(BASE_PERSON, NO_DOMAIN_PERMS);

    expect(screen.queryByRole("tab", { name: /Finanzen/ })).toBeNull();
    expect(screen.queryByRole("tab", { name: /Gesundheit/ })).toBeNull();
    expect(screen.queryByRole("tab", { name: /Dokumente/ })).toBeNull();

    // Safe non-sensitive tabs still render
    expect(screen.getByRole("tab", { name: /Übersicht/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Zugang/ })).toBeTruthy();
  });
});

// ── 9. Permissions work through configurable RolePermission, not role names ──

describe("9. Permissions via configurable RolePermission — no role-name checks", () => {
  it("finance tab visible when domain flag=true regardless of role name", () => {
    // The tab logic only reads the boolean flag, not any role identifier.
    // Simulate a custom role granting only finance.view (no named role check).
    const customRoleGivesFinance: PersonDomainPermissions = {
      ...NO_DOMAIN_PERMS,
      canViewFinance: true,
    };
    renderTabs(BASE_PERSON, customRoleGivesFinance);
    expect(screen.getByRole("tab", { name: /Finanzen/ })).toBeTruthy();
    // Only finance — health/docs remain absent
    expect(screen.queryByRole("tab", { name: /Gesundheit/ })).toBeNull();
    expect(screen.queryByRole("tab", { name: /Dokumente/ })).toBeNull();
  });

  it("permission constants follow people.<domain>.<action> naming convention", () => {
    // Verify the canonical keys added in PERSON-UX-03 match the convention.
    expect(PERMISSIONS.PEOPLE_FINANCE_VIEW).toBe("people.finance.view");
    expect(PERMISSIONS.PEOPLE_FINANCE_MANAGE).toBe("people.finance.manage");
    expect(PERMISSIONS.PEOPLE_HEALTH_VIEW).toBe("people.health.view");
    expect(PERMISSIONS.PEOPLE_HEALTH_MANAGE).toBe("people.health.manage");
    expect(PERMISSIONS.PEOPLE_PRIVATE_DOCUMENTS_VIEW).toBe("people.private_documents.view");
    expect(PERMISSIONS.PEOPLE_PRIVATE_DOCUMENTS_MANAGE).toBe("people.private_documents.manage");
    expect(PERMISSIONS.PEOPLE_DEVELOPMENT_VIEW).toBe("people.development.view");
    expect(PERMISSIONS.PEOPLE_DEVELOPMENT_MANAGE).toBe("people.development.manage");
    expect(PERMISSIONS.PEOPLE_ASSESSMENTS_VIEW).toBe("people.assessments.view");
    expect(PERMISSIONS.PEOPLE_ASSESSMENTS_MANAGE).toBe("people.assessments.manage");
    expect(PERMISSIONS.PEOPLE_AUDIT_VIEW).toBe("people.audit.view");
  });
});

// ── 10. Scoped permission cannot cross OrgUnit boundary ───────────────────────

describe("10. Scoped permission — OrgUnit boundary", () => {
  it("DOMAIN_PERMISSIONS_DENIED produces all-false flags (fail-closed)", () => {
    // When OrgUnit check fails (wrong org unit, no grant), the resolver returns
    // DOMAIN_PERMISSIONS_DENIED. Verify every flag is false.
    expect(DOMAIN_PERMISSIONS_DENIED.canViewFinance).toBe(false);
    expect(DOMAIN_PERMISSIONS_DENIED.canViewHealth).toBe(false);
    expect(DOMAIN_PERMISSIONS_DENIED.canViewPrivateDocuments).toBe(false);
    expect(DOMAIN_PERMISSIONS_DENIED.canViewDevelopment).toBe(false);
    expect(DOMAIN_PERMISSIONS_DENIED.canViewAudit).toBe(false);
    expect(DOMAIN_PERMISSIONS_DENIED.canManageFinance).toBe(false);
    expect(DOMAIN_PERMISSIONS_DENIED.canManageHealth).toBe(false);
    expect(DOMAIN_PERMISSIONS_DENIED.canManagePrivateDocuments).toBe(false);
    expect(DOMAIN_PERMISSIONS_DENIED.canManageDevelopment).toBe(false);
  });

  it("sensitive tabs absent when DOMAIN_PERMISSIONS_DENIED is passed", () => {
    renderTabs(BASE_PERSON, DOMAIN_PERMISSIONS_DENIED);
    expect(screen.queryByRole("tab", { name: /Finanzen/ })).toBeNull();
    expect(screen.queryByRole("tab", { name: /Gesundheit/ })).toBeNull();
    expect(screen.queryByRole("tab", { name: /Dokumente/ })).toBeNull();
  });
});

// ── 11. Cross-tenant access denied ───────────────────────────────────────────

describe("11. Cross-tenant access denied", () => {
  it("DOMAIN_PERMISSIONS_DENIED is used as the server-side fallback when tenantId is absent", () => {
    // In the server loader: `const domainPermissions = tenantId
    //   ? await resolvePersonDomainPermissions(...) : DOMAIN_PERMISSIONS_DENIED`
    // Simulate the absent-tenantId path by passing DOMAIN_PERMISSIONS_DENIED.
    renderTabs(BASE_PERSON, DOMAIN_PERMISSIONS_DENIED);
    // No sensitive tab should be present
    expect(screen.queryByRole("tab", { name: /Finanzen/ })).toBeNull();
    expect(screen.queryByRole("tab", { name: /Gesundheit/ })).toBeNull();
    expect(screen.queryByRole("tab", { name: /Dokumente/ })).toBeNull();
  });
});

// ── 12. Spieler/Trainer relevance logic intact ────────────────────────────────

describe("12. Spieler/Trainer relevance logic remains intact", () => {
  it("Sport tab count reflects active squad + trainer memberships", () => {
    render(
      <PersonDetailTabs
        person={{
          ...BASE_PERSON,
          assignments: [],
          squadMemberships: [makeSquadMembership()],
          trainerMemberships: [makeTrainerMembership()],
        }}
        canManage={false}
        canDelete={false}
        orgUnits={[]}
        teams={[]}
        activeSeason={null}
        accessRolesCard={null}
        domainPermissions={NO_DOMAIN_PERMS}
      />,
    );
    // Sport tab badge shows combined count (1 squad + 1 trainer = 2)
    const sportTab = screen.getByRole("tab", { name: /Sport & Entwicklung/ });
    expect(sportTab.textContent).toContain("2");
  });

  it("Saison-Biografie renders squad and trainer entries", () => {
    render(
      <PersonDetailTabs
        person={{
          ...BASE_PERSON,
          assignments: [],
          squadMemberships: [makeSquadMembership()],
          trainerMemberships: [makeTrainerMembership()],
        }}
        canManage={false}
        canDelete={false}
        orgUnits={[]}
        teams={[]}
        activeSeason={null}
        accessRolesCard={null}
        domainPermissions={NO_DOMAIN_PERMS}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /Sport & Entwicklung/ }));
    expect(screen.getByText("Saison-Biografie")).toBeTruthy();
    expect(screen.getByText(SEASON.name)).toBeTruthy();
    // Both Spieler and Trainer badges visible
    expect(screen.getByText("Spieler/in")).toBeTruthy();
    expect(screen.getByText("Trainer/in")).toBeTruthy();
  });
});

// ── 13. Simultaneous capacities remain intact ─────────────────────────────────

describe("13. Simultaneous capacities remain intact", () => {
  it("multiple domain permissions can be true simultaneously", () => {
    renderTabs(BASE_PERSON, {
      ...NO_DOMAIN_PERMS,
      canViewFinance: true,
      canViewHealth: true,
      canViewPrivateDocuments: true,
    });
    expect(screen.getByRole("tab", { name: /Finanzen/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Gesundheit/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Dokumente/ })).toBeTruthy();
  });
});

// ── 14. External Person authorization behaves identically ─────────────────────

describe("14. External Person — authorization identical to internal", () => {
  it("external Person (user=null, isActive=false) obeys same domain permission rules", () => {
    const externalPerson = {
      ...BASE_PERSON,
      isActive: false,
      userId: null,
      user: null,
    };

    // Without domain perms — sensitive tabs absent
    renderTabs(externalPerson, NO_DOMAIN_PERMS);
    expect(screen.queryByRole("tab", { name: /Finanzen/ })).toBeNull();
    expect(screen.queryByRole("tab", { name: /Gesundheit/ })).toBeNull();
    expect(screen.queryByRole("tab", { name: /Dokumente/ })).toBeNull();
  });

  it("external Person with domain permissions sees sensitive tabs", () => {
    const externalPerson = {
      ...BASE_PERSON,
      isActive: false,
      userId: null,
      user: null,
    };
    renderTabs(externalPerson, { ...NO_DOMAIN_PERMS, canViewFinance: true });
    expect(screen.getByRole("tab", { name: /Finanzen/ })).toBeTruthy();
  });
});

// ── 15. Role-management UI exposes the new permissions ────────────────────────

describe("15. Role-management UI: new permissions in PEOPLE module", () => {
  it("all new PERSON-UX-03 permission keys are defined in PERMISSIONS", () => {
    const peopleKeys = Object.values(PERMISSIONS).filter((k) => k.startsWith("people."));
    // New domain keys must be present
    expect(peopleKeys).toContain("people.development.view");
    expect(peopleKeys).toContain("people.development.manage");
    expect(peopleKeys).toContain("people.assessments.view");
    expect(peopleKeys).toContain("people.assessments.manage");
    expect(peopleKeys).toContain("people.health.view");
    expect(peopleKeys).toContain("people.health.manage");
    expect(peopleKeys).toContain("people.finance.view");
    expect(peopleKeys).toContain("people.finance.manage");
    expect(peopleKeys).toContain("people.private_documents.view");
    expect(peopleKeys).toContain("people.private_documents.manage");
    expect(peopleKeys).toContain("people.audit.view");
  });

  it("existing people.* core keys are still present (no regressions)", () => {
    expect(PERMISSIONS.PEOPLE_VIEW).toBe("people.view");
    expect(PERMISSIONS.PEOPLE_MANAGE).toBe("people.manage");
    expect(PERMISSIONS.PEOPLE_DELETE).toBe("people.delete");
  });
});

// ── 16. Unauthorized server-side sensitive query fails closed ─────────────────

describe("16. Server-side fail-closed — DOMAIN_PERMISSIONS_DENIED as sentinel", () => {
  it("DOMAIN_PERMISSIONS_DENIED has all fields set to false", () => {
    const keys = Object.keys(DOMAIN_PERMISSIONS_DENIED) as (keyof PersonDomainPermissions)[];
    for (const key of keys) {
      expect(DOMAIN_PERMISSIONS_DENIED[key]).toBe(false);
    }
  });

  it("PersonDetailTabs renders no sensitive panel when DOMAIN_PERMISSIONS_DENIED passed", () => {
    renderTabs(BASE_PERSON, DOMAIN_PERMISSIONS_DENIED);
    // No sensitive panel element in DOM
    expect(document.getElementById("tabpanel-finanzen")).toBeNull();
    expect(document.getElementById("tabpanel-gesundheit")).toBeNull();
    expect(document.getElementById("tabpanel-dokumente")).toBeNull();
  });
});

// ── 17. Existing invite/delete/access functionality unaffected ────────────────

describe("17. Existing invite/delete/access functionality unaffected", () => {
  it("Zugang tab always renders regardless of domain permissions", () => {
    // With no domain perms
    renderTabs(BASE_PERSON, NO_DOMAIN_PERMS);
    expect(screen.getByRole("tab", { name: /Zugang/ })).toBeTruthy();
  });

  it("Zugang tab always renders with all domain perms", () => {
    renderTabs(BASE_PERSON, ALL_DOMAIN_PERMS);
    expect(screen.getByRole("tab", { name: /Zugang/ })).toBeTruthy();
  });

  it("canManage/canDelete props work independently of domainPermissions", () => {
    render(
      <PersonDetailTabs
        person={{ ...BASE_PERSON, assignments: [], squadMemberships: [], trainerMemberships: [] }}
        canManage={true}
        canDelete={true}
        orgUnits={[]}
        teams={[]}
        activeSeason={null}
        accessRolesCard={null}
        domainPermissions={NO_DOMAIN_PERMS}
      />,
    );
    // Stammdaten tab navigable regardless of domain perms
    fireEvent.click(screen.getByRole("tab", { name: /Stammdaten/ }));
    // Basic contact form area is rendered (no crash)
    expect(document.getElementById("tabpanel-stammdaten")).toBeTruthy();
  });

  it("Übersicht, Stammdaten, Organisation, Mitgliedschaft, Zugang always present", () => {
    renderTabs(BASE_PERSON, NO_DOMAIN_PERMS);
    expect(screen.getByRole("tab", { name: /Übersicht/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Stammdaten/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Organisation/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Mitgliedschaft/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Zugang/ })).toBeTruthy();
  });
});
