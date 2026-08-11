/**
 * @vitest-environment jsdom
 *
 * components/admin/matchcenter/__tests__/MatchLifecycleCard.test.tsx
 *
 * ADMIN-DELETE-02A — focused UI-gating tests for the permanent "Löschen"
 * action on a Match. `canDelete` is an independent authority signal from
 * events.manage — this suite verifies the control only renders when the
 * caller holds matches.delete.
 *
 * No network/fetch calls are exercised here.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MatchLifecycleCard from "@/components/admin/matchcenter/MatchLifecycleCard";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const BASE_PROPS = {
  matchId: "match-1",
  matchTitle: "FC Allschwil vs. FC Aesch",
};

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
