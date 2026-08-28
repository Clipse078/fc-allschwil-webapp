/**
 * @vitest-environment jsdom
 *
 * TEAM-COCKPIT-PREMIUM-01K — TeamPhotoSection UI tests.
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TeamPhotoSection from "../TeamPhotoSection";

const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} data-testid="team-photo-image" />
  ),
}));

beforeEach(() => {
  mockRefresh.mockReset();
  vi.stubGlobal("fetch", vi.fn());
  vi.stubGlobal("confirm", vi.fn(() => true));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("TeamPhotoSection — display", () => {
  it("AB. photo displayed when present", () => {
    render(
      <TeamPhotoSection
        teamId="team-1"
        teamDisplayName="Junioren A"
        initialPhotoUrl="https://example.com/team.jpg"
        canManagePhoto={false}
      />,
    );

    const img = screen.getByTestId("team-photo-image");
    expect(img.getAttribute("src")).toContain("example.com");
    expect(screen.queryByTestId("team-photo-placeholder")).toBeNull();
  });

  it("AC. placeholder when absent", () => {
    render(
      <TeamPhotoSection
        teamId="team-1"
        teamDisplayName="Junioren A"
        initialPhotoUrl={null}
        canManagePhoto={false}
      />,
    );

    expect(screen.getByTestId("team-photo-placeholder")).toBeInTheDocument();
    expect(screen.queryByTestId("team-photo-image")).toBeNull();
  });

  it("AF. alt text meaningful", () => {
    render(
      <TeamPhotoSection
        teamId="team-1"
        teamDisplayName="Junioren A"
        initialPhotoUrl="https://example.com/team.jpg"
        canManagePhoto={false}
      />,
    );

    expect(screen.getByAltText("Teamfoto Junioren A")).toBeInTheDocument();
  });
});

describe("TeamPhotoSection — management affordances", () => {
  it("AD. manager sees upload/change/remove", () => {
    render(
      <TeamPhotoSection
        teamId="team-1"
        teamDisplayName="Junioren A"
        initialPhotoUrl="https://example.com/team.jpg"
        canManagePhoto={true}
      />,
    );

    expect(screen.getByTestId("team-photo-upload-button")).toHaveTextContent("Foto ändern");
    expect(screen.getByTestId("team-photo-remove-button")).toBeInTheDocument();
  });

  it("shows Foto hochladen when no photo", () => {
    render(
      <TeamPhotoSection
        teamId="team-1"
        teamDisplayName="Junioren A"
        initialPhotoUrl={null}
        canManagePhoto={true}
      />,
    );

    expect(screen.getByTestId("team-photo-upload-button")).toHaveTextContent("Foto hochladen");
    expect(screen.queryByTestId("team-photo-remove-button")).toBeNull();
  });

  it("AE. player/viewer sees no mutation actions", () => {
    render(
      <TeamPhotoSection
        teamId="team-1"
        teamDisplayName="Junioren A"
        initialPhotoUrl={null}
        canManagePhoto={false}
      />,
    );

    expect(screen.queryByTestId("team-photo-upload-button")).toBeNull();
    expect(screen.queryByTestId("team-photo-remove-button")).toBeNull();
  });
});

describe("TeamPhotoSection — interactions", () => {
  it("AH. loading states during upload", async () => {
    vi.mocked(fetch).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve(
                new Response(JSON.stringify({ photoUrl: "https://example.com/new.jpg" }), {
                  status: 200,
                }),
              ),
            50,
          );
        }),
    );

    render(
      <TeamPhotoSection
        teamId="team-1"
        teamDisplayName="Junioren A"
        initialPhotoUrl={null}
        canManagePhoto={true}
      />,
    );

    const input = screen.getByLabelText("Teamfoto auswählen") as HTMLInputElement;
    const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });

    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByTestId("team-photo-upload-button")).toHaveTextContent("Wird hochgeladen …");

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("AI. German errors on upload failure", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Bild darf maximal 4 MB groß sein." }), {
        status: 400,
      }),
    );

    render(
      <TeamPhotoSection
        teamId="team-1"
        teamDisplayName="Junioren A"
        initialPhotoUrl={null}
        canManagePhoto={true}
      />,
    );

    const input = screen.getByLabelText("Teamfoto auswählen") as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(["data"], "photo.jpg", { type: "image/jpeg" })] },
    });

    await waitFor(() => {
      expect(screen.getByTestId("team-photo-error")).toHaveTextContent("4 MB");
    });
  });

  it("remove calls DELETE and refreshes", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Teamfoto entfernt." }), { status: 200 }),
    );

    render(
      <TeamPhotoSection
        teamId="team-1"
        teamDisplayName="Junioren A"
        initialPhotoUrl="https://example.com/team.jpg"
        canManagePhoto={true}
      />,
    );

    fireEvent.click(screen.getByTestId("team-photo-remove-button"));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/teams/team-1/photo", { method: "DELETE" });
      expect(mockRefresh).toHaveBeenCalled();
    });
  });
});

describe("TeamPhotoSection — responsive layout", () => {
  it("AG. section renders without horizontal overflow class issues", () => {
    const { container } = render(
      <TeamPhotoSection
        teamId="team-1"
        teamDisplayName="Junioren A"
        initialPhotoUrl={null}
        canManagePhoto={true}
      />,
    );

    const section = container.querySelector('[data-testid="team-photo-section"]');
    expect(section?.className).not.toMatch(/overflow-x-scroll/);
    expect(screen.getByTestId("team-photo-frame").className).toMatch(/w-24|w-20/);
  });
});
