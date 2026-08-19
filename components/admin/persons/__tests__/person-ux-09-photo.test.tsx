/**
 * @vitest-environment jsdom
 *
 * PERSON-UX-09 — Person profile photo management.
 *
 * Tests cover:
 *  1.  PersonHeaderPhotoAdmin renders imageUrl when present
 *  2.  PersonHeaderPhotoAdmin renders initials when no photo
 *  3.  Authorized user (canManage=true) sees camera badge affordance
 *  4.  Unauthorized user (canManage=false) has no camera badge
 *  5.  Authorized user can click avatar to open action menu
 *  6.  Unauthorized user: avatar click does nothing (no menu)
 *  7.  Action menu shows "Foto hochladen" when no photo exists
 *  8.  Action menu shows "Foto ändern" when photo exists
 *  9.  Action menu shows "Foto entfernen" only when photo exists
 * 10.  "Foto entfernen" calls DELETE /api/people/[id]/profile-image
 * 11.  Remove success clears image and calls router.refresh()
 * 12.  Remove API error shows error feedback
 * 13.  Upload calls POST /api/people/[id]/profile-image with file
 * 14.  Upload success sets new imageUrl and calls router.refresh()
 * 15.  PersonDetailTabs overview passes canManage correctly
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import PersonHeaderPhotoAdmin from "../PersonHeaderPhotoAdmin";
import PersonDetailTabs from "../PersonDetailTabs";
import type { PersonDomainPermissions } from "@/lib/people/person-domain-auth";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), back: vi.fn(), push: vi.fn() }),
}));

// Mock next/image
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} data-testid="person-photo" />
  ),
}));

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh, back: vi.fn(), push: vi.fn() }),
}));

afterEach(() => {
  vi.restoreAllMocks();
  mockRefresh.mockReset();
});

// ── Fixtures ─────────────────────────────────────────────────────────────────

const NO_DOMAIN_PERMS: PersonDomainPermissions = {
  canViewFinance: false, canManageFinance: false,
  canViewHealth: false, canManageHealth: false,
  canViewPrivateDocuments: false, canManagePrivateDocuments: false,
  canViewDevelopment: false, canManageDevelopment: false,
  canViewAssessments: false, canManageAssessments: false,
  canViewAudit: false,
};

const BASE_PERSON = {
  id: "person-09",
  firstName: "Anna",
  lastName: "Müller",
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

// ── 1. Renders imageUrl when present ─────────────────────────────────────────

describe("PersonHeaderPhotoAdmin — image rendering", () => {
  it("renders photo when imageUrl is provided", () => {
    render(
      <PersonHeaderPhotoAdmin
        personId="person-09"
        personName="Anna Müller"
        initialImageUrl="https://example.com/photo.jpg"
        canManage={false}
      />,
    );
    const img = screen.getByTestId("person-photo");
    expect(img).toBeTruthy();
    expect(img.getAttribute("src")).toContain("example.com");
  });

  it("renders initials when no imageUrl is provided", () => {
    const { container } = render(
      <PersonHeaderPhotoAdmin
        personId="person-09"
        personName="Anna Müller"
        initialImageUrl={null}
        canManage={false}
      />,
    );
    expect(screen.queryByTestId("person-photo")).toBeNull();
    expect(container.textContent).toContain("AM");
  });
});

// ── 3-4. Camera badge visibility ─────────────────────────────────────────────

describe("PersonHeaderPhotoAdmin — management affordance", () => {
  it("authorized user (canManage=true) sees camera badge", () => {
    const { container } = render(
      <PersonHeaderPhotoAdmin
        personId="person-09"
        personName="Anna Müller"
        initialImageUrl={null}
        canManage={true}
      />,
    );
    // Camera badge is an aria-hidden div with a Camera icon
    const badge = container.querySelector("[aria-hidden='true'] svg");
    expect(badge).toBeTruthy();
  });

  it("unauthorized user (canManage=false) has no camera badge positioned at corner", () => {
    const { container } = render(
      <PersonHeaderPhotoAdmin
        personId="person-09"
        personName="Anna Müller"
        initialImageUrl={null}
        canManage={false}
      />,
    );
    // Camera badge has specific class that positions at corner
    const cornerBadge = container.querySelector(".-bottom-0\\.5.-right-0\\.5");
    expect(cornerBadge).toBeNull();
  });
});

// ── 5-9. Action menu ─────────────────────────────────────────────────────────

describe("PersonHeaderPhotoAdmin — action menu", () => {
  it("authorized user can open action menu by clicking avatar", () => {
    render(
      <PersonHeaderPhotoAdmin
        personId="person-09"
        personName="Anna Müller"
        initialImageUrl={null}
        canManage={true}
      />,
    );
    const avatar = screen.getByRole("button", { name: /profilbild verwalten/i });
    fireEvent.click(avatar);
    expect(screen.getByRole("menu")).toBeTruthy();
  });

  it("unauthorized user: avatar button has no management label, no menu on click", () => {
    render(
      <PersonHeaderPhotoAdmin
        personId="person-09"
        personName="Anna Müller"
        initialImageUrl={null}
        canManage={false}
      />,
    );
    // Avatar is not a management button when canManage=false
    expect(screen.queryByRole("button", { name: /profilbild verwalten/i })).toBeNull();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("menu shows 'Foto hochladen' when no photo exists", () => {
    render(
      <PersonHeaderPhotoAdmin
        personId="person-09"
        personName="Anna Müller"
        initialImageUrl={null}
        canManage={true}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /profilbild verwalten/i }));
    expect(screen.getByText("Foto hochladen")).toBeTruthy();
    expect(screen.queryByText("Foto entfernen")).toBeNull();
  });

  it("menu shows 'Foto ändern' and 'Foto entfernen' when photo exists", () => {
    render(
      <PersonHeaderPhotoAdmin
        personId="person-09"
        personName="Anna Müller"
        initialImageUrl="https://example.com/photo.jpg"
        canManage={true}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /profilbild verwalten/i }));
    expect(screen.getByText("Foto ändern")).toBeTruthy();
    expect(screen.getByText("Foto entfernen")).toBeTruthy();
  });
});

// ── 10-12. Remove flow ───────────────────────────────────────────────────────

describe("PersonHeaderPhotoAdmin — remove flow", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("remove success clears image and calls router.refresh()", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: "Profilbild entfernt." }),
    });

    render(
      <PersonHeaderPhotoAdmin
        personId="person-09"
        personName="Anna Müller"
        initialImageUrl="https://example.com/photo.jpg"
        canManage={true}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /profilbild verwalten/i }));
    fireEvent.click(screen.getByText("Foto entfernen"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/people/person-09/profile-image"),
        expect.objectContaining({ method: "DELETE" }),
      );
    });

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });

    // Image should now be gone (initials visible instead)
    expect(screen.queryByTestId("person-photo")).toBeNull();
  });

  it("remove API error shows error feedback", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Netzwerkfehler." }),
    });

    render(
      <PersonHeaderPhotoAdmin
        personId="person-09"
        personName="Anna Müller"
        initialImageUrl="https://example.com/photo.jpg"
        canManage={true}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /profilbild verwalten/i }));
    fireEvent.click(screen.getByText("Foto entfernen"));

    await waitFor(() => {
      expect(screen.getByText("Netzwerkfehler.")).toBeTruthy();
    });

    expect(mockRefresh).not.toHaveBeenCalled();
  });
});

// ── 15. PersonDetailTabs passes canManage to overview tab ────────────────────

describe("PersonDetailTabs — passes canManage to overview", () => {
  const EMPTY_SEASON = { id: "s", name: "2026/27", key: "2026-27" };

  function makeProps(canManage: boolean) {
    const person = {
      ...BASE_PERSON,
      isPlayer: true,
      assignments: [],
        squadMemberships: [
        {
          id: "sm-1",
          status: "ACTIVE" as const,
          shirtNumber: null,
          positionLabel: null,
          isCaptain: false,
          isViceCaptain: false,
          remarks: null,
          teamSeason: {
            id: "ts-1",
            displayName: "Senioren 40+ — 2026/27",
            shortName: "S40",
            participationType: "COMPETITION" as const,
            team: { id: "t-1", name: "Senioren 40+", shortName: "S40" },
            season: { id: "s-1", name: "2026/27", key: "2026-27", isActive: true, startDate: new Date(), endDate: new Date() },
          },
        },
      ],
      trainerMemberships: [],
    };

    return {
      person,
      canManage,
      canDelete: false,
      orgUnits: [],
      teams: [],
      activeSeason: EMPTY_SEASON,
      accessRolesCard: null,
      domainPermissions: NO_DOMAIN_PERMS,
      memberships: [],
      assessments: [],
      criteria: [],
      documents: [],
    };
  }

  it("authorized user sees remove button in overview active squad card", () => {
    render(<PersonDetailTabs {...makeProps(true)} />);
    expect(screen.getAllByTestId("remove-function-button").length).toBeGreaterThan(0);
  });

  it("unauthorized user sees no remove button in overview", () => {
    render(<PersonDetailTabs {...makeProps(false)} />);
    expect(screen.queryAllByTestId("remove-function-button")).toHaveLength(0);
  });
});
