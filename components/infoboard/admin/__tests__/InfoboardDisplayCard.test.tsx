/**
 * @vitest-environment jsdom
 */

/**
 * components/infoboard/admin/__tests__/InfoboardDisplayCard.test.tsx
 *
 * Tests for InfoboardDisplayCard.
 *
 * Verifies:
 *   - active Display 1 status renders "Aktiv" badge
 *   - planned Display 2 state renders "In Vorbereitung" badge
 *   - disabled action button has no href
 *   - correct German labels
 *   - public route is rendered as code
 *   - action links are rendered when provided
 *   - Display 2 disabled action: "Noch nicht verfügbar"
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { InfoboardDisplayCard } from "../InfoboardDisplayCard";

describe("InfoboardDisplayCard", () => {
  it("renders label, title, and description", () => {
    render(
      <InfoboardDisplayCard
        label="Display 1"
        title="Tagesübersicht"
        status="active"
        description="Zeigt die heutigen Trainings."
        publicRoute="/infoboard/screen-1"
        actions={[
          { label: "Öffnen", href: "/infoboard/screen-1", variant: "primary" },
        ]}
      />,
    );

    expect(screen.getByText("Display 1")).toBeInTheDocument();
    expect(screen.getByText("Tagesübersicht")).toBeInTheDocument();
    expect(screen.getByText("Zeigt die heutigen Trainings.")).toBeInTheDocument();
  });

  it("renders 'Aktiv' status badge for active display", () => {
    render(
      <InfoboardDisplayCard
        label="Display 1"
        title="Tagesübersicht"
        status="active"
        description="Description"
        publicRoute="/infoboard/screen-1"
      />,
    );

    expect(screen.getByText("Aktiv")).toBeInTheDocument();
    expect(screen.queryByText("In Vorbereitung")).not.toBeInTheDocument();
  });

  it("renders 'In Vorbereitung' status badge for planned display", () => {
    render(
      <InfoboardDisplayCard
        label="Display 2"
        title="Sportanlage"
        status="planned"
        description="Description"
        publicRoute="/infoboard/screen-2"
      />,
    );

    expect(screen.getByText("In Vorbereitung")).toBeInTheDocument();
    expect(screen.queryByText("Aktiv")).not.toBeInTheDocument();
  });

  it("renders the public route as code text", () => {
    render(
      <InfoboardDisplayCard
        label="Display 1"
        title="Tagesübersicht"
        status="active"
        description="Description"
        publicRoute="/infoboard/screen-1"
      />,
    );

    expect(screen.getByText("/infoboard/screen-1")).toBeInTheDocument();
  });

  it("renders action links when provided", () => {
    render(
      <InfoboardDisplayCard
        label="Display 1"
        title="Tagesübersicht"
        status="active"
        description="Description"
        publicRoute="/infoboard/screen-1"
        actions={[
          { label: "Öffnen", href: "/infoboard/screen-1", variant: "primary" },
          { label: "Vorschau", href: "/infoboard/preview/screen-1", variant: "secondary" },
        ]}
      />,
    );

    const openLink = screen.getByRole("link", { name: /Öffnen/i });
    expect(openLink).toHaveAttribute("href", "/infoboard/screen-1");

    const previewLink = screen.getByRole("link", { name: /Vorschau/i });
    expect(previewLink).toHaveAttribute("href", "/infoboard/preview/screen-1");
  });

  it("renders disabled 'Noch nicht verfügbar' button when no actions provided", () => {
    render(
      <InfoboardDisplayCard
        label="Display 2"
        title="Sportanlage"
        status="planned"
        description="Description"
        publicRoute="/infoboard/screen-2"
      />,
    );

    const button = screen.getByRole("button", { name: "Noch nicht verfügbar" });
    expect(button).toBeDisabled();
  });

  it("does not link to /infoboard/screen-2 when Display 2 has no actions", () => {
    render(
      <InfoboardDisplayCard
        label="Display 2"
        title="Sportanlage"
        status="planned"
        description="Description"
        publicRoute="/infoboard/screen-2"
      />,
    );

    // No link to the screen-2 route
    const links = screen.queryAllByRole("link");
    const screen2Link = links.find((l) => l.getAttribute("href") === "/infoboard/screen-2");
    expect(screen2Link).toBeUndefined();
  });

  it("the primary action for Display 1 opens in a new tab", () => {
    render(
      <InfoboardDisplayCard
        label="Display 1"
        title="Tagesübersicht"
        status="active"
        description="Description"
        publicRoute="/infoboard/screen-1"
        actions={[
          { label: "Öffnen", href: "/infoboard/screen-1", variant: "primary" },
        ]}
      />,
    );

    const link = screen.getByRole("link", { name: /Öffnen/i });
    expect(link).toHaveAttribute("target", "_blank");
  });
});
