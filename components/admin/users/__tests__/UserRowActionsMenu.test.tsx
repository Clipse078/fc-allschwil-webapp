/**
 * @vitest-environment jsdom
 *
 * ADMIN-HARD-DELETE — focused tests for the Benutzer delete/removal UI.
 *
 * Test matrix:
 *  1. Club Admin sees "Aus Verein entfernen" in ••• menu.
 *  2. Person-only rows have no ••• actions menu rendered.
 *  3. Ordinary tenant user without management authority sees no ••• menu.
 *  7. Global delete is hidden from Club Admin (canGlobalDelete=false).
 *  8. Platform global delete link is present for platform-authorized users.
 *  9. Pending invitation row shows "Einladung widerrufen", NOT membership removal.
 *
 * Tests 4, 5, 6 (API-level safety) live in:
 *   app/api/admin/users/[userId]/membership/__tests__/membership-remove-safety.test.ts
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import UserRowActionsMenu from "@/components/admin/users/UserRowActionsMenu";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

// Render Dialog children inline (no portal magic in tests).
vi.mock("@/components/ui/Dialog", () => ({
  Dialog: ({ open, children, footer, title }: {
    open: boolean;
    children: React.ReactNode;
    footer?: React.ReactNode;
    title?: string;
  }) =>
    open ? (
      <div role="dialog" aria-label={title ?? "dialog"}>
        {children}
        {footer}
      </div>
    ) : null,
}));

vi.mock("@/components/ui/Button", () => ({
  Button: ({ children, onClick, disabled, loading }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    loading?: boolean;
  }) => (
    <button onClick={onClick} disabled={disabled || loading}>
      {children}
    </button>
  ),
}));

// ── Shared fixtures ───────────────────────────────────────────────────────────

const BASE_PROPS = {
  userId: "user-1",
  userName: "Max Muster",
  userEmail: "max@example.com",
  pendingInvitation: false,
  isSelf: false,
  linkedPersonName: null,
  tenantRoleNames: [],
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("UserRowActionsMenu", () => {
  /**
   * Test 1 — Club Admin (canManageMembership=true, canGlobalDelete=false)
   * should see "Aus Verein entfernen" after opening the ••• menu.
   */
  it("1. Club Admin sees 'Aus Verein entfernen' in the ••• menu", async () => {
    const user = userEvent.setup();
    render(
      <UserRowActionsMenu
        {...BASE_PROPS}
        canManageMembership={true}
        canGlobalDelete={false}
      />,
    );

    const moreBtn = screen.getByRole("button", { name: /mehr aktionen/i });
    await user.click(moreBtn);

    expect(screen.getByText("Aus Verein entfernen")).toBeInTheDocument();
  });

  /**
   * Test 2 — Person-only rows (no userId / no UserRowActionsMenu rendered at all).
   * We verify that the component returns null when both flags are false —
   * the list never renders the menu on person-only rows because those rows
   * don't call UserRowActionsMenu (integration-level assertion via null return).
   */
  it("2. Returns null when neither canManageMembership nor canGlobalDelete", () => {
    const { container } = render(
      <UserRowActionsMenu
        {...BASE_PROPS}
        canManageMembership={false}
        canGlobalDelete={false}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  /**
   * Test 3 — Ordinary tenant user without management authority:
   * no ••• button at all.
   */
  it("3. Ordinary tenant user without authority sees no ••• menu", () => {
    render(
      <UserRowActionsMenu
        {...BASE_PROPS}
        canManageMembership={false}
        canGlobalDelete={false}
      />,
    );
    expect(screen.queryByRole("button", { name: /mehr aktionen/i })).not.toBeInTheDocument();
  });

  /**
   * Test 7 — Club Admin (canGlobalDelete=false) must NOT see
   * "Benutzer endgültig löschen".
   */
  it("7. Global delete is hidden from Club Admin (canGlobalDelete=false)", async () => {
    const user = userEvent.setup();
    render(
      <UserRowActionsMenu
        {...BASE_PROPS}
        canManageMembership={true}
        canGlobalDelete={false}
      />,
    );

    const moreBtn = screen.getByRole("button", { name: /mehr aktionen/i });
    await user.click(moreBtn);

    expect(screen.queryByText(/endgültig löschen/i)).not.toBeInTheDocument();
  });

  /**
   * Test 8 — Platform-authorized user (canGlobalDelete=true) sees
   * "Benutzer endgültig löschen" linking to the platform detail page.
   */
  it("8. Platform global delete link is present for platform-authorized user", async () => {
    const user = userEvent.setup();
    render(
      <UserRowActionsMenu
        {...BASE_PROPS}
        canManageMembership={false}
        canGlobalDelete={true}
      />,
    );

    const moreBtn = screen.getByRole("button", { name: /mehr aktionen/i });
    await user.click(moreBtn);

    const link = screen.getByText(/endgültig löschen/i).closest("a");
    expect(link).not.toBeNull();
    expect(link).toHaveAttribute("href", `/dashboard/users/${BASE_PROPS.userId}`);
  });

  /**
   * Test 9 — Pending invitation row shows "Einladung widerrufen",
   * NOT "Aus Verein entfernen" (membership deletion flow).
   * Clicking it opens the revoke dialog, not the removal dialog.
   */
  it("9. Pending invitation row shows 'Einladung widerrufen', not membership removal", async () => {
    const user = userEvent.setup();
    render(
      <UserRowActionsMenu
        {...BASE_PROPS}
        pendingInvitation={true}
        canManageMembership={true}
        canGlobalDelete={false}
      />,
    );

    const moreBtn = screen.getByRole("button", { name: /mehr aktionen/i });
    await user.click(moreBtn);

    expect(screen.getByText("Einladung widerrufen")).toBeInTheDocument();
    expect(screen.queryByText("Aus Verein entfernen")).not.toBeInTheDocument();
  });

  /**
   * Test 9b — Clicking "Einladung widerrufen" opens the revoke confirmation dialog,
   * NOT the membership removal dialog.
   */
  it("9b. Pending invitation: clicking action opens revoke dialog (not removal dialog)", async () => {
    const user = userEvent.setup();
    render(
      <UserRowActionsMenu
        {...BASE_PROPS}
        pendingInvitation={true}
        canManageMembership={true}
        canGlobalDelete={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: /mehr aktionen/i }));
    await user.click(screen.getByText("Einladung widerrufen"));

    // Revoke dialog title visible, removal dialog title NOT visible
    expect(screen.getByRole("dialog", { name: /einladung widerrufen/i })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: /aus verein entfernen/i })).not.toBeInTheDocument();
  });
});
