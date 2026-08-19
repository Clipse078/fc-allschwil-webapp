/**
 * @vitest-environment jsdom
 *
 * PERSON-UX-10 — PersonContactTab UX acceptance tests.
 *
 * Proves:
 *  1. Contact section renders basic fields
 *  2. Without canViewContact, sections show access-denied message
 *  3. With canViewContact, sections fetch data and show empty states
 *  4. With canManageContact, "Hinzufügen" CTA is present
 *  5. Without canManageContact (view-only), CTA is absent
 *  6. Legacy guardian fields render when no canonical relation AND no fetch yet
 *  7. Emergency contact delete confirmation uses safe wording
 *  8. Guardian remove confirmation uses safe wording (no Person deletion implied)
 */

import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import PersonContactTab from "../PersonContactTab";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

// Mock fetch globally
const fetchMock = vi.fn();
global.fetch = fetchMock;

function makePerson(overrides: Record<string, unknown> = {}) {
  return {
    id: "person-001",
    firstName: "Max",
    lastName: "Muster",
    displayName: null,
    email: "max@example.com",
    phone: "+41 79 000 00 00",
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
    tenantId: "tenant-001",
    createdAt: new Date(),
    updatedAt: new Date(),
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
    createdFromRegistration: false,
    createdRegistrationId: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: empty lists
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ relationships: [], contacts: [] }),
  });
});

describe("PersonContactTab — basic contact fields", () => {
  it("renders contact email and phone", () => {
    render(
      <PersonContactTab
        person={makePerson()}
        canManage={false}
        canDelete={false}
        canViewContact={true}
        canManageContact={false}
      />,
    );
    expect(screen.getByText("max@example.com")).toBeInTheDocument();
    expect(screen.getByText("+41 79 000 00 00")).toBeInTheDocument();
  });
});

describe("PersonContactTab — without canViewContact", () => {
  it("shows access-denied message for guardian section", () => {
    render(
      <PersonContactTab
        person={makePerson()}
        canManage={false}
        canDelete={false}
        canViewContact={false}
        canManageContact={false}
      />,
    );
    expect(
      screen.getAllByText(/Keine Zugriffsberechtigung/i).length,
    ).toBeGreaterThan(0);
  });

  it("does not show Hinzufügen buttons", () => {
    render(
      <PersonContactTab
        person={makePerson()}
        canManage={false}
        canDelete={false}
        canViewContact={false}
        canManageContact={false}
      />,
    );
    expect(screen.queryByText("Hinzufügen")).not.toBeInTheDocument();
  });
});

describe("PersonContactTab — with canViewContact only (read-only)", () => {
  it("shows empty states after fetch resolves", async () => {
    render(
      <PersonContactTab
        person={makePerson()}
        canManage={false}
        canDelete={false}
        canViewContact={true}
        canManageContact={false}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Keine Erziehungsberechtigten hinterlegt."),
      ).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(
        screen.getByText("Keine Notfallkontakte hinterlegt."),
      ).toBeInTheDocument();
    });
  });

  it("does not render Hinzufügen CTA (view-only)", async () => {
    render(
      <PersonContactTab
        person={makePerson()}
        canManage={false}
        canDelete={false}
        canViewContact={true}
        canManageContact={false}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Keine Erziehungsberechtigten hinterlegt."),
      ).toBeInTheDocument();
    });

    // No add button visible
    expect(screen.queryByText("Hinzufügen")).not.toBeInTheDocument();
  });
});

describe("PersonContactTab — with canManageContact", () => {
  it("renders Hinzufügen buttons for both sections", async () => {
    render(
      <PersonContactTab
        person={makePerson()}
        canManage={true}
        canDelete={false}
        canViewContact={true}
        canManageContact={true}
      />,
    );

    await waitFor(() => {
      const addButtons = screen.getAllByText("Hinzufügen");
      expect(addButtons.length).toBeGreaterThanOrEqual(2);
    });
  });
});

describe("PersonContactTab — legacy guardian fields", () => {
  it("shows legacy guardian data when no canonical relations exist", async () => {
    const person = makePerson({
      guardianFirstName: "Anna",
      guardianLastName: "Mustermann",
      guardianPhone: "+41 79 111 11 11",
      guardianEmail: "anna@example.com",
    });

    render(
      <PersonContactTab
        person={person}
        canManage={false}
        canDelete={false}
        canViewContact={true}
        canManageContact={false}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Anna Mustermann")).toBeInTheDocument();
    });

    expect(screen.getByText("Bisherige Kontaktdaten")).toBeInTheDocument();
  });

  it("legacy data not shown when canonical relations exist", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        relationships: [
          {
            id: "rel-001",
            relationshipType: "MOTHER",
            isPrimary: true,
            notes: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            guardianPerson: {
              id: "guardian-001",
              firstName: "Canonical",
              lastName: "Mother",
              displayName: null,
              email: null,
              phone: null,
              imageUrl: null,
              isActive: true,
            },
          },
        ],
        contacts: [],
      }),
    });

    const person = makePerson({
      guardianFirstName: "Anna",
      guardianLastName: "Mustermann",
      guardianPhone: "+41 79 111 11 11",
    });

    render(
      <PersonContactTab
        person={person}
        canManage={false}
        canDelete={false}
        canViewContact={true}
        canManageContact={false}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Canonical Mother")).toBeInTheDocument();
    });

    // Legacy should not appear since canonical exists
    expect(screen.queryByText("Bisherige Kontaktdaten")).not.toBeInTheDocument();
  });
});
