/**
 * @vitest-environment jsdom
 *
 * SCE-DESIGN-04 — Motion foundation tests
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LayoutDashboard, Settings2 } from "lucide-react";
import { MotionIcon } from "@/components/ui/MotionIcon";
import { SyncFlowIndicator } from "@/components/ui/SyncFlowIndicator";
import { getNavMotionIntent } from "@/lib/motion/nav-intents";

describe("getNavMotionIntent", () => {
  it("maps known nav labels to motion intents", () => {
    expect(getNavMotionIntent("Dashboard")).toBe("hover");
    expect(getNavMotionIntent("Website")).toBe("globe");
    expect(getNavMotionIntent("Teams")).toBe("group");
    expect(getNavMotionIntent("TrainingCenter")).toBe("schedule");
    expect(getNavMotionIntent("MatchCenter")).toBe("direction");
    expect(getNavMotionIntent("TournamentCenter")).toBe("lift");
    expect(getNavMotionIntent("Dokumente")).toBe("open");
    expect(getNavMotionIntent("Kommunikation")).toBe("communicate");
    expect(getNavMotionIntent("Einstellungen")).toBe("gear");
  });

  it("falls back to hover for unknown labels", () => {
    expect(getNavMotionIntent("Unknown Module")).toBe("hover");
  });
});

describe("MotionIcon", () => {
  it("renders with sce-motion-icon class and data-motion-intent attribute", () => {
    const { container } = render(
      <MotionIcon icon={LayoutDashboard} intent="hover" className="h-4 w-4" />,
    );
    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("sce-motion-icon");
    expect(svg).toHaveAttribute("data-motion-intent", "hover");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("applies active class when active prop is true", () => {
    const { container } = render(
      <MotionIcon icon={Settings2} intent="gear" active />,
    );
    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("sce-motion-icon--active");
  });

  it("defaults to hover intent", () => {
    const { container } = render(<MotionIcon icon={LayoutDashboard} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("data-motion-intent", "hover");
  });
});

describe("SyncFlowIndicator", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
  });

  it("renders source and destinations without implying real sync", () => {
    render(
      <SyncFlowIndicator
        source="SportClubEvo"
        destinations={[
          { id: "web", label: "Website", status: "complete" },
          { id: "ib", label: "InfoBoard", status: "idle" },
        ]}
      />,
    );

    expect(screen.getByText("SportClubEvo")).toBeInTheDocument();
    expect(screen.getByText("Website")).toBeInTheDocument();
    expect(screen.getByText("InfoBoard")).toBeInTheDocument();
    expect(screen.getByLabelText("Verteilung von SportClubEvo")).toBeInTheDocument();
  });

  it("applies active class when active prop is true", () => {
    const { container } = render(
      <SyncFlowIndicator
        source="Training geändert"
        active
        destinations={[
          { id: "web", label: "Website", status: "pending" },
        ]}
      />,
    );
    expect(container.querySelector(".sce-sync-flow--active")).toBeInTheDocument();
  });

  it("shows check mark for complete destinations", () => {
    const { container } = render(
      <SyncFlowIndicator
        source="News veröffentlicht"
        destinations={[
          { id: "web", label: "Website", status: "complete" },
        ]}
      />,
    );
    expect(container.querySelector(".sce-sync-flow__check")).toBeInTheDocument();
  });
});
