/**
 * @vitest-environment jsdom
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PreviewStudio } from "@/components/infoboard/preview/PreviewStudio";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

describe("PreviewStudio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderStudio() {
    return render(
      <PreviewStudio
        initialScreen="1"
        initialDate="2026-08-26"
        initialTime="18:20"
        timeZone="Europe/Zurich"
      />,
    );
  }

  it("switches the actual frame renderer and keeps URL state shareable", async () => {
    renderStudio();
    await userEvent.selectOptions(screen.getByLabelText("Screen"), "2");
    expect(screen.getByTitle("Infoboard Vorschau Screen 2")).toHaveAttribute(
      "src",
      expect.stringContaining("screen=2"),
    );
    expect(mocks.replace).toHaveBeenLastCalledWith(
      "/dashboard/infoboard/preview?screen=2&date=2026-08-26&time=18%3A20",
      { scroll: false },
    );
  });

  it.each([
    ["−30 min", "17%3A50"],
    ["−15 min", "18%3A05"],
    ["+15 min", "18%3A35"],
    ["+30 min", "18%3A50"],
  ])("%s updates the simulated tenant time", async (label, expectedTime) => {
    renderStudio();
    await userEvent.click(screen.getByRole("button", { name: label }));
    expect(mocks.replace).toHaveBeenLastCalledWith(
      expect.stringContaining(`time=${expectedTime}`),
      { scroll: false },
    );
  });

  it("Jetzt resets date and time to the current Europe/Zurich moment", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-27T05:10:00.000Z"));
    renderStudio();
    fireEvent.click(screen.getByRole("button", { name: /Jetzt/ }));
    expect(mocks.replace).toHaveBeenLastCalledWith(
      "/dashboard/infoboard/preview?screen=1&date=2026-08-27&time=07%3A10",
      { scroll: false },
    );
  });

  it("exposes production page count and sends manual page commands only", () => {
    renderStudio();
    const frame = screen.getByTitle(
      "Infoboard Vorschau Screen 1",
    ) as HTMLIFrameElement;
    const postMessage = vi.spyOn(frame.contentWindow!, "postMessage");
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          origin: window.location.origin,
          source: frame.contentWindow,
          data: {
            source: "infoboard-preview-frame",
            type: "STATE",
            page: 0,
            pageCount: 3,
          },
        }),
      );
    });
    expect(screen.getByText("Seite 1 von 3")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Nächste Seite" }));
    expect(postMessage).toHaveBeenCalledWith(
      {
        source: "infoboard-preview-studio",
        type: "SET_PAGE",
        page: 1,
      },
      window.location.origin,
    );
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("date/time changes perform no write action", () => {
    renderStudio();
    fireEvent.change(screen.getByLabelText("Datum"), {
      target: { value: "2026-08-29" },
    });
    fireEvent.change(screen.getByLabelText("Zeit"), {
      target: { value: "08:30" },
    });
    expect(mocks.replace).toHaveBeenCalledTimes(2);
  });
});
