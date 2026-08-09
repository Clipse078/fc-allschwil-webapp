/**
 * @vitest-environment jsdom
 *
 * components/admin/planner/__tests__/WeekplannerPlanBar.test.tsx
 *
 * WEEKPLANNER-01C — focused tests for the plan bar's operational UX:
 *   - Standardplan shown as the default, selectable alongside alternatives
 *   - create an alternative plan
 *   - rename the active alternative plan
 *   - archive the active alternative plan
 *   - delete the active alternative plan
 *   - "Alternativplan aktiv" banner only shown while an alternative is selected
 *   - management actions hidden entirely for read-only viewers
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WeekplannerPlanBar } from "@/components/admin/planner/WeekplannerPlanBar";
import type { WeekplannerPlanDto } from "@/lib/weekplanner/plan-types";

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

function plan(overrides: Partial<WeekplannerPlanDto> = {}): WeekplannerPlanDto {
  return {
    id: "plan-schlechtwetter",
    tenantId: "tenant-1",
    weekId: "2026-08-10",
    name: "Schlechtwetterplan",
    createdByUserId: "user-1",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    archivedAt: null,
    isActive: false,
    ...overrides,
  };
}

function jsonResponse(data: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => data } as Response;
}

beforeEach(() => {
  vi.restoreAllMocks();
  pushMock.mockClear();
  refreshMock.mockClear();
});

describe("WeekplannerPlanBar — Standardplan default + alternative selector", () => {
  it("shows Standardplan selected by default alongside available alternatives, with no active-plan banner", () => {
    render(
      <WeekplannerPlanBar weekParam="2026-08-10" plans={[plan()]} activePlanId={null} canManage />,
    );

    const select = screen.getByTestId("weekplanner-plan-select") as HTMLSelectElement;
    expect(select.value).toBe("");
    expect(screen.getByRole("option", { name: "Standardplan" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Schlechtwetterplan" })).toBeInTheDocument();
    expect(screen.queryByTestId("weekplanner-active-plan-banner")).not.toBeInTheDocument();
  });

  it("navigates to the selected alternative plan and shows the active-plan banner", () => {
    render(
      <WeekplannerPlanBar weekParam="2026-08-10" plans={[plan()]} activePlanId="plan-schlechtwetter" canManage />,
    );

    fireEvent.change(screen.getByTestId("weekplanner-plan-select"), { target: { value: "plan-schlechtwetter" } });
    expect(pushMock).toHaveBeenCalledWith("/dashboard/planner/week?week=2026-08-10&plan=plan-schlechtwetter");

    const banner = screen.getByTestId("weekplanner-active-plan-banner");
    expect(banner).toHaveTextContent("Alternativplan aktiv");
    expect(banner).toHaveTextContent("Schlechtwetterplan");
  });

  it("switching back to Standardplan drops the plan query param", () => {
    render(
      <WeekplannerPlanBar weekParam="2026-08-10" plans={[plan()]} activePlanId="plan-schlechtwetter" canManage />,
    );

    fireEvent.change(screen.getByTestId("weekplanner-plan-select"), { target: { value: "" } });
    expect(pushMock).toHaveBeenCalledWith("/dashboard/planner/week?week=2026-08-10");
  });
});

describe("WeekplannerPlanBar — create/rename/archive/delete lifecycle", () => {
  it("creates a new alternative plan and navigates to it", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ plan: plan({ id: "plan-new", name: "Ferienplan" }) }, 201));
    vi.stubGlobal("fetch", fetchMock);

    render(<WeekplannerPlanBar weekParam="2026-08-10" plans={[]} activePlanId={null} canManage />);

    fireEvent.click(screen.getByTestId("weekplanner-plan-create-button"));
    fireEvent.change(screen.getByTestId("weekplanner-plan-create-input"), { target: { value: "Ferienplan" } });
    fireEvent.click(screen.getByTestId("weekplanner-plan-create-submit"));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/weekplanner/plans",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ weekId: "2026-08-10", name: "Ferienplan" }) }),
      ),
    );
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard/planner/week?week=2026-08-10&plan=plan-new"));
  });

  it("renames the active alternative plan", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ plan: plan({ name: "Winterplan" }) }, 200));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <WeekplannerPlanBar weekParam="2026-08-10" plans={[plan()]} activePlanId="plan-schlechtwetter" canManage />,
    );

    fireEvent.click(screen.getByTestId("weekplanner-plan-rename-button"));
    fireEvent.change(screen.getByTestId("weekplanner-plan-rename-input"), { target: { value: "Winterplan" } });
    fireEvent.click(screen.getByTestId("weekplanner-plan-rename-submit"));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/weekplanner/plans/plan-schlechtwetter",
        expect.objectContaining({ method: "PATCH", body: JSON.stringify({ name: "Winterplan" }) }),
      ),
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it("archives the active alternative plan and returns to Standardplan", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ plan: plan({ archivedAt: "2026-08-05T00:00:00.000Z" }) }, 200));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <WeekplannerPlanBar weekParam="2026-08-10" plans={[plan()]} activePlanId="plan-schlechtwetter" canManage />,
    );

    fireEvent.click(screen.getByTestId("weekplanner-plan-archive-button"));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/weekplanner/plans/plan-schlechtwetter",
        expect.objectContaining({ method: "PATCH", body: JSON.stringify({ archived: true }) }),
      ),
    );
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard/planner/week?week=2026-08-10"));
  });

  it("deletes the active alternative plan (safe delete) and returns to Standardplan", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({}, 204));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <WeekplannerPlanBar weekParam="2026-08-10" plans={[plan()]} activePlanId="plan-schlechtwetter" canManage />,
    );

    fireEvent.click(screen.getByTestId("weekplanner-plan-delete-button"));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/weekplanner/plans/plan-schlechtwetter", expect.objectContaining({ method: "DELETE" })),
    );
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard/planner/week?week=2026-08-10"));
  });

  it("surfaces the unsafe-delete guardrail error without navigating away", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ error: "Plan enthält noch Overrides" }, 409));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <WeekplannerPlanBar weekParam="2026-08-10" plans={[plan()]} activePlanId="plan-schlechtwetter" canManage />,
    );

    fireEvent.click(screen.getByTestId("weekplanner-plan-delete-button"));

    expect(await screen.findByTestId("weekplanner-plan-bar-error")).toHaveTextContent("Plan enthält noch Overrides");
    expect(pushMock).not.toHaveBeenCalled();
  });
});

describe("WeekplannerPlanBar — read-only viewers", () => {
  it("hides every management action for a viewer without manage permission", () => {
    render(
      <WeekplannerPlanBar weekParam="2026-08-10" plans={[plan()]} activePlanId="plan-schlechtwetter" canManage={false} />,
    );

    expect(screen.queryByTestId("weekplanner-plan-create-button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("weekplanner-plan-rename-button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("weekplanner-plan-archive-button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("weekplanner-plan-delete-button")).not.toBeInTheDocument();
    // The selector and active-plan banner remain visible — a viewer can still see which plan is active.
    expect(screen.getByTestId("weekplanner-plan-select")).toBeInTheDocument();
    expect(screen.getByTestId("weekplanner-active-plan-banner")).toBeInTheDocument();
  });
});
