/**
 * @vitest-environment jsdom
 *
 * components/admin/persons/__tests__/PersonAccessRolesCard.test.tsx
 *
 * ADMIN-MASTERDATA-UX-01 (Part A) — Person detail "Zugang & Rollen" card.
 * Covers the remaining task test-list items not already exercised against
 * a live DB (lib/roles/__tests__/admin-masterdata-ux-01-person-role-assignment.test.ts):
 *
 *   6. unauthorized user cannot assign/remove (canAssign=false renders
 *      read-only, never issues a mutating fetch)
 *   7. Person without a linked User shows the no-account state
 *   +  assign/remove call the exact canonical
 *      POST/DELETE /api/tenant/roles/[id]/members endpoints
 *      (RoleAssignmentPanel reuse — no parallel mutation path)
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PersonAccessRolesCard from "@/components/admin/persons/PersonAccessRolesCard";

const LINKED_USER = { id: "user-1", email: "trainer@example.test" };
const ROLES = [
  { id: "role-trainer", name: "Trainer", isSystem: false, isArchived: false },
  { id: "role-admin", name: "Club Admin", isSystem: true, isArchived: false },
  { id: "role-archived", name: "Alt-Rolle", isSystem: false, isArchived: true },
];

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("PersonAccessRolesCard — no linked account", () => {
  it("7. shows the exact 'Kein Benutzerkonto verknüpft' no-account state", () => {
    render(
      <PersonAccessRolesCard
        linkedUser={null}
        isActiveTenantMember={false}
        roles={[]}
        assignedRoleIds={[]}
        canAssign={false}
      />,
    );

    expect(screen.getByText("Kein Benutzerkonto verknüpft")).toBeTruthy();
  });
});

describe("PersonAccessRolesCard — linked account, roles render", () => {
  it("shows the linked account email and current tenant roles, excluding archived roles", () => {
    render(
      <PersonAccessRolesCard
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
});
