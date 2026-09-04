/**
 * @vitest-environment jsdom
 *
 * SCE-DESIGN-04C — AnimatedNavIcon interaction tests
 */

import { render } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AnimatedNavIcon } from "@/components/ui/motion/AnimatedNavIcon";

describe("AnimatedNavIcon (SCE-DESIGN-04C)", () => {
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

  it("renders bespoke SVG with data-nav-icon attribute", () => {
    const { container } = render(
      <AnimatedNavIcon label="Dashboard" active={false} variant="parent" />,
    );
    const svg = container.querySelector("svg.sce-animated-nav-icon");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("data-nav-icon", "dashboard");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("applies active class when active prop is true", () => {
    const { container } = render(
      <AnimatedNavIcon label="Website" active variant="parent" />,
    );
    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("sce-animated-nav-icon--active");
  });

  it("applies child variant class for quieter child icons", () => {
    const { container } = render(
      <AnimatedNavIcon label="News" variant="child" />,
    );
    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("sce-animated-nav-icon--child");
    expect(svg).toHaveAttribute("data-nav-icon", "news");
  });

  it("contains internal animated elements, not whole-icon transform class", () => {
    const { container } = render(
      <AnimatedNavIcon label="Organisation" variant="parent" />,
    );
    const svg = container.querySelector("svg");
    expect(svg).not.toHaveClass("sce-motion-icon");
    expect(svg?.querySelector("[class*='ani-']")).toBeTruthy();
  });

  it("resolves all major nav areas to distinct icon keys", () => {
    const cases: Array<[string, string]> = [
      ["Dashboard", "dashboard"],
      ["Organisation", "organisation"],
      ["Website", "website"],
      ["Planung", "planung"],
      ["Dokumente", "dokumente"],
      ["Kommunikation", "kommunikation"],
      ["Administration", "administration"],
      ["MatchCenter", "matchcenter"],
      ["TournamentCenter", "tournamentcenter"],
    ];

    for (const [label, key] of cases) {
      const { container } = render(<AnimatedNavIcon label={label} />);
      expect(container.querySelector("svg")).toHaveAttribute("data-nav-icon", key);
    }
  });
});
