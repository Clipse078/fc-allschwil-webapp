/**
 * @vitest-environment jsdom
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

import MatchTeamMappingDialog from "@/components/admin/matchcenter/MatchTeamMappingDialog";
import type { MatchcenterSide } from "@/lib/matchcenter/types";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  success: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mocks.refresh,
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: {
      success: mocks.success,
      warning: vi.fn(),
      danger: vi.fn(),
      info: vi.fn(),
      neutral: vi.fn(),
    },
  }),
}));

const unresolvedSide: MatchcenterSide = {
  providerTeamId: 31927,
  providerTeamName: "FC Allschwil E1",
  canonicalTeamId: null,
  canonicalTeamName: null,
  displayName: "FC Allschwil E1",
  resolution: "UNRESOLVED",
  isOwnTeam: false,
};

const resolvedSide: MatchcenterSide = {
  providerTeamId: 44001,
  providerTeamName: "FC Basel E1",
  canonicalTeamId: "team-opponent",
  canonicalTeamName: "FC Basel E1",
  displayName: "FC Basel E1",
  resolution: "RESOLVED",
  isOwnTeam: false,
};

function jsonResponse(
  data: unknown,
  status = 200,
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  } as Response;
}

describe("MatchTeamMappingDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when all sides are resolved", () => {
    const { container } = render(
      <MatchTeamMappingDialog
        provider="SFV"
        externalSeasonId={2027}
        sides={[resolvedSide]}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("loads active teams when opened", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse([
          {
            id: "team-1",
            name: "E1",
            category: "JUNIOREN",
            genderGroup: "Mixed",
            ageGroup: "E",
            isActive: true,
          },
          {
            id: "team-inactive",
            name: "Archiv",
            category: "JUNIOREN",
            genderGroup: null,
            ageGroup: null,
            isActive: false,
          },
        ]),
      );

    vi.stubGlobal("fetch", fetchMock);

    render(
      <MatchTeamMappingDialog
        provider="SFV"
        externalSeasonId={2027}
        sides={[
          unresolvedSide,
          resolvedSide,
        ]}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Team zuordnen",
      }),
    );

    expect(
      await screen.findByRole("option", {
        name: "E1 · E / Mixed",
      }),
    ).toBeTruthy();

    expect(
      screen.queryByRole("option", {
        name: "Archiv",
      }),
    ).toBeNull();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/teams",
      {
        method: "GET",
        cache: "no-store",
      },
    );
  });

  it("submits the provider mapping and refreshes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse([
          {
            id: "team-1",
            name: "E1",
            category: "JUNIOREN",
            genderGroup: "Mixed",
            ageGroup: "E",
            isActive: true,
          },
        ]),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          mapping: {
            id: "mapping-1",
          },
          requiresScheduleSync: true,
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    render(
      <MatchTeamMappingDialog
        provider="SFV"
        externalSeasonId={2027}
        sides={[
          unresolvedSide,
          resolvedSide,
        ]}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Team zuordnen",
      }),
    );

    await screen.findByRole("option", {
      name: "E1 · E / Mixed",
    });

    fireEvent.change(
      screen.getByLabelText("Internes Team"),
      {
        target: {
          value: "team-1",
        },
      },
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Zuordnung speichern",
      }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/matchcenter/team-mappings",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: "SFV",
          externalTeamId: 31927,
          externalSeasonId: 2027,
          teamId: "team-1",
          providerTeamName:
            "FC Allschwil E1",
        }),
      }),
    );

    expect(mocks.success).toHaveBeenCalledWith(
      expect.stringContaining(
        "Spielplan synchronisieren",
      ),
      {
        duration: 7000,
      },
    );

    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("shows an API error and keeps the dialog open", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse([
          {
            id: "team-1",
            name: "E1",
            category: "JUNIOREN",
            genderGroup: null,
            ageGroup: null,
            isActive: true,
          },
        ]),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: "Active tenant team not found.",
          },
          404,
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    render(
      <MatchTeamMappingDialog
        provider="SFV"
        externalSeasonId={2027}
        sides={[unresolvedSide]}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Team zuordnen",
      }),
    );

    await screen.findByRole("option", {
      name: "E1",
    });

    fireEvent.change(
      screen.getByLabelText("Internes Team"),
      {
        target: {
          value: "team-1",
        },
      },
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Zuordnung speichern",
      }),
    );

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent(
      "Active tenant team not found.",
    );

    expect(
      screen.getByRole("dialog"),
    ).toBeTruthy();

    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});