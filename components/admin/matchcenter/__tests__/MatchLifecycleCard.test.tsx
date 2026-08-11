/**
 * @vitest-environment jsdom
 *
 * components/admin/matchcenter/__tests__/MatchLifecycleCard.test.tsx
 *
 * ADMIN-DELETE-02A-C1 — focused UI tests for the permanent "Löschen"
 * action on a Match. `canDelete` is an independent authority signal from
 * events.manage — this suite verifies:
 *   - the control only renders when the caller holds matches.delete
 *   - clicking "Löschen" opens the confirmation dialog and fetches impact
 *   - an SFV/provider mapping is shown as a WARNING, never as a reason the
 *     "Endgültig löschen" confirm button is disabled
 *   - confirming calls the permanent-delete endpoint with ?confirm=true
 */

import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import MatchLifecycleCard from "@/components/admin/matchcenter/MatchLifecycleCard";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

const BASE_PROPS = {
  matchId: "match-1",
  matchTitle: "FC Allschwil vs. FC Aesch",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MatchLifecycleCard — ADMIN-DELETE-02A permission gating", () => {
  it("renders nothing for an events.manage-only caller (canDelete=false)", () => {
    const { container } = render(<MatchLifecycleCard {...BASE_PROPS} canDelete={false} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows the Löschen button for a matches.delete-authorized caller", () => {
    render(<MatchLifecycleCard {...BASE_PROPS} canDelete={true} />);

    expect(screen.getByText("Löschen")).toBeTruthy();
  });
});

describe("MatchLifecycleCard — ADMIN-DELETE-02A-C1 impact never blocks", () => {
  it("shows an SFV/provider mapping as impact (warning), and the confirm button stays enabled", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          impact: [{ key: "providerMapping", label: "Anbieter-/SFV-Zuordnung", count: 1 }],
          requiresConfirmation: true,
        }),
      }),
    );

    render(<MatchLifecycleCard {...BASE_PROPS} canDelete={true} />);
    fireEvent.click(screen.getByText("Löschen"));

    await waitFor(() => {
      expect(screen.getByText(/Anbieter-\/SFV-Zuordnung: 1/)).toBeTruthy();
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/matchcenter/match-1",
      expect.objectContaining({ method: "DELETE" }),
    );

    const confirmButton = screen.getByRole("button", { name: "Endgültig löschen" });
    expect(confirmButton).not.toBeDisabled();
  });

  it("confirming calls the permanent-delete endpoint with ?confirm=true and navigates away", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ impact: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ message: "ok", impact: [] }) });
    vi.stubGlobal("fetch", fetchMock);

    render(<MatchLifecycleCard {...BASE_PROPS} canDelete={true} />);
    fireEvent.click(screen.getByText("Löschen"));

    await waitFor(() => {
      expect(
        screen.getByText(/Keine Anbieter-Zuordnung, Spielstand-Historie/),
      ).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Endgültig löschen" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/matchcenter/match-1?confirm=true",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard/matchcenter");
    });
  });
});
