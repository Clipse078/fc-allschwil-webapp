/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ClubForm from "../ClubForm";
import { LOGO_CONTRAST_MODES } from "@/lib/club-directory/logo-contrast-mode";

const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh, back: vi.fn() }),
}));

beforeEach(() => {
  vi.restoreAllMocks();
  push.mockReset();
  refresh.mockReset();
});

describe("ClubForm — logo contrast mode", () => {
  it("displays the current mode in edit mode", () => {
    render(
      <ClubForm
        mode="edit"
        clubId="club-1"
        defaultValues={{
          name: "FC Black Stars",
          logoContrastMode: LOGO_CONTRAST_MODES.INVERT_ON_DARK,
        }}
      />,
    );

    expect(screen.getByLabelText("Logo auf dunklem Hintergrund")).toHaveValue(
      LOGO_CONTRAST_MODES.INVERT_ON_DARK,
    );
  });

  it("submits the selected logoContrastMode on save", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ club: { id: "club-1" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ClubForm
        mode="edit"
        clubId="club-1"
        defaultValues={{
          name: "FC Black Stars",
          logoContrastMode: LOGO_CONTRAST_MODES.NORMAL,
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText("Logo auf dunklem Hintergrund"), {
      target: { value: LOGO_CONTRAST_MODES.INVERT_ON_DARK },
    });
    fireEvent.click(screen.getByRole("button", { name: "Änderungen speichern" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/club-directory/clubs/club-1",
        expect.objectContaining({
          method: "PUT",
          body: expect.stringContaining(`"logoContrastMode":"${LOGO_CONTRAST_MODES.INVERT_ON_DARK}"`),
        }),
      );
    });
  });
});
