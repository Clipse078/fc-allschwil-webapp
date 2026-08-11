/**
 * @vitest-environment jsdom
 *
 * components/admin/training/__tests__/TrainingSeriesDeleteControl.test.tsx
 *
 * ADMIN-DELETE-02A-C1 — focused UI tests for the permanent "Löschen"
 * action on a TrainingSeries. `canDelete` is an independent authority
 * signal from trainings.manage (archive/edit) — this suite verifies:
 *   - the control only renders when the caller holds trainings.delete
 *   - clicking "Löschen" opens the confirmation dialog and fetches impact
 *   - impact (e.g. generated sessions) is shown as a WARNING, never as a
 *     reason the "Endgültig löschen" confirm button is disabled
 *   - confirming calls the permanent-delete endpoint with ?confirm=true
 */

import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import TrainingSeriesDeleteControl from "@/components/admin/training/TrainingSeriesDeleteControl";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

const BASE_PROPS = {
  seriesId: "series-1",
  seriesTitle: "U13 Dienstag/Donnerstag",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TrainingSeriesDeleteControl — ADMIN-DELETE-02A permission gating", () => {
  it("renders nothing for a trainings.manage-only caller (canDelete=false)", () => {
    const { container } = render(<TrainingSeriesDeleteControl {...BASE_PROPS} canDelete={false} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows the Löschen button for a trainings.delete-authorized caller", () => {
    render(<TrainingSeriesDeleteControl {...BASE_PROPS} canDelete={true} />);

    expect(screen.getByText("Löschen")).toBeTruthy();
  });
});

describe("TrainingSeriesDeleteControl — ADMIN-DELETE-02A-C1 impact never blocks", () => {
  it("shows generated sessions as impact (warning), and the confirm button stays enabled", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          impact: [{ key: "sessions", label: "Generierte Trainingseinheiten", count: 8 }],
          requiresConfirmation: true,
        }),
      }),
    );

    render(<TrainingSeriesDeleteControl {...BASE_PROPS} canDelete={true} />);
    fireEvent.click(screen.getByText("Löschen"));

    await waitFor(() => {
      expect(screen.getByText(/Generierte Trainingseinheiten: 8/)).toBeTruthy();
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/training-series/series-1/permanent",
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

    render(<TrainingSeriesDeleteControl {...BASE_PROPS} canDelete={true} />);
    fireEvent.click(screen.getByText("Löschen"));

    // Wait for the impact preview fetch to resolve so the confirm button is
    // no longer disabled (loadingImpact=false).
    await waitFor(() => {
      expect(
        screen.getByText(/Keine generierten Termine, Ressourcen-Zuordnungen/),
      ).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Endgültig löschen" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/training-series/series-1/permanent?confirm=true",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard/training");
    });
  });
});

describe("TrainingSeriesDeleteControl — inline variant (Serien-Verwaltung list)", () => {
  it("renders the compact inline trigger when variant='inline'", () => {
    render(<TrainingSeriesDeleteControl {...BASE_PROPS} canDelete={true} variant="inline" />);

    expect(screen.getByTestId("training-series-delete-inline")).toBeTruthy();
  });
});
