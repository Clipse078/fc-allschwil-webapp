/**
 * @vitest-environment jsdom
 *
 * components/admin/planner/__tests__/WeekplannerPlanBar.test.tsx
 *
 * WOCHENPLAN-2.0-01H-E5 — premium plan switcher tests.
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

describe("WeekplannerPlanBar — premium switcher", () => {
  it("lists active plan separately from drafts in the switcher panel", () => {
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

    fireEvent.click(screen.getByTestId("weekplanner-plan-switcher"));
    expect(screen.getByText("Plan auswählen")).toBeInTheDocument();
    expect(screen.getByText("Entwürfe")).toBeInTheDocument();
    expect(screen.getByTestId("weekplanner-plan-option-wcp-default")).toBeInTheDocument();
    expect(screen.getByTestId("weekplanner-plan-option-wcp-alt")).toBeInTheDocument();
  });

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

    expect(screen.getByTestId("weekplanner-active-plan-banner")).toHaveTextContent("Aktiver Plan · Standardplan");
  });

  it("shows draft status and active reference when viewing a draft", () => {
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
    expect(screen.getByTestId("weekplanner-current-active-reference")).toHaveTextContent("Aktiver Plan: Standardplan");
  });

  it("selecting a draft navigates without activating it", () => {
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

    fireEvent.click(screen.getByTestId("weekplanner-plan-switcher"));
    fireEvent.click(screen.getByTestId("weekplanner-plan-option-wcp-alt"));
    expect(pushMock).toHaveBeenCalledWith("/dashboard/planner/week?week=2026-08-25&plan=wcp-alt");
  });
});

describe("WeekplannerPlanBar — publish", () => {
  it("publishes the viewed draft after confirmation", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ plan: wochenplanPlan({ id: "wcp-alt", isActive: true }) }));
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

    fireEvent.click(screen.getByTestId("weekplanner-plan-publish-button"));
    fireEvent.click(screen.getByTestId("weekplanner-plan-publish-confirm"));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/wochenplan/plans/wcp-alt",
        expect.objectContaining({ method: "PATCH", body: JSON.stringify({ active: true }) }),
      ),
    );
  });
});

describe("WeekplannerPlanBar — hard delete", () => {
  it("shows delete confirmation identifying the plan", async () => {
    render(
      <WeekplannerPlanBar
        weekParam="2026-08-25"
        wochenplanPlans={[wochenplanPlan(), wochenplanPlan({ id: "wcp-alt", name: "Schlechtwetterplan", isDefault: false, isActive: false })]}
        weekplannerPlans={[]}
        selectedPlanParam="wcp-alt"
        materializedWeekplannerPlanId="wp-schlechtwetter"
        canManage
      />,
    );

    fireEvent.click(screen.getByTestId("weekplanner-plan-switcher"));
    fireEvent.click(screen.getByTestId("weekplanner-plan-overflow-wcp-alt"));
    fireEvent.click(screen.getByTestId("weekplanner-plan-delete-wcp-alt"));

    expect(screen.getByText('"Schlechtwetterplan" endgültig löschen?')).toBeInTheDocument();
    expect(screen.getByTestId("weekplanner-plan-delete-confirm")).toBeInTheDocument();
  });

  it("hard deletes a draft via DELETE API", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ deleted: { id: "wcp-alt", name: "Schlechtwetterplan" } }));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <WeekplannerPlanBar
        weekParam="2026-08-25"
        wochenplanPlans={[wochenplanPlan(), wochenplanPlan({ id: "wcp-alt", name: "Schlechtwetterplan", isDefault: false, isActive: false })]}
        weekplannerPlans={[]}
        selectedPlanParam="wcp-alt"
        materializedWeekplannerPlanId="wp-schlechtwetter"
        canManage
      />,
    );

    fireEvent.click(screen.getByTestId("weekplanner-plan-switcher"));
    fireEvent.click(screen.getByTestId("weekplanner-plan-overflow-wcp-alt"));
    fireEvent.click(screen.getByTestId("weekplanner-plan-delete-wcp-alt"));
    fireEvent.click(screen.getByTestId("weekplanner-plan-delete-confirm"));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/wochenplan/plans/wcp-alt",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
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
  });
});

describe("WeekplannerPlanBar — plan name readability", () => {
  it("renders full Schlechtwetterplan names without truncation class on option rows", () => {
    render(
      <WeekplannerPlanBar
        weekParam="2026-08-25"
        wochenplanPlans={[
          wochenplanPlan(),
          wochenplanPlan({ id: "wcp-alt", name: "Schlechtwetterplan", isDefault: false, isActive: false }),
          wochenplanPlan({ id: "wcp-test", name: "Schlechtwetterplan Test", isDefault: false, isActive: false }),
        ]}
        weekplannerPlans={[]}
        selectedPlanParam={null}
        materializedWeekplannerPlanId={null}
        canManage
      />,
    );

    fireEvent.click(screen.getByTestId("weekplanner-plan-switcher"));
    const altName = screen.getByTestId("weekplanner-plan-option-name-wcp-alt");
    const testName = screen.getByTestId("weekplanner-plan-option-name-wcp-test");
    expect(altName).toHaveTextContent("Schlechtwetterplan");
    expect(testName).toHaveTextContent("Schlechtwetterplan Test");
    expect(altName.className).not.toMatch(/\btruncate\b/);
    expect(testName.className).not.toMatch(/\btruncate\b/);
  });

  it("uses a wider popover workspace than the anchor for long plan names", () => {
    render(
      <WeekplannerPlanBar
        weekParam="2026-08-25"
        wochenplanPlans={[wochenplanPlan(), wochenplanPlan({ id: "wcp-alt", name: "Schlechtwetterplan Test", isDefault: false, isActive: false })]}
        weekplannerPlans={[]}
        selectedPlanParam={null}
        materializedWeekplannerPlanId={null}
        canManage
      />,
    );

    fireEvent.click(screen.getByTestId("weekplanner-plan-switcher"));
    const popover = document.querySelector("[data-floating-ui-portal]") ?? document.body;
    const widePanel = popover.querySelector(".max-w-\\[28rem\\]");
    expect(widePanel).toBeTruthy();
  });

  it("keeps draft overflow actions available", () => {
    render(
      <WeekplannerPlanBar
        weekParam="2026-08-25"
        wochenplanPlans={[wochenplanPlan(), wochenplanPlan({ id: "wcp-alt", name: "Schlechtwetterplan", isDefault: false, isActive: false })]}
        weekplannerPlans={[]}
        selectedPlanParam="wcp-alt"
        materializedWeekplannerPlanId={null}
        canManage
      />,
    );

    fireEvent.click(screen.getByTestId("weekplanner-plan-switcher"));
    expect(screen.getByTestId("weekplanner-plan-overflow-wcp-alt")).toBeInTheDocument();
  });
});

describe("WeekplannerPlanBar — read-only", () => {
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
    expect(screen.getByTestId("weekplanner-plan-switcher")).toBeInTheDocument();
  });
});
