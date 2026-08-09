/**
 * @vitest-environment jsdom
 *
 * components/admin/training/__tests__/TrainingSeriesCreateForm.test.tsx
 *
 * PLANNING-CREATION-UX-01B — focused tests for the guided TrainingCenter
 * creation form:
 *   - guided missing-state nudge reacts as fields are filled
 *   - live Spielfeld/Halle + Garderobe availability (Frei/Belegt) is shown
 *     once Tag + Start/Ende are known (reusing the EXISTING 01A endpoint)
 *   - recurrence Ja/Nein behavior (single occurrence vs. weekly-until-date)
 *   - submit-for-validation vs. direct-validation paths
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TrainingSeriesCreateForm, {
  type TeamSeasonOption,
} from "@/components/admin/training/TrainingSeriesCreateForm";
import type { FacilityGroup } from "@/components/admin/training/FacilityResourceSelector";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const TEAM_SEASONS: TeamSeasonOption[] = [
  { id: "ts-1", teamId: "team-1", teamName: "E1", seasonName: "Saison 2025/2026" },
];

const PITCH_HALL_GROUPS: FacilityGroup[] = [
  {
    facilityId: "facility-1",
    facilityName: "Sportanlage Brüel",
    resources: [
      { id: "res-pitch-a", name: "Kunstrasen 2", code: "KUNSTRASEN_2", type: "FULL_PITCH", facilityId: "facility-1", facilityName: "Sportanlage Brüel" },
      { id: "res-pitch-b", name: "Kunstrasen 3 A", code: "KUNSTRASEN_3_A", type: "HALF_PITCH", facilityId: "facility-1", facilityName: "Sportanlage Brüel" },
    ],
  },
];

const DRESSING_ROOM_GROUPS: FacilityGroup[] = [
  {
    facilityId: "facility-1",
    facilityName: "Sportanlage Brüel",
    resources: [
      { id: "res-dressing-1", name: "E1", code: "DR_1", type: "DRESSING_ROOM", facilityId: "facility-1", facilityName: "Sportanlage Brüel" },
    ],
  },
];

function jsonResponse(data: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => data } as Response;
}

function installFetchMock() {
  const availabilityCalls: string[] = [];

  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
    void _init;
    if (url.startsWith("/api/facilities/availability")) {
      availabilityCalls.push(url);
      if (url.includes("group=PITCH_HALL")) {
        return jsonResponse({
          availability: [
            { resourceId: "res-pitch-a", status: "FREE", conflictLabel: null, conflictStartAt: null, conflictEndAt: null },
            {
              resourceId: "res-pitch-b",
              status: "OCCUPIED",
              conflictLabel: "Match E1",
              conflictStartAt: "2026-09-22T17:30:00.000Z",
              conflictEndAt: "2026-09-22T19:00:00.000Z",
            },
          ],
        });
      }
      return jsonResponse({ availability: [] });
    }
    if (url === "/api/training-series") {
      return jsonResponse({
        series: { id: "series-1" },
        generation: { occurrencesInWindow: 1, created: 1, updated: 0, unchanged: 0 },
      });
    }
    throw new Error(`Unexpected fetch call: ${url}`);
  });

  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, availabilityCalls };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("TrainingSeriesCreateForm — guided-progress nudge summary", () => {
  it("lists missing items and shrinks the list as fields are filled", async () => {
    installFetchMock();
    render(
      <TrainingSeriesCreateForm
        teamSeasons={TEAM_SEASONS}
        pitchHallFacilityGroups={PITCH_HALL_GROUPS}
        dressingRoomFacilityGroups={DRESSING_ROOM_GROUPS}
        canValidateDirectly
      />,
    );

    const progress = screen.getByTestId("training-create-guided-progress");
    expect(progress).toHaveTextContent("Team auswählen");
    expect(progress).toHaveTextContent("Tag auswählen");

    fireEvent.change(screen.getByTestId("training-create-team-season-select"), { target: { value: "ts-1" } });
    await waitFor(() =>
      expect(screen.getByTestId("training-create-guided-progress")).not.toHaveTextContent("Team auswählen"),
    );

    fireEvent.change(screen.getByTestId("training-create-date"), { target: { value: "2026-09-22" } });
    await waitFor(() =>
      expect(screen.getByTestId("training-create-guided-progress")).not.toHaveTextContent("Tag auswählen"),
    );

    expect(screen.getByTestId("training-create-guided-progress")).toHaveTextContent("Spielfeld / Halle zuweisen");
    expect(screen.getByTestId("training-create-guided-progress")).toHaveTextContent("Garderobe zuweisen");
  });

  it("derives and displays the weekday from the chosen date", async () => {
    installFetchMock();
    render(
      <TrainingSeriesCreateForm
        teamSeasons={TEAM_SEASONS}
        pitchHallFacilityGroups={PITCH_HALL_GROUPS}
        dressingRoomFacilityGroups={DRESSING_ROOM_GROUPS}
        canValidateDirectly
      />,
    );

    // 2026-09-22 is a Tuesday.
    fireEvent.change(screen.getByTestId("training-create-date"), { target: { value: "2026-09-22" } });

    expect(screen.getByTestId("training-create-weekday-label")).toHaveTextContent("Dienstag");
  });
});

describe("TrainingSeriesCreateForm — live Spielfeld/Halle + Garderobe availability", () => {
  it("fetches and displays live Frei/Belegt availability once Tag + Start/Ende are known", async () => {
    installFetchMock();
    render(
      <TrainingSeriesCreateForm
        teamSeasons={TEAM_SEASONS}
        pitchHallFacilityGroups={PITCH_HALL_GROUPS}
        dressingRoomFacilityGroups={DRESSING_ROOM_GROUPS}
        canValidateDirectly
      />,
    );

    fireEvent.change(screen.getByTestId("training-create-date"), { target: { value: "2026-09-22" } });

    await waitFor(() => expect(screen.getByTestId("training-create-resource-add-select")).toBeInTheDocument());
    const select = screen.getByTestId("training-create-resource-add-select") as HTMLSelectElement;

    await waitFor(() => {
      const optionTexts = Array.from(select.options).map((o) => o.textContent);
      expect(optionTexts.some((t) => t?.includes("Kunstrasen 2") && t?.includes("Frei"))).toBe(true);
      expect(optionTexts.some((t) => t?.includes("Kunstrasen 3 A") && t?.includes("Belegt") && t?.includes("Match E1"))).toBe(
        true,
      );
    });
  });

  it("does not query availability before both a date and valid start/end times exist", async () => {
    const { availabilityCalls } = installFetchMock();
    render(
      <TrainingSeriesCreateForm
        teamSeasons={TEAM_SEASONS}
        pitchHallFacilityGroups={PITCH_HALL_GROUPS}
        dressingRoomFacilityGroups={DRESSING_ROOM_GROUPS}
        canValidateDirectly
      />,
    );

    // Only a date, no valid time range (defaults 17:00-18:00 are already
    // valid, so explicitly break it to prove the guard).
    fireEvent.change(screen.getByTestId("training-create-starts-at"), { target: { value: "18:00" } });
    fireEvent.change(screen.getByTestId("training-create-ends-at"), { target: { value: "17:00" } });
    fireEvent.change(screen.getByTestId("training-create-date"), { target: { value: "2026-09-22" } });

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(availabilityCalls).toHaveLength(0);
  });
});

describe("TrainingSeriesCreateForm — recurrence (Wiederholung Ja/Nein)", () => {
  it("defaults to 'Nein' (single occurrence) and hides the recurrence end date", () => {
    installFetchMock();
    render(
      <TrainingSeriesCreateForm
        teamSeasons={TEAM_SEASONS}
        pitchHallFacilityGroups={PITCH_HALL_GROUPS}
        dressingRoomFacilityGroups={DRESSING_ROOM_GROUPS}
        canValidateDirectly
      />,
    );

    expect(screen.getByTestId("training-create-recurrence-no")).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByTestId("training-create-valid-until")).not.toBeInTheDocument();
  });

  it("'Ja' reveals a required recurrence end date and adds it to the missing-state nudge until filled", async () => {
    installFetchMock();
    render(
      <TrainingSeriesCreateForm
        teamSeasons={TEAM_SEASONS}
        pitchHallFacilityGroups={PITCH_HALL_GROUPS}
        dressingRoomFacilityGroups={DRESSING_ROOM_GROUPS}
        canValidateDirectly
      />,
    );

    fireEvent.change(screen.getByTestId("training-create-date"), { target: { value: "2026-09-22" } });
    fireEvent.click(screen.getByTestId("training-create-recurrence-yes"));

    expect(screen.getByTestId("training-create-valid-until")).toBeInTheDocument();
    expect(screen.getByTestId("training-create-guided-progress")).toHaveTextContent(
      "Enddatum der Wiederholung angeben",
    );

    fireEvent.change(screen.getByTestId("training-create-valid-until"), { target: { value: "2026-12-15" } });
    await waitFor(() =>
      expect(screen.getByTestId("training-create-guided-progress")).not.toHaveTextContent(
        "Enddatum der Wiederholung angeben",
      ),
    );
  });

  it("submits a single-occurrence weekdaySchedule with validUntil = date + 1 day when not recurring", async () => {
    const { fetchMock } = installFetchMock();
    render(
      <TrainingSeriesCreateForm
        teamSeasons={TEAM_SEASONS}
        pitchHallFacilityGroups={PITCH_HALL_GROUPS}
        dressingRoomFacilityGroups={DRESSING_ROOM_GROUPS}
        canValidateDirectly
      />,
    );

    fireEvent.change(screen.getByTestId("training-create-team-season-select"), { target: { value: "ts-1" } });
    fireEvent.change(screen.getByTestId("training-create-title"), { target: { value: "E1 Training" } });
    fireEvent.change(screen.getByTestId("training-create-date"), { target: { value: "2026-09-22" } });

    await waitFor(() => expect(screen.getByTestId("training-create-submit")).not.toBeDisabled());
    fireEvent.click(screen.getByTestId("training-create-submit"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/training-series", expect.anything()));

    const call = fetchMock.mock.calls.find(([url]) => url === "/api/training-series");
    const body = JSON.parse((call?.[1] as RequestInit).body as string);
    expect(body.validFrom).toBe("2026-09-22");
    expect(body.validUntil).toBe("2026-09-23");
    expect(body.weekdaySchedules).toEqual([{ weekday: "TUESDAY", startsAt: "17:00", endsAt: "18:00" }]);
  });
});

describe("TrainingSeriesCreateForm — validation right wiring", () => {
  it("with validation right (trainings.manage): submit label reads 'Freigeben' and calls the create API", async () => {
    const { fetchMock } = installFetchMock();
    render(
      <TrainingSeriesCreateForm
        teamSeasons={TEAM_SEASONS}
        pitchHallFacilityGroups={PITCH_HALL_GROUPS}
        dressingRoomFacilityGroups={DRESSING_ROOM_GROUPS}
        canValidateDirectly
      />,
    );

    expect(screen.getByTestId("training-create-submit")).toHaveTextContent("Freigeben");

    fireEvent.change(screen.getByTestId("training-create-team-season-select"), { target: { value: "ts-1" } });
    fireEvent.change(screen.getByTestId("training-create-title"), { target: { value: "E1 Training" } });
    fireEvent.change(screen.getByTestId("training-create-date"), { target: { value: "2026-09-22" } });

    await waitFor(() => expect(screen.getByTestId("training-create-submit")).not.toBeDisabled());
    fireEvent.click(screen.getByTestId("training-create-submit"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/training-series", expect.anything()));
  });

  it("without validation right: submit label reads 'Zur Freigabe einreichen', stays disabled, and never calls the create API", async () => {
    const { fetchMock } = installFetchMock();
    render(
      <TrainingSeriesCreateForm
        teamSeasons={TEAM_SEASONS}
        pitchHallFacilityGroups={PITCH_HALL_GROUPS}
        dressingRoomFacilityGroups={DRESSING_ROOM_GROUPS}
        canValidateDirectly={false}
      />,
    );

    expect(screen.getByTestId("training-create-submit")).toHaveTextContent("Zur Freigabe einreichen");
    expect(screen.getByTestId("training-create-no-validation-right")).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("training-create-team-season-select"), { target: { value: "ts-1" } });
    fireEvent.change(screen.getByTestId("training-create-title"), { target: { value: "E1 Training" } });
    fireEvent.change(screen.getByTestId("training-create-date"), { target: { value: "2026-09-22" } });

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(screen.getByTestId("training-create-submit")).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalledWith("/api/training-series", expect.anything());
  });
});
