/**
 * @vitest-environment jsdom
 *
 * PERSON-UX-08 — Dokumente workspace closure.
 *
 * Tests cover:
 *  1.  Dokumente tab is NOT marked deferred (no "Geplant" indicator)
 *  2.  Authorized viewer sees Dokumente tab
 *  3.  Unauthorized user does not see Dokumente tab
 *  4.  View-only user sees no upload CTA (manage action absent)
 *  5.  Manage user sees "Dokument hinzufügen" CTA in empty state
 *  6.  Manage user sees "Dokument hinzufügen" in header when docs exist
 *  7.  Edit button visible for manage user on populated document card
 *  8.  Edit button absent for view-only user
 *  9.  Edit form renders with current document values
 * 10.  Delete confirmation requires two-step click (manage user)
 * 11.  Team-scoped access without document permission → no Dokumente tab
 * 12.  Zero-capacity Person can view documents when authorized
 * 13.  Empty state heading is "Noch keine Dokumente"
 * 14.  Empty state description is correct for view-only user
 * 15.  Dokumente tab visible regardless of isPlayer/isTrainer flags
 * 16.  Download link targets authorized server route (no storage URL)
 * 17.  Expiry badge "Abgelaufen" on expired document
 * 18.  Expiry badge "Läuft bald ab" on expiring-soon document
 * 19.  No document metadata shown to unauthorized user (no tab panel)
 * 20.  Multi-capacity Person (isPlayer+isTrainer) still has single Dokumente tab
 * 21.  Person Overview shows document count for authorized viewer
 * 22.  Person Overview hides document signal for unauthorized viewer
 * 23.  Clicking document count in overview navigates to dokumente tab
 * 24.  Empty state action not shown when documents exist (header CTA instead)
 * 25.  PersonDocumentTab PERSON-UX-07 regressions still green
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import PersonDetailTabs from "../PersonDetailTabs";
import PersonDocumentTab from "../PersonDocumentTab";
import PersonWorkspaceOverviewTab from "../PersonWorkspaceOverviewTab";
import type { PersonDocumentItem } from "@/lib/people/queries";
import type { PersonDomainPermissions } from "@/lib/people/person-domain-auth";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), back: vi.fn(), push: vi.fn() }),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Permission sets ─────────────────────────────────────────────────────────

const NO_PERMS: PersonDomainPermissions = {
  canViewFinance: false, canManageFinance: false,
  canViewHealth: false, canManageHealth: false,
  canViewPrivateDocuments: false, canManagePrivateDocuments: false,
  canViewDevelopment: false, canManageDevelopment: false,
  canViewAssessments: false, canManageAssessments: false,
  canViewAudit: false,
};

const VIEW_DOCS_ONLY: PersonDomainPermissions = {
  ...NO_PERMS,
  canViewPrivateDocuments: true,
  canManagePrivateDocuments: false,
};

// ── Person fixture ──────────────────────────────────────────────────────────

const BASE_PERSON = {
  id: "person-ux08",
  firstName: "Lena",
  lastName: "Vogel",
  displayName: null, email: null, phone: null, dateOfBirth: null, notes: null,
  imageUrl: null, isActive: true,
  isPlayer: false, isTrainer: false, isFunctionary: false,
  isVolunteer: false, isReferee: false, isSponsorContact: false,
  customFunctions: [],
  tenantId: "tenant-ux08",
  createdAt: new Date("2024-01-01"), updatedAt: new Date("2024-01-01"),
  street: null, houseNumber: null, postalCode: null, city: null, country: null,
  guardianFirstName: null, guardianLastName: null, guardianEmail: null, guardianPhone: null,
  userId: null, user: null,
};

const SEASON = {
  id: "s-ux08", name: "2026/27", key: "2026-27",
  isActive: true, startDate: new Date("2026-08-01"), endDate: new Date("2027-05-31"),
};

function makeDoc(overrides: Partial<PersonDocumentItem> = {}): PersonDocumentItem {
  return {
    id: "doc-ux08",
    personId: "person-ux08",
    tenantId: "tenant-ux08",
    category: "OTHER",
    title: "Testdokument",
    originalFilename: "test.pdf",
    mimeType: "application/pdf",
    sizeBytes: 12345,
    issueDate: null,
    expiryDate: null,
    notes: null,
    uploadedByUserId: "user-1",
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    ...overrides,
  };
}

function renderTabs(
  personOverrides: Partial<typeof BASE_PERSON> = {},
  domainPermissions: PersonDomainPermissions = NO_PERMS,
  documents: PersonDocumentItem[] = [],
) {
  const person = { ...BASE_PERSON, ...personOverrides };
  render(
    <PersonDetailTabs
      person={{ ...person, assignments: [], squadMemberships: [], trainerMemberships: [] }}
      canManage={true}
      canDelete={false}
      orgUnits={[]}
      teams={[]}
      activeSeason={SEASON}
      accessRolesCard={null}
      domainPermissions={domainPermissions}
      documents={documents}
    />,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Tab not deferred
// ─────────────────────────────────────────────────────────────────────────────

describe("1. Dokumente tab is not marked deferred", () => {
  it("no 'Geplant' dot on the Dokumente tab button", () => {
    renderTabs({}, VIEW_DOCS_ONLY);
    const dokTab = screen.getByRole("tab", { name: /Dokumente/ });
    // The "Geplant" indicator renders a <span title="Geplant"> — should not exist on dokumente tab
    const geplantSpans = dokTab.querySelectorAll('[title="Geplant"]');
    expect(geplantSpans.length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2–3. Tab visibility
// ─────────────────────────────────────────────────────────────────────────────

describe("2–3. Tab visibility by permission", () => {
  it("2. Authorized viewer sees Dokumente tab", () => {
    renderTabs({}, VIEW_DOCS_ONLY);
    expect(screen.getByRole("tab", { name: /Dokumente/ })).toBeTruthy();
  });

  it("3. Unauthorized user sees no Dokumente tab", () => {
    renderTabs({}, NO_PERMS);
    expect(screen.queryByRole("tab", { name: /Dokumente/ })).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4–6. Upload CTA visibility
// ─────────────────────────────────────────────────────────────────────────────

describe("4–6. Upload CTA visibility", () => {
  it("4. View-only user sees no 'Dokument hinzufügen' CTA", () => {
    render(
      <PersonDocumentTab personId="p-1" initialDocuments={[]} canManage={false} />,
    );
    expect(screen.queryByText("Dokument hinzufügen")).toBeNull();
  });

  it("5. Manage user sees 'Dokument hinzufügen' CTA in empty state", () => {
    render(
      <PersonDocumentTab personId="p-1" initialDocuments={[]} canManage={true} />,
    );
    expect(screen.getByText("Dokument hinzufügen")).toBeTruthy();
  });

  it("6. Manage user sees 'Dokument hinzufügen' in header when docs exist", () => {
    const doc = makeDoc();
    render(
      <PersonDocumentTab personId="p-1" initialDocuments={[doc]} canManage={true} />,
    );
    expect(screen.getByText("Dokument hinzufügen")).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7–9. Edit metadata
// ─────────────────────────────────────────────────────────────────────────────

describe("7–9. Edit metadata action", () => {
  it("7. Edit button visible for manage user on populated document card", () => {
    const doc = makeDoc({ title: "Mein Dokument" });
    render(
      <PersonDocumentTab personId="p-1" initialDocuments={[doc]} canManage={true} />,
    );
    const editBtn = document.querySelector('[title="Metadaten bearbeiten"]');
    expect(editBtn).toBeTruthy();
  });

  it("8. Edit button absent for view-only user", () => {
    const doc = makeDoc({ title: "Mein Dokument" });
    render(
      <PersonDocumentTab personId="p-1" initialDocuments={[doc]} canManage={false} />,
    );
    const editBtn = document.querySelector('[title="Metadaten bearbeiten"]');
    expect(editBtn).toBeNull();
  });

  it("9. Edit form renders with Speichern/Abbrechen when edit button clicked", () => {
    const doc = makeDoc({ title: "Reisepass", category: "IDENTITY_DOCUMENT" });
    render(
      <PersonDocumentTab personId="p-1" initialDocuments={[doc]} canManage={true} />,
    );
    const editBtn = document.querySelector('[title="Metadaten bearbeiten"]');
    expect(editBtn).toBeTruthy();
    fireEvent.click(editBtn!);
    // Edit form should appear with Speichern/Abbrechen actions
    expect(screen.getByText("Speichern")).toBeTruthy();
    const content = document.body.textContent ?? "";
    expect(content).toContain("Ablaufdatum");
    expect(content).toContain("Kategorie");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. Delete confirmation
// ─────────────────────────────────────────────────────────────────────────────

describe("10. Delete requires two-step confirmation", () => {
  it("first click shows confirm button, not immediate delete", () => {
    const doc = makeDoc({ title: "Zu löschendes Dok" });
    render(
      <PersonDocumentTab personId="p-1" initialDocuments={[doc]} canManage={true} />,
    );
    const trashBtn = document.querySelector('[title="Löschen"]');
    expect(trashBtn).toBeTruthy();
    fireEvent.click(trashBtn!);
    // Confirm step: now shows "Löschen" button (text)
    const loschenButtons = screen.getAllByText("Löschen");
    expect(loschenButtons.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 11–12. Team-scoped and zero-capacity
// ─────────────────────────────────────────────────────────────────────────────

describe("11–12. Team scope and zero-capacity", () => {
  it("11. Team-scoped access (NO document permission) → no Dokumente tab", () => {
    // Simulates a team trainer with no people.private_documents.view
    renderTabs({ isTrainer: true }, NO_PERMS);
    expect(screen.queryByRole("tab", { name: /Dokumente/ })).toBeNull();
    // Trainer tab IS shown
    expect(screen.getByRole("tab", { name: /Trainer/ })).toBeTruthy();
  });

  it("12. Zero-capacity Person can view documents when authorized", () => {
    renderTabs(
      { isPlayer: false, isTrainer: false, isFunctionary: false, isVolunteer: false },
      VIEW_DOCS_ONLY,
    );
    expect(screen.getByRole("tab", { name: /Dokumente/ })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: /Spieler/ })).toBeNull();
    expect(screen.queryByRole("tab", { name: /Trainer/ })).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 13–14. Empty state UX
// ─────────────────────────────────────────────────────────────────────────────

describe("13–14. Empty state UX", () => {
  it("13. Empty state heading is 'Noch keine Dokumente'", () => {
    render(
      <PersonDocumentTab personId="p-1" initialDocuments={[]} canManage={false} />,
    );
    expect(screen.getByText("Noch keine Dokumente")).toBeTruthy();
  });

  it("14. Empty state description for view-only user", () => {
    render(
      <PersonDocumentTab personId="p-1" initialDocuments={[]} canManage={false} />,
    );
    expect(screen.getByText("Für diese Person wurden noch keine Dokumente hinterlegt.")).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 15. Capacity-independence
// ─────────────────────────────────────────────────────────────────────────────

describe("15. Dokumente tab visible regardless of capacity flags", () => {
  it("player profile + document permission → both Spieler AND Dokumente tabs", () => {
    renderTabs({ isPlayer: true }, VIEW_DOCS_ONLY);
    expect(screen.getByRole("tab", { name: /Dokumente/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Spieler/ })).toBeTruthy();
  });

  it("no capacity flags + document permission → only Dokumente tab (no Spieler/Trainer)", () => {
    renderTabs({ isPlayer: false, isTrainer: false }, VIEW_DOCS_ONLY);
    expect(screen.getByRole("tab", { name: /Dokumente/ })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: /Spieler/ })).toBeNull();
    expect(screen.queryByRole("tab", { name: /Trainer/ })).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 16. Download route
// ─────────────────────────────────────────────────────────────────────────────

describe("16. Download link targets authorized server route", () => {
  it("download href points to /api/people/[id]/documents/[docId]/download", () => {
    const doc = makeDoc({ id: "doc-dl", personId: "p-dl" });
    render(
      <PersonDocumentTab personId="p-dl" initialDocuments={[doc]} canManage={false} />,
    );
    const link = document.querySelector('a[href*="download"]') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.href).toContain("/api/people/p-dl/documents/doc-dl/download");
    // Must NOT be a blob/storage URL
    expect(link.href).not.toContain("blob.core.windows.net");
    expect(link.href).not.toContain("vercel-blob");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 17–18. Expiry badges
// ─────────────────────────────────────────────────────────────────────────────

describe("17–18. Expiry badges", () => {
  it("17. Expired document shows 'Abgelaufen' badge", () => {
    const doc = makeDoc({ expiryDate: new Date("2020-01-01") });
    render(<PersonDocumentTab personId="p-1" initialDocuments={[doc]} canManage={false} />);
    expect(screen.getByText("Abgelaufen")).toBeTruthy();
  });

  it("18. Document expiring within 60 days shows 'Läuft bald ab'", () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 30);
    const doc = makeDoc({ expiryDate: soon });
    render(<PersonDocumentTab personId="p-1" initialDocuments={[doc]} canManage={false} />);
    expect(screen.getByText("Läuft bald ab")).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 19. No leakage to unauthorized user
// ─────────────────────────────────────────────────────────────────────────────

describe("19. No document metadata leakage without permission", () => {
  it("unauthorized viewer sees no tab panel and no document metadata", () => {
    renderTabs({}, NO_PERMS, [makeDoc({ title: "Geheimes Dokument" })]);
    // No tab panel for dokumente
    expect(document.querySelector("#tabpanel-dokumente")).toBeNull();
    // No document title in DOM
    expect(screen.queryByText("Geheimes Dokument")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 20. Multi-capacity: single Dokumente tab
// ─────────────────────────────────────────────────────────────────────────────

describe("20. Multi-capacity Person has single Dokumente tab", () => {
  it("isPlayer+isTrainer with doc permission → one Dokumente tab", () => {
    renderTabs({ isPlayer: true, isTrainer: true }, VIEW_DOCS_ONLY);
    const dokTabs = screen.getAllByRole("tab", { name: /Dokumente/ });
    expect(dokTabs).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 21–23. Person Overview integration
// ─────────────────────────────────────────────────────────────────────────────

describe("21–23. Person Overview document signal", () => {
  const BASE_OVERVIEW_PERSON = {
    ...BASE_PERSON,
    assignments: [] as never[],
    squadMemberships: [] as never[],
    trainerMemberships: [] as never[],
  };

  it("21. Overview shows document count for authorized viewer", () => {
    render(
      <PersonWorkspaceOverviewTab
        person={BASE_OVERVIEW_PERSON}
        activeSeason={SEASON}
        documentCount={3}
      />,
    );
    const content = document.body.textContent ?? "";
    expect(content).toContain("3 Dokumente");
    expect(content).toContain("Dokumente");
  });

  it("22. Overview hides document signal when documentCount is null", () => {
    render(
      <PersonWorkspaceOverviewTab
        person={BASE_OVERVIEW_PERSON}
        activeSeason={SEASON}
        documentCount={null}
      />,
    );
    // No "Dokumente" section heading shown for unauthorized viewer
    const sectionHeadings = Array.from(document.querySelectorAll("h3")).map((h) => h.textContent ?? "");
    expect(sectionHeadings).not.toContain("DOKUMENTE");
  });

  it("23. Clicking document count in Overview triggers navigation to dokumente tab", () => {
    const navigate = vi.fn();
    render(
      <PersonWorkspaceOverviewTab
        person={BASE_OVERVIEW_PERSON}
        activeSeason={SEASON}
        documentCount={2}
        onNavigateToTab={navigate}
      />,
    );
    const docButton = screen.getByText("2 Dokumente").closest("button");
    expect(docButton).toBeTruthy();
    fireEvent.click(docButton!);
    expect(navigate).toHaveBeenCalledWith("dokumente");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 24. Empty state action not shown when docs exist
// ─────────────────────────────────────────────────────────────────────────────

describe("24. Empty state CTA absent when documents exist", () => {
  it("manage user with docs sees header button, not empty state", () => {
    const doc = makeDoc({ title: "Vorhandenes Dok" });
    render(
      <PersonDocumentTab personId="p-1" initialDocuments={[doc]} canManage={true} />,
    );
    // Document is shown
    expect(screen.getByText("Vorhandenes Dok")).toBeTruthy();
    // "Noch keine Dokumente" empty state should NOT appear
    expect(screen.queryByText("Noch keine Dokumente")).toBeNull();
    // Header button "Dokument hinzufügen" is present
    expect(screen.getByText("Dokument hinzufügen")).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 25. UX-07 regressions
// ─────────────────────────────────────────────────────────────────────────────

describe("25. PERSON-UX-07 regressions stay green", () => {
  it("isPlayer tab driven by capacity flag (UX-07)", () => {
    renderTabs({ isPlayer: true }, VIEW_DOCS_ONLY);
    expect(screen.getByRole("tab", { name: /Spieler/ })).toBeTruthy();
  });

  it("isTrainer tab driven by capacity flag (UX-07)", () => {
    renderTabs({ isTrainer: true }, VIEW_DOCS_ONLY);
    expect(screen.getByRole("tab", { name: /Trainer/ })).toBeTruthy();
  });

  it("Dokumente permission is independent of isPlayer/isTrainer", () => {
    renderTabs({ isPlayer: false, isTrainer: false }, NO_PERMS);
    expect(screen.queryByRole("tab", { name: /Dokumente/ })).toBeNull();
  });
});
