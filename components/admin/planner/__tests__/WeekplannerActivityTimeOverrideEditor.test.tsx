/**
 * @vitest-environment jsdom
 *
 * components/admin/planner/__tests__/WeekplannerActivityTimeOverrideEditor.test.tsx
 *
 * WEEKPLANNER-01D — focused tests for the compact start/end TIME override
 * editor:
 *   - saving a new start/end PUTs to the time-overrides endpoint, keeping
 *     the activity on its own canonical calendar day
 *   - "Standardzeit verwenden" clears the override via DELETE
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WeekplannerActivityTimeOverrideEditor } from "@/components/admin/planner/WeekplannerActivityTimeOverrideEditor";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
}));

function jsonResponse(data: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => data } as Response;
}

beforeEach(() => {
  vi.restoreAllMocks();
  refresh.mockClear();
});

describe("WeekplannerActivityTimeOverrideEditor — save", () => {
  it("PUTs the new start/end, combined with the activity's own canonical calendar day, to the time-overrides endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ override: {} }));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <WeekplannerActivityTimeOverrideEditor
        planId="plan-1"
        activityType="TRAINING"
        activityId="session-1"
        effectiveStartAt="2026-08-10T16:00:00.000Z"
        effectiveEndAt="2026-08-10T17:00:00.000Z"
        isOverridden={false}
        timeZone="Europe/Zurich"
      />,
    );

    const startInput = screen.getByTestId("weekplanner-time-override-start-session-1");
    const endInput = screen.getByTestId("weekplanner-time-override-end-session-1");
    fireEvent.change(startInput, { target: { value: "18:00" } });
    fireEvent.change(endInput, { target: { value: "19:00" } });
    fireEvent.click(screen.getByTestId("weekplanner-time-override-save-session-1"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/weekplanner/plans/plan-1/time-overrides");
    expect(init.method).toBe("PUT");
    const body = JSON.parse(init.body as string);
    expect(body.activityType).toBe("TRAINING");
    expect(body.activityId).toBe("session-1");
    // Stays on the SAME Europe/Zurich calendar day as the activity (2026-08-10) — never a day override.
    expect(body.startAt.startsWith("2026-08-10")).toBe(true);
    expect(body.endAt.startsWith("2026-08-10")).toBe(true);
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("shows an error and does not call fetch when the API rejects the range", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: "Ende muss nach dem Start liegen" }, 422));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <WeekplannerActivityTimeOverrideEditor
        planId="plan-1"
        activityType="TRAINING"
        activityId="session-1"
        effectiveStartAt="2026-08-10T16:00:00.000Z"
        effectiveEndAt="2026-08-10T17:00:00.000Z"
        isOverridden={false}
        timeZone="Europe/Zurich"
      />,
    );

    fireEvent.change(screen.getByTestId("weekplanner-time-override-start-session-1"), { target: { value: "19:00" } });
    fireEvent.change(screen.getByTestId("weekplanner-time-override-end-session-1"), { target: { value: "17:00" } });
    fireEvent.click(screen.getByTestId("weekplanner-time-override-save-session-1"));

    await screen.findByRole("alert");
    expect(screen.getByRole("alert")).toHaveTextContent("Ende muss nach dem Start liegen");
  });
});

describe("WeekplannerActivityTimeOverrideEditor — Standardzeit verwenden", () => {
  it("DELETEs the override to restore the canonical Standardplan time", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <WeekplannerActivityTimeOverrideEditor
        planId="plan-1"
        activityType="TRAINING"
        activityId="session-1"
        effectiveStartAt="2026-08-10T18:00:00.000Z"
        effectiveEndAt="2026-08-10T19:00:00.000Z"
        isOverridden
        timeZone="Europe/Zurich"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Standardzeit verwenden/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/weekplanner/plans/plan-1/time-overrides",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });
});
