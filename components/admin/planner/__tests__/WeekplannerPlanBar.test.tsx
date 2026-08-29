/**
 * @vitest-environment jsdom
 *
 * components/admin/planner/__tests__/WeekplannerPlanBar.test.tsx
 *
 * WOCHENPLAN-2.0-01H-D — plan bar tests for draft/active semantics.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WeekplannerPlanBar } from "@/components/admin/planner/WeekplannerPlanBar";
import type { WochenplanPlanDto } from "@/lib/wochenplan/plan-types";
import type { WeekplannerPlanDto } from "@/lib/weekplanner/plan-types";

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

function wochenplanPlan(overrides: Partial<WochenplanPlanDto> = {}): WochenplanPlanDto {
  return {
    id: "wcp-default",
    tenantId: "tenant-1",
    name: "Standardplan",
    description: null,
    isDefault: true,
    isActive: true,
    displayOrder: 0,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    archivedAt: null,
    ...overrides,
  };
}

function weekplannerPlan(overrides: Partial<WeekplannerPlanDto> = {}): WeekplannerPlanDto {
  return {
    id: "wp-schlechtwetter",
    tenantId: "tenant-1",
    weekId: "2026-08-25",
    name: "Schlechtwetterplan",
    createdByUserId: "user-1",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    archivedAt: null,
    isActive: false,
    wochenplanPlanId: "wcp-alt",
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

describe("WeekplannerPlanBar — selector and status", () => {
  it("shows active plan status when viewing the active plan", () => {
    render(
      <WeekplannerPlanBar
        weekParam="2026-08-25"
        wochenplanPlans={[wochenplanPlan(), wochenplanPlan({ id: "wcp-alt", name: "Schlechtwetterplan", isDefault: false, isActive: false })]}
        weekplannerPlans={[]}
        selectedPlanParam={null}
        materializedWeekplannerPlanId={null}
        canManage
      />,
    );

    const select = screen.getByTestId("weekplanner-plan-select") as HTMLSelectElement;
    expect(select.value).toBe("wcp-default");
    expect(screen.getByTestId("weekplanner-active-plan-banner")).toHaveTextContent("Aktiver Plan · Standardplan");
    expect(screen.queryByTestId("weekplanner-draft-plan-banner")).not.toBeInTheDocument();
  });

  it("shows draft status and current active reference when viewing a draft", () => {
    render(
      <WeekplannerPlanBar
        weekParam="2026-08-25"
        wochenplanPlans={[
          wochenplanPlan(),
          wochenplanPlan({ id: "wcp-alt", name: "Schlechtwetterplan", isDefault: false, isActive: false }),
        ]}
        weekplannerPlans={[weekplannerPlan()]}
        selectedPlanParam="wcp-alt"
        materializedWeekplannerPlanId="wp-schlechtwetter"
        canManage
      />,
    );

    expect(screen.getByTestId("weekplanner-draft-plan-banner")).toHaveTextContent("Entwurf · Schlechtwetterplan");
    expect(screen.getByTestId("weekplanner-current-active-reference")).toHaveTextContent("Aktuell aktiv: Standardplan");
    expect(screen.queryByTestId("weekplanner-public-plan-banner")).not.toBeInTheDocument();
    expect(screen.queryByTestId("weekplanner-operational-plan-banner")).not.toBeInTheDocument();
  });

  it("labels plans as Aktiv or Entwurf in the selector", () => {
    render(
      <WeekplannerPlanBar
        weekParam="2026-08-25"
        wochenplanPlans={[
          wochenplanPlan(),
          wochenplanPlan({ id: "wcp-alt", name: "Schlechtwetterplan", isDefault: false, isActive: false }),
        ]}
        weekplannerPlans={[]}
        selectedPlanParam={null}
        materializedWeekplannerPlanId={null}
        canManage
      />,
    );

    expect(screen.getByRole("option", { name: "Standardplan — Aktiv" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Schlechtwetterplan — Entwurf" })).toBeInTheDocument();
  });
});

describe("WeekplannerPlanBar — create plan dialog", () => {
  it("creates an empty plan via the API and navigates to it", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(
        {
          plan: wochenplanPlan({ id: "wcp-new", name: "Schlechtwetterplan", isDefault: false, isActive: false }),
          weekplannerPlan: weekplannerPlan({ id: "wp-new", wochenplanPlanId: "wcp-new" }),
        },
        201,
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <WeekplannerPlanBar
        weekParam="2026-08-25"
        wochenplanPlans={[wochenplanPlan()]}
        weekplannerPlans={[]}
        selectedPlanParam={null}
        materializedWeekplannerPlanId={null}
        canManage
      />,
    );

    fireEvent.click(screen.getByTestId("weekplanner-plan-create-button"));
    fireEvent.change(screen.getByTestId("weekplanner-plan-create-name"), {
      target: { value: "Schlechtwetterplan" },
    });
    fireEvent.click(screen.getByTestId("weekplanner-plan-create-submit"));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/wochenplan/plans",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            name: "Schlechtwetterplan",
            weekId: "2026-08-25",
            mode: "empty",
          }),
        }),
      ),
    );
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/dashboard/planner/week?week=2026-08-25&plan=wcp-new"),
    );
  });

  it("creates a copied plan when copy mode is selected", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(
        {
          plan: wochenplanPlan({ id: "wcp-copy", name: "Fernwetterplan", isDefault: false, isActive: false }),
          weekplannerPlan: weekplannerPlan({ id: "wp-copy", name: "Fernwetterplan", wochenplanPlanId: "wcp-copy" }),
        },
        201,
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <WeekplannerPlanBar
        weekParam="2026-08-25"
        wochenplanPlans={[wochenplanPlan()]}
        weekplannerPlans={[]}
        selectedPlanParam={null}
        materializedWeekplannerPlanId={null}
        canManage
      />,
    );

    fireEvent.click(screen.getByTestId("weekplanner-plan-create-button"));
    fireEvent.change(screen.getByTestId("weekplanner-plan-create-name"), {
      target: { value: "Fernwetterplan" },
    });
    fireEvent.click(screen.getByTestId("weekplanner-plan-create-mode-copy"));
    fireEvent.click(screen.getByTestId("weekplanner-plan-create-submit"));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/wochenplan/plans",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            name: "Fernwetterplan",
            weekId: "2026-08-25",
            mode: "copy",
            sourceWochenplanPlanId: "wcp-default",
          }),
        }),
      ),
    );
  });
});

describe("WeekplannerPlanBar — activation", () => {
  it("activates the viewed draft via tenant-level WochenplanPlan API after confirmation", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ plan: wochenplanPlan({ id: "wcp-alt", isActive: true }) }, 200));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <WeekplannerPlanBar
        weekParam="2026-08-25"
        wochenplanPlans={[wochenplanPlan(), wochenplanPlan({ id: "wcp-alt", name: "Schlechtwetterplan", isDefault: false, isActive: false })]}
        weekplannerPlans={[weekplannerPlan()]}
        selectedPlanParam="wcp-alt"
        materializedWeekplannerPlanId="wp-schlechtwetter"
        canManage
      />,
    );

    fireEvent.click(screen.getByTestId("weekplanner-plan-activate-button"));
    fireEvent.click(screen.getByRole("button", { name: "Aktivieren" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/wochenplan/plans/wcp-alt",
        expect.objectContaining({ method: "PATCH", body: JSON.stringify({ active: true }) }),
      ),
    );
  });

  it("hides management actions for read-only viewers", () => {
    render(
      <WeekplannerPlanBar
        weekParam="2026-08-25"
        wochenplanPlans={[wochenplanPlan()]}
        weekplannerPlans={[]}
        selectedPlanParam={null}
        materializedWeekplannerPlanId={null}
        canManage={false}
      />,
    );

    expect(screen.queryByTestId("weekplanner-plan-create-button")).not.toBeInTheDocument();
    expect(screen.getByTestId("weekplanner-plan-select")).toBeInTheDocument();
  });
});
