/**
 * @vitest-environment jsdom
 *
 * components/admin/persons/__tests__/PersonDirectory.delete.test.tsx
 *
 * ADMIN-HARD-DELETE — PERSON LIST CONFIRM DIALOG BUG
 *
 * Proves that the list-row ••• → Endgültig löschen flow:
 *   1. row delete action triggers the impact preview (DELETE /permanent)
 *   2. preview response opens the confirmation Dialog
 *   3. no deletion occurs before confirmation
 *   4. confirm sends DELETE /permanent?confirm=true
 *   5. success removes the Person from the list and calls router.refresh()
 *   6. cancel performs no confirmed delete
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PersonDirectory from "@/components/admin/persons/PersonDirectory";
import type { PersonDirectoryItem } from "@/lib/people/queries";

const mockRefresh = vi.fn();
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh, push: mockPush }),
}));

const PERSON: PersonDirectoryItem = {
  id: "person-123",
  name: "Max Mustermann",
  firstName: "Max",
  lastName: "Mustermann",
  email: "max@example.test",
  phone: null,
  imageUrl: null,
  isActive: true,
  isPlayer: false,
  isTrainer: false,
  assignments: [],
};

const IMPACT = {
  squadMemberships: 0,
  trainerMemberships: 0,
  personAssignments: 0,
  orgUnitMemberships: 0,
  linkedRegistrations: 0,
  linkedUserId: null,
  linkedUserEmail: null,
};

function renderDirectory(fetchImpl?: typeof fetch) {
  if (fetchImpl) vi.stubGlobal("fetch", fetchImpl);

  return render(
    <PersonDirectory
      persons={[PERSON]}
      orgUnits={[]}
      teams={[]}
      canDelete
    />,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  mockRefresh.mockReset();
  mockPush.mockReset();
});

describe("PersonDirectory list-row hard-delete flow", () => {
  it("1. clicking ••• then Endgültig löschen fires DELETE /permanent (preview, no ?confirm)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ impact: IMPACT }),
    });
    renderDirectory(fetchMock);

    fireEvent.click(screen.getByLabelText("Mehr Optionen"));
    fireEvent.click(screen.getByText("Endgültig löschen"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/people/${PERSON.id}/permanent`);
    expect(init.method).toBe("DELETE");
    expect(url).not.toContain("confirm=true");
  });

  it("2. after preview succeeds the confirmation Dialog is visible", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ impact: IMPACT }),
    });
    renderDirectory(fetchMock);

    fireEvent.click(screen.getByLabelText("Mehr Optionen"));
    fireEvent.click(screen.getByText("Endgültig löschen"));

    expect(
      await screen.findByText("Person endgültig löschen"),
    ).toBeTruthy();
    expect(
      screen.getByText("Diese Aktion ist dauerhaft und kann nicht rückgängig gemacht werden."),
    ).toBeTruthy();
  });

  it("3. no ?confirm=true request is sent before the user confirms", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ impact: IMPACT }),
    });
    renderDirectory(fetchMock);

    fireEvent.click(screen.getByLabelText("Mehr Optionen"));
    fireEvent.click(screen.getByText("Endgültig löschen"));

    // Wait for dialog to appear (preview complete)
    await screen.findByText("Person endgültig löschen");

    // Only one fetch call so far (preview)
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).not.toContain("confirm=true");
  });

  it("4. clicking confirm in the Dialog sends DELETE /permanent?confirm=true", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ impact: IMPACT }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ deleted: true }),
      });
    renderDirectory(fetchMock);

    fireEvent.click(screen.getByLabelText("Mehr Optionen"));
    fireEvent.click(screen.getByText("Endgültig löschen"));

    // Wait for Dialog + impact loaded
    await screen.findByText("Diese Aktion ist dauerhaft und kann nicht rückgängig gemacht werden.");

    // Click the confirm button (second "Endgültig löschen" — in the dialog footer)
    const confirmButtons = screen.getAllByText("Endgültig löschen");
    // The footer button is the last one
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const [confirmUrl, confirmInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(confirmUrl).toBe(`/api/people/${PERSON.id}/permanent?confirm=true`);
    expect(confirmInit.method).toBe("DELETE");
  });

  it("5. successful deletion removes the Person row and calls router.refresh()", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ impact: IMPACT }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ deleted: true }),
      });
    renderDirectory(fetchMock);

    fireEvent.click(screen.getByLabelText("Mehr Optionen"));
    fireEvent.click(screen.getByText("Endgültig löschen"));

    await screen.findByText("Diese Aktion ist dauerhaft und kann nicht rückgängig gemacht werden.");

    const confirmButtons = screen.getAllByText("Endgültig löschen");
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));

    // Person should be filtered out of the list
    expect(screen.queryByText("Max Mustermann")).toBeNull();
  });

  it("6. cancel in the Dialog performs no confirmed DELETE and closes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ impact: IMPACT }),
    });
    renderDirectory(fetchMock);

    fireEvent.click(screen.getByLabelText("Mehr Optionen"));
    fireEvent.click(screen.getByText("Endgültig löschen"));

    await screen.findByText("Person endgültig löschen");

    fireEvent.click(screen.getByText("Abbrechen"));

    // Dialog disappears
    await waitFor(() =>
      expect(screen.queryByText("Person endgültig löschen")).toBeNull(),
    );

    // Still only the preview fetch — no confirm call
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});
