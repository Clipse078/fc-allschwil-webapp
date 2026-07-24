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
      expect(
        screen.getByTestId("infoboard-readiness-not-relevant"),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        "Auswärtsspiele werden nicht auf dem FC-Allschwil-Infoboard angezeigt.",
      ),
    ).toBeInTheDocument();
  });

  it("shows Nicht relevant when homeAway is null", async () => {
    render(
      <MatchcenterDetailOperational
        {...createProps({ homeAway: null })}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByTestId("infoboard-readiness-not-relevant"),
      ).toBeInTheDocument();
    });
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
