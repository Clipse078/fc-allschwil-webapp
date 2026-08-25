/**
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import MatchcenterTeamFilter from "@/components/admin/matchcenter/MatchcenterTeamFilter";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const DEFAULT_PROPS = {
  teams: [
    { id: "team-1", label: "Junioren F2" },
    { id: "team-2", label: "Frauen 1" },
  ],
  teamFilter: null as string | null,
  basePath: "/dashboard/matchcenter",
  tab: "SPIELPLANUNG" as const,
  month: "2026-08",
  actionFilter: "ALLE" as const,
  wochenplanFilter: "ALLE" as const,
};

function renderFilter(
  overrides: Partial<typeof DEFAULT_PROPS> = {},
) {
  return render(<MatchcenterTeamFilter {...DEFAULT_PROPS} {...overrides} />);
}

describe("MatchcenterTeamFilter — interaction regression", () => {
  beforeEach(() => {
    push.mockReset();
  });

  it("opens the dropdown and navigates with the canonical team id on selection", async () => {
    const user = userEvent.setup();
    renderFilter();

    await user.click(screen.getByTestId("matchcenter-team-filter-trigger"));
    expect(screen.getByTestId("matchcenter-team-filter-menu")).toBeInTheDocument();

    await user.click(screen.getByTestId("matchcenter-team-filter-option-team-1"));

    expect(push).toHaveBeenCalledWith(
      "/dashboard/matchcenter?tab=spielplanung&month=2026-08&filter=alle&team=team-1",
    );
    expect(screen.queryByTestId("matchcenter-team-filter-menu")).toBeNull();
  });

  it("removes the team query parameter when Alle Teams is selected", async () => {
    const user = userEvent.setup();
    renderFilter({ teamFilter: "team-1" });

    await user.click(screen.getByTestId("matchcenter-team-filter-trigger"));
    await user.click(screen.getByTestId("matchcenter-team-filter-all"));

    expect(push).toHaveBeenCalledWith(
      "/dashboard/matchcenter?tab=spielplanung&month=2026-08&filter=alle",
    );
    expect(push.mock.calls[0]?.[0]).not.toContain("team=");
  });

  it("clears the active team via the inline reset control", async () => {
    const user = userEvent.setup();
    renderFilter({ teamFilter: "team-2" });

    await user.click(screen.getByTestId("matchcenter-team-filter-clear"));

    expect(push).toHaveBeenCalledWith(
      "/dashboard/matchcenter?tab=spielplanung&month=2026-08&filter=alle",
    );
  });

  it("preserves Spielplanung filter params when selecting a team", async () => {
    const user = userEvent.setup();
    renderFilter({ actionFilter: "OFFEN" });

    await user.click(screen.getByTestId("matchcenter-team-filter-trigger"));
    await user.click(screen.getByTestId("matchcenter-team-filter-option-team-2"));

    expect(push).toHaveBeenCalledWith(
      "/dashboard/matchcenter?tab=spielplanung&month=2026-08&filter=offen&team=team-2",
    );
  });

  it("builds Resultate navigation with team only (no Spielplanung filter param)", async () => {
    const user = userEvent.setup();
    renderFilter({ tab: "RESULTATE" });

    await user.click(screen.getByTestId("matchcenter-team-filter-trigger"));
    await user.click(screen.getByTestId("matchcenter-team-filter-option-team-1"));

    expect(push).toHaveBeenCalledWith(
      "/dashboard/matchcenter?tab=resultate&month=2026-08&team=team-1",
    );
    expect(push.mock.calls[0]?.[0]).not.toContain("filter=");
  });

  it("shows the selected team label in the trigger", () => {
    renderFilter({ teamFilter: "team-1" });

    expect(screen.getByTestId("matchcenter-team-filter-trigger")).toHaveTextContent(
      "Junioren F2",
    );
  });

  it("filters the visible options while searching", async () => {
    const user = userEvent.setup();
    const manyTeams = Array.from({ length: 10 }, (_, index) => ({
      id: `team-${index + 1}`,
      label: `Team ${index + 1}`,
    }));

    renderFilter({ teams: manyTeams });

    await user.click(screen.getByTestId("matchcenter-team-filter-trigger"));
    expect(screen.getByTestId("matchcenter-team-filter-search")).toBeInTheDocument();

    await user.type(screen.getByTestId("matchcenter-team-filter-search"), "Team 3");

    expect(
      screen.getByTestId("matchcenter-team-filter-option-team-3"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("matchcenter-team-filter-option-team-1"),
    ).toBeNull();
  });
});
