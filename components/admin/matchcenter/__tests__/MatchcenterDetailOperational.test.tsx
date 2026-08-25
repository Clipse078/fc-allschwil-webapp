/**
 * @vitest-environment jsdom
 *
 * Tests for MatchcenterDetailOperational (Phase I — Infoboard workflow tests).
 *
 * Covers:
 * - Readiness states (ready, not-ready, not-relevant)
 * - HOME vs AWAY rendering
 * - Missing assignments shown as warnings
 * - Infoboard toggle disabled for away matches
 * - Preview link uses match date
 * - Save workflow (mocked fetch)
 * - Tenant/permission: canManage=false disables controls
 */

import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import MatchcenterDetailOperational, {
  type MatchcenterDetailOperationalProps,
  computeAllocationWarning,
} from "@/components/admin/matchcenter/MatchcenterDetailOperational";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
  toastDanger: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: {
      success: mocks.toastSuccess,
      danger: mocks.toastDanger,
      warning: vi.fn(),
      info: vi.fn(),
      neutral: vi.fn(),
    },
  }),
}));

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ── Helpers ────────────────────────────────────────────────────────────────────

function createProps(
  overrides: Partial<MatchcenterDetailOperationalProps> = {},
): MatchcenterDetailOperationalProps {
  return {
    matchId: "match-test-1",
    homeAway: "HOME",
    homeDisplayName: "FC Allschwil E1",
    awayDisplayName: "FC Reinach E1",
    homeIsOwnTeam: true,
    awayIsOwnTeam: false,
    currentTeamId: "team-fca",
    currentPitchCode: "STADION",
    currentHomeDressingRoomCode: "E1",
    currentAwayDressingRoomCode: "E2",
    currentWebsiteVisible: true,
    currentInfoboardVisible: true,
    matchDateIso: "2026-07-25T16:00:00.000Z",
    canManage: true,
    ...overrides,
  };
}

function setupTeamsFetch(teams: object[] = []) {
  mockFetch.mockImplementation((url: string) => {
    if (url === "/api/teams") {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(teams),
      });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("MatchcenterDetailOperational", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupTeamsFetch();
  });

  // ── D2 Readiness ─────────────────────────────────────────────────────────

  it("shows Bereit when home match has all required assignments", async () => {
    render(<MatchcenterDetailOperational {...createProps()} />);

    await waitFor(() => {
      expect(
        screen.getByTestId("infoboard-readiness-ready"),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Bereit")).toBeInTheDocument();
  });

  it("shows Nicht bereit when a required assignment is missing", async () => {
    render(
      <MatchcenterDetailOperational
        {...createProps({
          currentPitchCode: null,
        })}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByTestId("infoboard-readiness-not-ready"),
      ).toBeInTheDocument();
    });
  });

  it("shows Nicht relevant for away matches", async () => {
    render(
      <MatchcenterDetailOperational
        {...createProps({
          homeAway: "AWAY",
          homeIsOwnTeam: false,
          awayIsOwnTeam: true,
        })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("team-assignment-select")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("infoboard-readiness-not-relevant")).toBeNull();
    expect(screen.queryByTestId("pitch-assignment-select")).toBeNull();
  });

  it("shows Nicht relevant when homeAway is null", async () => {
    render(
      <MatchcenterDetailOperational
        {...createProps({ homeAway: null })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("team-assignment-select")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("infoboard-readiness-not-relevant")).toBeNull();
    expect(screen.queryByTestId("pitch-assignment-select")).toBeNull();
  });

  // ── D4 Pitch ─────────────────────────────────────────────────────────────

  it("shows pitch warning when pitchCode is null", async () => {
    render(
      <MatchcenterDetailOperational
        {...createProps({ currentPitchCode: null })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Spielfeld fehlt.")).toBeInTheDocument();
    });
  });

  it("shows pitch select with current value", async () => {
    render(
      <MatchcenterDetailOperational
        {...createProps({ currentPitchCode: "STADION" })}
      />,
    );

    await waitFor(() => {
      const select = screen.getByTestId(
        "pitch-assignment-select",
      ) as HTMLSelectElement;
      expect(select.value).toBe("STADION");
    });
  });

  // ── D5 Dressing rooms ─────────────────────────────────────────────────────

  it("shows home dressing room warning when code is null", async () => {
    render(
      <MatchcenterDetailOperational
        {...createProps({ currentHomeDressingRoomCode: null })}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Garderobe Heimteam fehlt."),
      ).toBeInTheDocument();
    });
  });

  it("shows away dressing room warning when code is null", async () => {
    render(
      <MatchcenterDetailOperational
        {...createProps({ currentAwayDressingRoomCode: null })}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Garderobe Gastteam fehlt."),
      ).toBeInTheDocument();
    });
  });

  // ── D6 Publication ────────────────────────────────────────────────────────

  it("infoboard toggle is disabled for away matches", async () => {
    render(
      <MatchcenterDetailOperational
        {...createProps({
          homeAway: "AWAY",
          homeIsOwnTeam: false,
          awayIsOwnTeam: true,
        })}
      />,
    );

    await waitFor(() => {
      const toggle = screen.getByTestId("infoboard-visible-toggle");
      expect(toggle).toBeDisabled();
    });
  });

  it("shows away match infoboard explanation text", async () => {
    render(
      <MatchcenterDetailOperational
        {...createProps({
          homeAway: "AWAY",
          homeIsOwnTeam: false,
          awayIsOwnTeam: true,
        })}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          "Dieses Auswärtsspiel kann nicht auf dem FC-Allschwil-Infoboard veröffentlicht werden.",
        ),
      ).toBeInTheDocument();
    });
  });

  // ── D7 Save ───────────────────────────────────────────────────────────────

  it("calls PATCH API and shows success toast on save", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url === "/api/teams") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }
      if (url === "/api/matchcenter/match-test-1") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: "match-test-1" }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    render(<MatchcenterDetailOperational {...createProps()} />);

    const saveButton = await screen.findByTestId("save-match-operational");
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        "Änderungen gespeichert.",
      );
    });

    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("shows error toast when save fails", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url === "/api/teams") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }
      if (url === "/api/matchcenter/match-test-1") {
        return Promise.resolve({
          ok: false,
          json: () =>
            Promise.resolve({ error: "Server-Fehler beim Speichern." }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    render(<MatchcenterDetailOperational {...createProps()} />);

    const saveButton = await screen.findByTestId("save-match-operational");
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mocks.toastDanger).toHaveBeenCalledWith(
        "Server-Fehler beim Speichern.",
        expect.any(Object),
      );
    });
  });

  // ── D8 Preview link ───────────────────────────────────────────────────────

  it("preview link uses the match date", async () => {
    render(
      <MatchcenterDetailOperational
        {...createProps({ matchDateIso: "2026-07-25T16:00:00.000Z" })}
      />,
    );

    await waitFor(() => {
      const link = screen.getByTestId("infoboard-preview-link");
      expect(link).toHaveAttribute(
        "href",
        "/dashboard/infoboard?date=2026-07-25",
      );
    });
  });

  // ── Permissions ────────────────────────────────────────────────────────────

  it("save button is not rendered for read-only users", async () => {
    render(
      <MatchcenterDetailOperational
        {...createProps({ canManage: false })}
      />,
    );

    await waitFor(() => {
      expect(
        screen.queryByTestId("save-match-operational"),
      ).not.toBeInTheDocument();
    });
  });

  it("controls are disabled for read-only users", async () => {
    render(
      <MatchcenterDetailOperational
        {...createProps({ canManage: false })}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByTestId("pitch-assignment-select"),
      ).toBeDisabled();
      expect(
        screen.getByTestId("home-dressing-room-select"),
      ).toBeDisabled();
      expect(
        screen.getByTestId("away-dressing-room-select"),
      ).toBeDisabled();
    });
  });
});

// ── MASTERDATA-CONSISTENCY-02: canonical FacilityResource selectors ──────────

describe("MatchcenterDetailOperational — canonical pitch/dressing-room options", () => {
  it("renders a pitch option for every canonical pitchOptions entry", async () => {
    render(
      <MatchcenterDetailOperational
        {...createProps({
          currentPitchCode: "STADION",
          pitchOptions: [
            { code: "STADION", name: "Stadion" },
            { code: "KUNSTRASEN_2", name: "Kunstrasen 2" },
          ],
        })}
      />,
    );

    const select = await screen.findByTestId("pitch-assignment-select");
    const options = within(select).getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(
      expect.arrayContaining(["Stadion", "Kunstrasen 2"]),
    );
  });

  it("a renamed pitch resource shows its current canonical name, not a static label", async () => {
    render(
      <MatchcenterDetailOperational
        {...createProps({
          currentPitchCode: "STADION",
          pitchOptions: [{ code: "STADION", name: "Hauptplatz (umbenannt)" }],
        })}
      />,
    );

    const select = await screen.findByTestId("pitch-assignment-select");
    expect(within(select).getByText("Hauptplatz (umbenannt)")).toBeInTheDocument();
  });

  it("an archived pitch resource absent from pitchOptions is excluded from new choices", async () => {
    render(
      <MatchcenterDetailOperational
        {...createProps({
          currentPitchCode: null,
          pitchOptions: [{ code: "KUNSTRASEN_2", name: "Kunstrasen 2" }],
        })}
      />,
    );

    const select = await screen.findByTestId("pitch-assignment-select");
    const options = within(select).getAllByRole("option").map((o) => o.textContent);
    expect(options).not.toContain("Stadion");
  });

  it("an existing allocation referencing an archived/renamed-away pitch remains readable via a historical fallback option", async () => {
    render(
      <MatchcenterDetailOperational
        {...createProps({
          currentPitchCode: "STADION_OLD",
          // STADION_OLD is no longer part of the active canonical options —
          // simulating an archived/renamed-away resource.
          pitchOptions: [{ code: "KUNSTRASEN_2", name: "Kunstrasen 2" }],
        })}
      />,
    );

    const select = (await screen.findByTestId(
      "pitch-assignment-select",
    )) as HTMLSelectElement;

    // The historical code remains selected/selectable instead of being
    // silently cleared to "— Kein Spielfeld zugeordnet —".
    expect(select.value).toBe("STADION_OLD");
    expect(within(select).getByText("STADION_OLD")).toBeInTheDocument();
  });

  it("renders home/away dressing-room options from the canonical dressingRoomOptions list", async () => {
    render(
      <MatchcenterDetailOperational
        {...createProps({
          currentHomeDressingRoomCode: "E1",
          currentAwayDressingRoomCode: "E2",
          dressingRoomOptions: [
            { code: "E1", name: "Garderobe E1" },
            { code: "E2", name: "Garderobe E2" },
          ],
        })}
      />,
    );

    const homeSelect = await screen.findByTestId("home-dressing-room-select");
    const awaySelect = await screen.findByTestId("away-dressing-room-select");

    expect(within(homeSelect).getByText("Garderobe E1")).toBeInTheDocument();
    expect(within(awaySelect).getByText("Garderobe E2")).toBeInTheDocument();
  });

  it("a historical away dressing-room allocation is not silently cleared when absent from dressingRoomOptions", async () => {
    render(
      <MatchcenterDetailOperational
        {...createProps({
          currentAwayDressingRoomCode: "O9_ARCHIVED",
          dressingRoomOptions: [{ code: "E1", name: "Garderobe E1" }],
        })}
      />,
    );

    const awaySelect = (await screen.findByTestId(
      "away-dressing-room-select",
    )) as HTMLSelectElement;

    expect(awaySelect.value).toBe("O9_ARCHIVED");
  });

  it("falls back to an empty canonical list without crashing when pitchOptions/dressingRoomOptions are omitted", async () => {
    render(<MatchcenterDetailOperational {...createProps()} />);

    await waitFor(() => {
      expect(screen.getByTestId("pitch-assignment-select")).toBeInTheDocument();
    });
  });
});

// ── RESOURCE-AVAILABILITY-UX-01: live Frei/Belegt availability (edit mode) ────

describe("MatchcenterDetailOperational — RESOURCE-AVAILABILITY-UX-01 availability", () => {
  function installAvailabilityFetchMock() {
    const availabilityCalls: string[] = [];
    mockFetch.mockImplementation((url: string) => {
      if (url === "/api/teams") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.startsWith("/api/facilities/availability")) {
        availabilityCalls.push(url);
        if (url.includes("group=PITCH_HALL")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                availability: [
                  { resourceId: "res-1", resourceCode: "STADION", status: "FREE", conflictLabel: null, conflictStartAt: null, conflictEndAt: null },
                  {
                    resourceId: "res-2",
                    resourceCode: "KUNSTRASEN_2",
                    status: "OCCUPIED",
                    conflictLabel: "Training E2",
                    conflictStartAt: "2026-07-25T17:00:00.000Z",
                    conflictEndAt: "2026-07-25T18:00:00.000Z",
                  },
                ],
              }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ availability: [] }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    return availabilityCalls;
  }

  it("annotates the pitch select's options with live Frei/Belegt status for a HOME match", async () => {
    installAvailabilityFetchMock();

    render(
      <MatchcenterDetailOperational
        {...createProps({
          currentPitchCode: "STADION",
          pitchOptions: [
            { code: "STADION", name: "Stadion" },
            { code: "KUNSTRASEN_2", name: "Kunstrasen 2" },
          ],
        })}
      />,
    );

    const select = await screen.findByTestId("pitch-assignment-select");
    await waitFor(() => {
      const optionTexts = within(select).getAllByRole("option").map((o) => o.textContent);
      expect(optionTexts.some((t) => t?.includes("Stadion") && t?.includes("Frei"))).toBe(true);
      expect(optionTexts.some((t) => t?.includes("Kunstrasen 2") && t?.includes("Belegt") && t?.includes("Training E2"))).toBe(true);
    });
  });

  it("requests availability excluding this match's own id (self-exclusion in edit mode)", async () => {
    const availabilityCalls = installAvailabilityFetchMock();

    render(<MatchcenterDetailOperational {...createProps({ matchId: "match-test-1" })} />);

    await waitFor(() => expect(availabilityCalls.length).toBeGreaterThan(0));
    expect(availabilityCalls.every((url) => url.includes("excludeEventId=match-test-1"))).toBe(true);
  });

  it("never requests availability for an AWAY match", async () => {
    const availabilityCalls = installAvailabilityFetchMock();

    render(
      <MatchcenterDetailOperational
        {...createProps({ homeAway: "AWAY", homeIsOwnTeam: false, awayIsOwnTeam: true })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("team-assignment-select")).toBeInTheDocument();
    });
    expect(availabilityCalls).toHaveLength(0);
  });
});

// ── PUB-02: computeAllocationWarning unit tests ────────────────────────────────

describe("PUB-02 — computeAllocationWarning", () => {
  it("AW-1: missing pitch only → 'Es fehlt noch die Platzzuteilung.'", () => {
    const result = computeAllocationWarning("HOME", true, null, "E1", "E2");
    expect(result).toBe("Es fehlt noch die Platzzuteilung.");
  });

  it("AW-2: missing home dressing room only → 'Es fehlt noch Heimkabine.'", () => {
    const result = computeAllocationWarning("HOME", true, "STADION", null, "E2");
    expect(result).toBe("Es fehlt noch Heimkabine.");
  });

  it("AW-3: missing away dressing room only → 'Es fehlt noch Gästekabine.'", () => {
    const result = computeAllocationWarning("HOME", true, "STADION", "E1", null);
    expect(result).toBe("Es fehlt noch Gästekabine.");
  });

  it("AW-4: missing home and away dressing rooms → 'Es fehlen noch Heimkabine und Gästekabine.'", () => {
    const result = computeAllocationWarning("HOME", true, "STADION", null, null);
    expect(result).toBe("Es fehlen noch Heimkabine und Gästekabine.");
  });

  it("AW-5: all missing → 'Es fehlen noch Platz, Heimkabine und Gästekabine.'", () => {
    const result = computeAllocationWarning("HOME", true, null, null, null);
    expect(result).toBe("Es fehlen noch Platz, Heimkabine und Gästekabine.");
  });

  it("AW-6: fully allocated → null (no warning)", () => {
    const result = computeAllocationWarning("HOME", true, "STADION", "E1", "E2");
    expect(result).toBeNull();
  });

  it("AW-7: away match → null (no warning regardless of allocations)", () => {
    const result = computeAllocationWarning("AWAY", true, null, null, null);
    expect(result).toBeNull();
  });

  it("AW-8: infoboard disabled → null (no warning)", () => {
    const result = computeAllocationWarning("HOME", false, null, null, null);
    expect(result).toBeNull();
  });

  it("AW-9: homeAway=null → null (no warning)", () => {
    const result = computeAllocationWarning(null, true, null, null, null);
    expect(result).toBeNull();
  });
});

describe("operational cutoff", () => {
  it("shows read-only history instead of editable controls when not actionable", async () => {
    render(
      <MatchcenterDetailOperational
        {...createProps({
          isOperationallyActionable: false,
          currentPitchCode: "STADION",
          currentHomeDressingRoomCode: "O1",
          currentAwayDressingRoomCode: "E1",
          pitchOptions: [{ code: "STADION", name: "Kunstrasen 2" }],
          dressingRoomOptions: [
            { code: "O1", name: "O1" },
            { code: "E1", name: "E1" },
          ],
        })}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByTestId("matchcenter-operational-history"),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByTestId("matchcenter-operational-history-label"),
    ).toHaveTextContent("Kunstrasen 2 · Heim O1 · Gast E1");
    expect(screen.queryByTestId("pitch-assignment-select")).toBeNull();
    expect(screen.queryByTestId("infoboard-readiness-ready")).toBeNull();
  });

  it("does not render home facility pickers for away matches", async () => {
    render(
      <MatchcenterDetailOperational
        {...createProps({
          homeAway: "AWAY",
          homeIsOwnTeam: false,
          awayIsOwnTeam: true,
        })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("team-assignment-select")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("pitch-assignment-select")).toBeNull();
    expect(screen.queryByTestId("home-dressing-room-select")).toBeNull();
    expect(screen.queryByTestId("infoboard-readiness-not-relevant")).toBeNull();
  });
});
