/**
 * @vitest-environment jsdom
 */

import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SportingTeamLogo from "../SportingTeamLogo";

function renderedImage(container: HTMLElement): HTMLImageElement | null {
  return container.querySelector("img");
}

describe("SportingTeamLogo", () => {
  it.each([
    ["/images/clubs/example.svg", "root-relative"],
    ["https://example.public.blob.vercel-storage.com/crest.png", "Vercel Blob HTTPS"],
    ["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB", "data image"],
  ])("renders a supported %s URL", (logoUrl) => {
    const { container } = render(<SportingTeamLogo logoUrl={logoUrl} />);

    expect(renderedImage(container)).toHaveAttribute("src", logoUrl);
  });

  it.each([null, undefined, "", "   ", "javascript:alert(1)"])(
    "renders a neutral fallback for %s",
    (logoUrl) => {
      const { container } = render(<SportingTeamLogo logoUrl={logoUrl} />);

      expect(renderedImage(container)).toBeNull();
      expect(container.querySelector("svg")).toBeInTheDocument();
    },
  );

  it("swaps a failed image for a dimension-stable Shield fallback", () => {
    const { container } = render(
      <SportingTeamLogo logoUrl="/images/clubs/missing.svg" size="sm" />,
    );
    const image = renderedImage(container);

    expect(image).toHaveClass("h-6", "w-6");
    fireEvent.error(image!);

    expect(renderedImage(container)).toBeNull();
    expect(container.querySelector("span")).toHaveClass("h-6", "w-6");
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("keeps the crest decorative when adjacent text identifies the team", () => {
    const { container } = render(
      <div>
        <SportingTeamLogo logoUrl="/images/clubs/example.svg" />
        <span>FC Example</span>
      </div>,
    );
    const image = renderedImage(container);

    expect(image).toHaveAttribute("alt", "");
    expect(image).toHaveAttribute("aria-hidden", "true");
    expect(image).toHaveAttribute("loading", "lazy");
    expect(container).toHaveTextContent("FC Example");
  });
});
