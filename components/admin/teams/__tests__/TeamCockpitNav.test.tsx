/**
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import TeamCockpitNav, {
  buildTeamBasePath,
  isTabActive,
} from "@/components/admin/teams/TeamCockpitNav";

const TEAM_ID = "team-1";
const BASE_PATH = buildTeamBasePath(TEAM_ID);

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

import { usePathname } from "next/navigation";

const mockedUsePathname = vi.mocked(usePathname);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TEAM-COCKPIT-PREMIUM-01D — TeamCockpitNav active state", () => {
  it("marks Übersicht active only on the exact team root path", () => {
    mockedUsePathname.mockReturnValue(BASE_PATH);
    render(<TeamCockpitNav teamId={TEAM_ID} canManage canDelete />);

    const uebersicht = screen.getByTestId("team-cockpit-nav-uebersicht");
    expect(uebersicht).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("team-cockpit-nav-spiele")).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("does not mark Übersicht active on nested routes", () => {
    mockedUsePathname.mockReturnValue(`${BASE_PATH}/kader`);
    render(<TeamCockpitNav teamId={TEAM_ID} canManage canDelete />);

    expect(screen.getByTestId("team-cockpit-nav-uebersicht")).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(screen.getByTestId("team-cockpit-nav-kader")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("marks each primary route active on its own path", () => {
    const routes = [
      { key: "spiele", path: "/spiele", label: "Nächste Spiele" },
      { key: "resultate", path: "/resultate", label: "Resultate" },
      { key: "rangliste", path: "/rangliste", label: "Rangliste" },
      { key: "trainerteam", path: "/trainerteam", label: "Trainerteam" },
      { key: "dokumente", path: "/dokumente", label: "Dokumente" },
      { key: "administration", path: "/administration", label: "Administration" },
    ];

    for (const route of routes) {
      mockedUsePathname.mockReturnValue(`${BASE_PATH}${route.path}`);
      const { unmount } = render(
        <TeamCockpitNav teamId={TEAM_ID} canManage canDelete />,
      );

      expect(screen.getByTestId(`team-cockpit-nav-${route.key}`)).toHaveAttribute(
        "aria-selected",
        "true",
      );
      expect(screen.getByTestId("team-cockpit-nav-uebersicht")).toHaveAttribute(
        "aria-selected",
        "false",
      );
      unmount();
    }
  });

  it("hides Administration when user lacks manage/delete permissions", () => {
    mockedUsePathname.mockReturnValue(BASE_PATH);
    render(<TeamCockpitNav teamId={TEAM_ID} canManage={false} canDelete={false} />);

    expect(
      screen.queryByTestId("team-cockpit-nav-administration"),
    ).not.toBeInTheDocument();
  });

  it("exposes operational routes under Mehr", () => {
    mockedUsePathname.mockReturnValue(`${BASE_PATH}/anwesenheit`);
    render(<TeamCockpitNav teamId={TEAM_ID} canManage canDelete />);

    expect(screen.getByTestId("team-cockpit-nav-mehr")).toBeInTheDocument();
    expect(screen.getByTestId("team-cockpit-nav-anwesenheit")).toHaveTextContent(
      "Anwesenheit",
    );
    expect(screen.getByTestId("team-cockpit-nav-teilnahmen")).toHaveTextContent(
      "Teilnahmen",
    );
  });

  it("V. exposes Dokumente in primary navigation", () => {
    mockedUsePathname.mockReturnValue(BASE_PATH);
    render(<TeamCockpitNav teamId={TEAM_ID} canManage canDelete />);

    expect(screen.getByTestId("team-cockpit-nav-dokumente")).toHaveTextContent(
      "Dokumente",
    );
  });

  it("W. marks Dokumente active on its own path", () => {
    mockedUsePathname.mockReturnValue(`${BASE_PATH}/dokumente`);
    render(<TeamCockpitNav teamId={TEAM_ID} canManage canDelete />);

    expect(screen.getByTestId("team-cockpit-nav-dokumente")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByTestId("team-cockpit-nav-uebersicht")).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });
});

describe("isTabActive helper", () => {
  it("treats trailing slash on overview as active", () => {
    expect(
      isTabActive(`${BASE_PATH}/`, BASE_PATH, {
        key: "uebersicht",
        label: "Übersicht",
        href: "",
        exact: true,
      }),
    ).toBe(true);
  });

  it("does not treat nested paths as overview", () => {
    expect(
      isTabActive(`${BASE_PATH}/spiele`, BASE_PATH, {
        key: "uebersicht",
        label: "Übersicht",
        href: "",
        exact: true,
      }),
    ).toBe(false);
  });
});
