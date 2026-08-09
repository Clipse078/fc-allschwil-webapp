/**
 * @vitest-environment jsdom
 *
 * components/admin/tournamentcenter/__tests__/TournamentCreateForm.test.tsx
 *
 * TOURNAMENTCENTER-01D-V — regression test for the creation-form retry
 * guard: once Event creation has partially failed (Event + some
 * participants/resources already persisted, at least one step errored),
 * the primary "Turnier erstellen" action must be disabled so a retry
 * cannot call POST /api/events a second time and create a duplicate
 * tournament with duplicated participants — see
 * lib/tournaments/create-tournament-orchestration.ts and the task notes on
 * TournamentCreateForm.tsx.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TournamentCreateForm from "@/components/admin/tournamentcenter/TournamentCreateForm";
import type { FacilityGroup } from "@/components/admin/training/FacilityResourceSelector";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

const PITCH_HALL_GROUPS: FacilityGroup[] = [
  {
    facilityId: "facility-1",
    facilityName: "Sportanlage Brüel",
    resources: [
      { id: "res-pitch-a", name: "Hauptplatz", code: "PITCH_A", type: "FULL_PITCH", facilityId: "facility-1", facilityName: "Sportanlage Brüel" },
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

/**
 * Routes fetch() calls made by TournamentCreateForm by URL/method, so each
 * test only needs to override the handlers it actually cares about.
 */
function installFetchMock(overrides: {
  createEventResponse?: () => Response;
  addParticipantResponse?: (callIndex: number) => Response;
  addResourceAllocationResponse?: () => Response;
}) {
  let participantCallIndex = 0;

  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";

    if (url === "/api/seasons") {
      return jsonResponse({ seasons: [{ id: "season-1", key: "2025-2026", name: "Saison 2025/2026", isActive: true }] });
    }
    if (url === "/api/teams") {
      return jsonResponse([
        { id: "team-1", name: "1. Mannschaft", ageGroup: null, genderGroup: null, isActive: true },
        { id: "team-2", name: "2. Mannschaft", ageGroup: null, genderGroup: null, isActive: true },
      ]);
    }
    if (url === "/api/club-directory/teams") {
      return jsonResponse({ teams: [] });
    }
    if (url === "/api/events" && method === "POST") {
      return overrides.createEventResponse
        ? overrides.createEventResponse()
        : jsonResponse({ eventIds: ["event-1"] }, 201);
    }
    if (url.match(/^\/api\/tournaments\/.+\/participants$/) && method === "POST") {
      const response = overrides.addParticipantResponse
        ? overrides.addParticipantResponse(participantCallIndex)
        : jsonResponse({ participant: { id: `participant-${participantCallIndex}` } }, 201);
      participantCallIndex += 1;
      return response;
    }
    if (url.match(/^\/api\/tournaments\/.+\/resource-allocations$/) && method === "POST") {
      return overrides.addResourceAllocationResponse
        ? overrides.addResourceAllocationResponse()
        : jsonResponse({ allocation: {} }, 201);
    }

    throw new Error(`Unexpected fetch call: ${method} ${url}`);
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function fillMinimalRequiredFields() {
  fireEvent.change(screen.getByTestId("tournament-create-title"), { target: { value: "Testturnier" } });
  await waitFor(() => expect(screen.getByTestId("tournament-create-season-select")).not.toBeDisabled());
  fireEvent.change(screen.getByTestId("tournament-create-start-at"), { target: { value: "2026-09-20T10:00" } });

  await waitFor(() => expect(screen.getByTestId("tournament-create-add-team-select")).not.toBeDisabled());
  fireEvent.change(screen.getByTestId("tournament-create-add-team-select"), { target: { value: "team-1" } });
  fireEvent.click(screen.getByTestId("tournament-create-add-team-button"));
}

describe("TournamentCreateForm — retry guard after partial failure", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.push.mockReset();
    mocks.refresh.mockReset();
  });

  it("redirects to the TournamentCenter overview on a fully successful creation", async () => {
    installFetchMock({});

    render(
      <TournamentCreateForm pitchHallFacilityGroups={PITCH_HALL_GROUPS} dressingRoomFacilityGroups={DRESSING_ROOM_GROUPS} />,
    );
    await fillMinimalRequiredFields();

    fireEvent.click(screen.getByTestId("tournament-create-submit"));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/dashboard/tournamentcenter?submitted=1"));
    expect(screen.queryByTestId("tournament-create-partial-warning")).not.toBeInTheDocument();
  });

  it("disables the submit button after a partial failure instead of allowing a duplicate-creating retry", async () => {
    const fetchMock = installFetchMock({
      addResourceAllocationResponse: () =>
        jsonResponse({ error: 'FacilityResource "res-pitch-a" is archived and cannot receive new allocations' }, 422),
    });

    render(
      <TournamentCreateForm pitchHallFacilityGroups={PITCH_HALL_GROUPS} dressingRoomFacilityGroups={DRESSING_ROOM_GROUPS} />,
    );
    await fillMinimalRequiredFields();

    fireEvent.change(screen.getByTestId("tournament-create-resource-add-select"), { target: { value: "res-pitch-a" } });
    fireEvent.click(screen.getByTestId("tournament-create-resource-add-add-button"));
    await screen.findByText("Hauptplatz");

    fireEvent.click(screen.getByTestId("tournament-create-submit"));

    const warning = await screen.findByTestId("tournament-create-partial-warning");
    expect(warning).toHaveTextContent("Turnier wurde erstellt");
    expect(mocks.push).not.toHaveBeenCalledWith("/dashboard/tournamentcenter?submitted=1");

    // The one and only Event-creation call so far — this is what we must
    // NOT see a second one of.
    const eventCallsBeforeRetry = fetchMock.mock.calls.filter(([url, init]) => url === "/api/events" && init?.method === "POST");
    expect(eventCallsBeforeRetry).toHaveLength(1);

    const submitButton = screen.getByTestId("tournament-create-submit");
    expect(submitButton).toBeDisabled();

    // Defense in depth: even a native form submit (e.g. Enter key) must not
    // re-run the orchestration while a partial failure is unresolved.
    fireEvent.submit(screen.getByTestId("tournament-create-form"));

    await waitFor(() => {
      const eventCallsAfterRetry = fetchMock.mock.calls.filter(([url, init]) => url === "/api/events" && init?.method === "POST");
      expect(eventCallsAfterRetry).toHaveLength(1);
    });

    // The safe path out of a partial failure remains available.
    expect(screen.getByTestId("tournament-create-goto-edit")).toBeEnabled();
  });
});
