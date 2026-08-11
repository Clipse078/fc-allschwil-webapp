/**
 * @vitest-environment jsdom
 *
 * components/admin/persons/__tests__/PersonAccessRolesCard.test.tsx
 *
 * ADMIN-MASTERDATA-UX-01 (Part A) + -C1 — Person detail "Zugang & Rollen"
 * card. Covers the task test-list items not already exercised against a
 * live DB:
 *   - lib/roles/__tests__/admin-masterdata-ux-01-person-role-assignment.test.ts
 *     (role render/assign/remove/cross-tenant/PLATFORM/canonical UserRole)
 *   - lib/people/__tests__/admin-masterdata-ux-01-c1-person-user-link.test.ts
 *     (link/unlink domain rules)
 *
 * This file covers:
 *   6. unauthorized user cannot assign/remove (canAssign=false renders
 *      read-only, never issues a mutating fetch)
 *   7. Person without a linked User shows the no-account state (or the
 *      "Benutzerkonto verknüpfen" picker when authorized)
 *   8. unauthorized caller cannot link/unlink (picker hidden; no
 *      "Verknüpfung lösen" control rendered)
 *   +  assign/remove/link/unlink all call the exact canonical
 *      POST/DELETE /api/tenant/roles/[id]/members and
 *      POST/DELETE /api/people/[id]/link-user endpoints — no parallel
 *      mutation path.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PersonAccessRolesCard, {
  LAST_REQUIRED_ADMIN_MESSAGE,
} from "@/components/admin/persons/PersonAccessRolesCard";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const PERSON_ID = "person-1";
const LINKED_USER = { id: "user-1", email: "trainer@example.test" };
const ROLES = [
  { id: "role-trainer", name: "Trainer", isSystem: false, isArchived: false, activeAssigneeCount: 3 },
  { id: "role-admin", name: "Club Admin", isSystem: true, isArchived: false, activeAssigneeCount: 2 },
  { id: "role-archived", name: "Alt-Rolle", isSystem: false, isArchived: true, activeAssigneeCount: 0 },
];

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("PersonAccessRolesCard — no linked account", () => {
  it("7. shows the exact 'Kein Benutzerkonto verknüpft' no-account state when the caller cannot link", () => {
    render(
      <PersonAccessRolesCard
        personId={PERSON_ID}
        linkedUser={null}
        isActiveTenantMember={false}
        roles={[]}
        assignedRoleIds={[]}
        canAssign={false}
      />,
    );

    expect(screen.getByText("Kein Benutzerkonto verknüpft")).toBeTruthy();
    expect(screen.queryByText("Benutzerkonto verknüpfen")).toBeNull();
  });

  it("7/C1: offers 'Benutzerkonto verknüpfen' when the caller has roles-management authority", () => {
    render(
      <PersonAccessRolesCard
        personId={PERSON_ID}
        linkedUser={null}
        isActiveTenantMember={false}
        roles={[]}
        assignedRoleIds={[]}
        canAssign={true}
      />,
    );

    expect(screen.getByText("Kein Benutzerkonto verknüpft")).toBeTruthy();
    expect(screen.getByText("Benutzerkonto verknüpfen")).toBeTruthy();
  });
});

describe("PersonAccessRolesCard — linked account, roles render", () => {
  it("shows the linked account email and current tenant roles, excluding archived roles", () => {
    render(
      <PersonAccessRolesCard
        personId={PERSON_ID}
        linkedUser={LINKED_USER}
        isActiveTenantMember={true}
        roles={ROLES}
        assignedRoleIds={["role-trainer"]}
        canAssign={true}
      />,
    );

    expect(screen.getByText(LINKED_USER.email)).toBeTruthy();
    expect(screen.getByText("Trainer")).toBeTruthy();
    expect(screen.getByText("Club Admin")).toBeTruthy();
    // Archived roles are never offered for assignment.
    expect(screen.queryByText("Alt-Rolle")).toBeNull();

    const trainerCheckbox = screen.getByRole("checkbox", { name: /Trainer entziehen/ });
    expect((trainerCheckbox as HTMLInputElement).checked).toBe(true);
    const adminCheckbox = screen.getByRole("checkbox", { name: /Club Admin zuweisen/ });
    expect((adminCheckbox as HTMLInputElement).checked).toBe(false);
  });

  it("shows the not-a-member state and never offers role management when the linked User has no active membership in this tenant", () => {
    render(
      <PersonAccessRolesCard
        personId={PERSON_ID}
        linkedUser={LINKED_USER}
        isActiveTenantMember={false}
        roles={ROLES}
        assignedRoleIds={[]}
        canAssign={true}
      />,
    );

    expect(screen.getByText(LINKED_USER.email)).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getByText(/kein aktives Mitglied/)).toBeTruthy();
  });
});

describe("PersonAccessRolesCard — assign / remove reuse the canonical roles.assign API path", () => {
  it("assigning a role POSTs to /api/tenant/roles/[id]/members with the linked userId", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ assigned: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <PersonAccessRolesCard
        personId={PERSON_ID}
        linkedUser={LINKED_USER}
        isActiveTenantMember={true}
        roles={ROLES}
        assignedRoleIds={[]}
        canAssign={true}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: /Club Admin zuweisen/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/tenant/roles/role-admin/members",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ userId: LINKED_USER.id }),
      }),
    );
  });

  it("removing a role DELETEs /api/tenant/roles/[id]/members?userId=...", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ removed: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <PersonAccessRolesCard
        personId={PERSON_ID}
        linkedUser={LINKED_USER}
        isActiveTenantMember={true}
        roles={ROLES}
        assignedRoleIds={["role-trainer"]}
        canAssign={true}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: /Trainer entziehen/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/tenant/roles/role-trainer/members?userId=${encodeURIComponent(LINKED_USER.id)}`,
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("6. renders roles read-only and never issues a fetch when the caller cannot assign (canAssign=false)", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <PersonAccessRolesCard
        personId={PERSON_ID}
        linkedUser={LINKED_USER}
        isActiveTenantMember={true}
        roles={ROLES}
        assignedRoleIds={["role-trainer"]}
        canAssign={false}
      />,
    );

    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getByText("Trainer")).toBeTruthy();
    expect(screen.getByText(/Keine Berechtigung zum Zuweisen von Rollen/)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("last required admin: a sole active Club Admin holder's checkbox is locked with the German explanation", () => {
    const roles = [
      { id: "role-admin", name: "Club Admin", isSystem: true, isArchived: false, activeAssigneeCount: 1 },
    ];

    render(
      <PersonAccessRolesCard
        personId={PERSON_ID}
        linkedUser={LINKED_USER}
        isActiveTenantMember={true}
        roles={roles}
        assignedRoleIds={["role-admin"]}
        canAssign={true}
      />,
    );

    const checkbox = screen.getByRole("checkbox", { name: /Club Admin entziehen/ });
    expect((checkbox as HTMLInputElement).checked).toBe(true);
    expect((checkbox as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText(LAST_REQUIRED_ADMIN_MESSAGE)).toBeTruthy();
  });

  it("a second Club Admin's checkbox stays enabled and removal succeeds normally", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ removed: true }) });
    vi.stubGlobal("fetch", fetchMock);

    const roles = [
      { id: "role-admin", name: "Club Admin", isSystem: true, isArchived: false, activeAssigneeCount: 2 },
    ];

    render(
      <PersonAccessRolesCard
        personId={PERSON_ID}
        linkedUser={LINKED_USER}
        isActiveTenantMember={true}
        roles={roles}
        assignedRoleIds={["role-admin"]}
        canAssign={true}
      />,
    );

    const checkbox = screen.getByRole("checkbox", { name: /Club Admin entziehen/ });
    expect((checkbox as HTMLInputElement).disabled).toBe(false);
    expect(screen.queryByText(LAST_REQUIRED_ADMIN_MESSAGE)).toBeNull();

    fireEvent.click(checkbox);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/tenant/roles/role-admin/members?userId=${encodeURIComponent(LINKED_USER.id)}`,
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
  });

  it("custom/non-system tenant roles are never locked, regardless of assignee count", () => {
    const roles = [
      { id: "role-trainer", name: "Trainer", isSystem: false, isArchived: false, activeAssigneeCount: 1 },
    ];

    render(
      <PersonAccessRolesCard
        personId={PERSON_ID}
        linkedUser={LINKED_USER}
        isActiveTenantMember={true}
        roles={roles}
        assignedRoleIds={["role-trainer"]}
        canAssign={true}
      />,
    );

    const checkbox = screen.getByRole("checkbox", { name: /Trainer entziehen/ });
    expect((checkbox as HTMLInputElement).disabled).toBe(false);
    expect(screen.queryByText(LAST_REQUIRED_ADMIN_MESSAGE)).toBeNull();
  });

  it("assigning the last-required-admin role to an unassigned person is never locked", () => {
    const roles = [
      { id: "role-admin", name: "Club Admin", isSystem: true, isArchived: false, activeAssigneeCount: 1 },
    ];

    render(
      <PersonAccessRolesCard
        personId={PERSON_ID}
        linkedUser={LINKED_USER}
        isActiveTenantMember={true}
        roles={roles}
        assignedRoleIds={[]}
        canAssign={true}
      />,
    );

    const checkbox = screen.getByRole("checkbox", { name: /Club Admin zuweisen/ });
    expect((checkbox as HTMLInputElement).disabled).toBe(false);
    expect(screen.queryByText(LAST_REQUIRED_ADMIN_MESSAGE)).toBeNull();
  });

  it("clicking a locked checkbox never issues a fetch (defense in depth beyond the disabled attribute)", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const roles = [
      { id: "role-admin", name: "Club Admin", isSystem: true, isArchived: false, activeAssigneeCount: 1 },
    ];

    render(
      <PersonAccessRolesCard
        personId={PERSON_ID}
        linkedUser={LINKED_USER}
        isActiveTenantMember={true}
        roles={roles}
        assignedRoleIds={["role-admin"]}
        canAssign={true}
      />,
    );

    const checkbox = screen.getByRole("checkbox", { name: /Club Admin entziehen/ });
    fireEvent.click(checkbox);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("8. never renders 'Verknüpfung lösen' for an unauthorized caller (canAssign=false)", () => {
    render(
      <PersonAccessRolesCard
        personId={PERSON_ID}
        linkedUser={LINKED_USER}
        isActiveTenantMember={true}
        roles={ROLES}
        assignedRoleIds={[]}
        canAssign={false}
      />,
    );

    expect(screen.queryByText("Verknüpfung lösen")).toBeNull();
  });
});

describe("PersonAccessRolesCard — C1: link/unlink reuse the canonical /api/people/[id]/link-user path", () => {
  it("opening the picker fetches GET /api/people/linkable-users and lists eligible users", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        users: [{ userId: "user-2", firstName: "Anna", lastName: "Muster", email: "anna@example.test" }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <PersonAccessRolesCard
        personId={PERSON_ID}
        linkedUser={null}
        isActiveTenantMember={false}
        roles={[]}
        assignedRoleIds={[]}
        canAssign={true}
      />,
    );

    fireEvent.click(screen.getByText("Benutzerkonto verknüpfen"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/people/linkable-users"));
    expect(await screen.findByText("Anna Muster")).toBeTruthy();
    expect(screen.getByText("anna@example.test")).toBeTruthy();
  });

  it("linking a selected user POSTs to /api/people/[id]/link-user with { userId }", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/people/linkable-users") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            users: [{ userId: "user-2", firstName: "Anna", lastName: "Muster", email: "anna@example.test" }],
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ personId: PERSON_ID, userId: "user-2" }) });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <PersonAccessRolesCard
        personId={PERSON_ID}
        linkedUser={null}
        isActiveTenantMember={false}
        roles={[]}
        assignedRoleIds={[]}
        canAssign={true}
      />,
    );

    fireEvent.click(screen.getByText("Benutzerkonto verknüpfen"));
    fireEvent.click(await screen.findByText("Verknüpfen"));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/people/${PERSON_ID}/link-user`,
        expect.objectContaining({ method: "POST", body: JSON.stringify({ userId: "user-2" }) }),
      ),
    );
  });

  it("filters the eligible list client-side by name/email", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        users: [
          { userId: "user-2", firstName: "Anna", lastName: "Muster", email: "anna@example.test" },
          { userId: "user-3", firstName: "Beat", lastName: "Meier", email: "beat@example.test" },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <PersonAccessRolesCard
        personId={PERSON_ID}
        linkedUser={null}
        isActiveTenantMember={false}
        roles={[]}
        assignedRoleIds={[]}
        canAssign={true}
      />,
    );

    fireEvent.click(screen.getByText("Benutzerkonto verknüpfen"));
    await screen.findByText("Anna Muster");
    expect(screen.getByText("Beat Meier")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Benutzer suchen"), { target: { value: "beat" } });

    expect(screen.queryByText("Anna Muster")).toBeNull();
    expect(screen.getByText("Beat Meier")).toBeTruthy();
  });

  it("unlinking DELETEs /api/people/[id]/link-user", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ unlinked: true }) });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <PersonAccessRolesCard
        personId={PERSON_ID}
        linkedUser={LINKED_USER}
        isActiveTenantMember={true}
        roles={ROLES}
        assignedRoleIds={[]}
        canAssign={true}
      />,
    );

    fireEvent.click(screen.getByText("Verknüpfung lösen"));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(`/api/people/${PERSON_ID}/link-user`, expect.objectContaining({ method: "DELETE" })),
    );
    confirmSpy.mockRestore();
  });

  it("unlink is aborted when the confirm dialog is dismissed", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <PersonAccessRolesCard
        personId={PERSON_ID}
        linkedUser={LINKED_USER}
        isActiveTenantMember={true}
        roles={ROLES}
        assignedRoleIds={[]}
        canAssign={true}
      />,
    );

    fireEvent.click(screen.getByText("Verknüpfung lösen"));

    expect(fetchMock).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
