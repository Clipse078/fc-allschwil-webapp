/**
 * @vitest-environment jsdom
 */

/**
 * components/infoboard/admin/__tests__/InfoboardThemeToggle.test.tsx
 *
 * INFOBOARD-INTEGRATION-01B — focused tests for the Dark/Light segmented
 * toggle control.
 *
 * Verifies:
 *   - Renders both options with the initial theme marked active
 *   - Clicking the inactive option calls PATCH with the new theme
 *   - Clicking the already-active option does not call PATCH again
 *   - Displays an error message when the request fails
 *   - Refreshes the route after a successful save
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

import { InfoboardThemeToggle } from "../InfoboardThemeToggle";

describe("InfoboardThemeToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ theme: "LIGHT" }),
      }),
    );
  });

  it("renders both Dark and Light options", () => {
    render(<InfoboardThemeToggle initialTheme="DARK" />);
    expect(screen.getByTestId("infoboard-theme-option-dark")).toBeTruthy();
    expect(screen.getByTestId("infoboard-theme-option-light")).toBeTruthy();
  });

  it("marks the initial theme as active (aria-checked)", () => {
    render(<InfoboardThemeToggle initialTheme="DARK" />);
    expect(screen.getByTestId("infoboard-theme-option-dark").getAttribute("aria-checked")).toBe(
      "true",
    );
    expect(screen.getByTestId("infoboard-theme-option-light").getAttribute("aria-checked")).toBe(
      "false",
    );
  });

  it("marks LIGHT as active when initialTheme is LIGHT", () => {
    render(<InfoboardThemeToggle initialTheme="LIGHT" />);
    expect(screen.getByTestId("infoboard-theme-option-light").getAttribute("aria-checked")).toBe(
      "true",
    );
  });

  it("clicking the inactive option calls PATCH with the new theme", async () => {
    const user = userEvent.setup();
    render(<InfoboardThemeToggle initialTheme="DARK" />);

    await user.click(screen.getByTestId("infoboard-theme-option-light"));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/infoboard/display-settings",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ theme: "LIGHT" }),
        }),
      );
    });
  });

  it("updates aria-checked after a successful save", async () => {
    const user = userEvent.setup();
    render(<InfoboardThemeToggle initialTheme="DARK" />);

    await user.click(screen.getByTestId("infoboard-theme-option-light"));

    await waitFor(() => {
      expect(
        screen.getByTestId("infoboard-theme-option-light").getAttribute("aria-checked"),
      ).toBe("true");
    });
  });

  it("refreshes the route after a successful save", async () => {
    const user = userEvent.setup();
    render(<InfoboardThemeToggle initialTheme="DARK" />);

    await user.click(screen.getByTestId("infoboard-theme-option-light"));

    await waitFor(() => {
      expect(mocks.refresh).toHaveBeenCalled();
    });
  });

  it("does not call fetch when clicking the already-active option", async () => {
    const user = userEvent.setup();
    render(<InfoboardThemeToggle initialTheme="DARK" />);

    await user.click(screen.getByTestId("infoboard-theme-option-dark"));

    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows an error message when the save request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Fehler beim Speichern." }),
      }),
    );
    const user = userEvent.setup();
    render(<InfoboardThemeToggle initialTheme="DARK" />);

    await user.click(screen.getByTestId("infoboard-theme-option-light"));

    await waitFor(() => {
      expect(screen.getByText("Fehler beim Speichern.")).toBeTruthy();
    });
    // Selection is not switched on failure.
    expect(screen.getByTestId("infoboard-theme-option-dark").getAttribute("aria-checked")).toBe(
      "true",
    );
  });
});
