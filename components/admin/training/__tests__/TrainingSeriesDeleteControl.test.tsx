/**
 * @vitest-environment jsdom
 *
 * components/admin/training/__tests__/TrainingSeriesDeleteControl.test.tsx
 *
 * ADMIN-DELETE-02A — focused UI-gating tests for the permanent "Löschen"
 * action on a TrainingSeries. `canDelete` is an independent authority
 * signal from trainings.manage (archive/edit) — this suite verifies the
 * control only renders when the caller holds trainings.delete.
 *
 * No network/fetch calls are exercised here — these tests only verify
 * whether the control renders given the permission flag.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TrainingSeriesDeleteControl from "@/components/admin/training/TrainingSeriesDeleteControl";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const BASE_PROPS = {
  seriesId: "series-1",
  seriesTitle: "U13 Dienstag/Donnerstag",
};

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
