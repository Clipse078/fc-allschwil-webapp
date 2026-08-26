/**
 * @vitest-environment jsdom
 *
 * INFOBOARD-ROLLING-01F — InfoboardPageRotator regression coverage.
 */

import { render, screen, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InfoboardPageRotator } from "@/components/infoboard/screen1/InfoboardPageRotator";

function pageMarkup(id: string, label: string) {
  return (
    <ul key={id} data-testid={id}>
      <li>{label}</li>
    </ul>
  );
}

describe("InfoboardPageRotator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("TEST A — advances Page 1 → Page 2 → Page 1 every 12 seconds", async () => {
    render(
      <InfoboardPageRotator intervalMs={12_000}>
        {pageMarkup("event-list", "Page 1")}
        {pageMarkup("event-list-page-1", "Page 2")}
      </InfoboardPageRotator>,
    );

    expect(screen.getByTestId("event-list")).toBeTruthy();
    expect(screen.queryByTestId("event-list-page-1")).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(12_000);
    });
    expect(screen.queryByTestId("event-list")).toBeNull();
    expect(screen.getByTestId("event-list-page-1")).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(12_000);
    });
    expect(screen.getByTestId("event-list")).toBeTruthy();
    expect(screen.queryByTestId("event-list-page-1")).toBeNull();
  });

  it("TEST B — single page does not rotate", async () => {
    render(
      <InfoboardPageRotator intervalMs={12_000}>
        {pageMarkup("event-list", "Only page")}
      </InfoboardPageRotator>,
    );

    expect(screen.getByTestId("event-list")).toBeTruthy();
    expect(screen.queryByTestId("infoboard-page-rotator")).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(36_000);
    });
    expect(screen.getByTestId("event-list")).toBeTruthy();
    expect(screen.queryByTestId("event-list-page-1")).toBeNull();
  });

  it("TEST C — page count changes keep a valid visible page", async () => {
    const { rerender } = render(
      <InfoboardPageRotator intervalMs={12_000}>
        {pageMarkup("event-list", "Page 1")}
        {pageMarkup("event-list-page-1", "Page 2")}
      </InfoboardPageRotator>,
    );

    await act(async () => {
      vi.advanceTimersByTime(12_000);
    });
    expect(screen.getByTestId("event-list-page-1")).toBeTruthy();

    rerender(
      <InfoboardPageRotator intervalMs={12_000}>
        {pageMarkup("event-list", "Only page after shrink")}
      </InfoboardPageRotator>,
    );

    expect(screen.getByTestId("event-list")).toBeTruthy();
    expect(screen.getByText("Only page after shrink")).toBeTruthy();
    expect(screen.queryByTestId("infoboard-page-rotator")).toBeNull();

    rerender(
      <InfoboardPageRotator intervalMs={12_000}>
        {pageMarkup("event-list", "Page 1 again")}
        {pageMarkup("event-list-page-1", "Page 2 again")}
      </InfoboardPageRotator>,
    );

    expect(screen.getByTestId("infoboard-page-rotator")).toBeTruthy();
    expect(screen.getByTestId("infoboard-page-rotator").getAttribute("data-active-page")).toBe(
      "0",
    );
    expect(screen.getByText("Page 1 again")).toBeTruthy();
    expect(screen.queryByText("Page 2 again")).toBeNull();
  });

  it("does not reset the rotation clock when page count stays above one", async () => {
    const { rerender } = render(
      <InfoboardPageRotator intervalMs={12_000}>
        {pageMarkup("event-list", "Page 1")}
        {pageMarkup("event-list-page-1", "Page 2")}
      </InfoboardPageRotator>,
    );

    await act(async () => {
      vi.advanceTimersByTime(6_000);
    });

    rerender(
      <InfoboardPageRotator intervalMs={12_000}>
        {pageMarkup("event-list", "Page 1 refreshed")}
        {pageMarkup("event-list-page-1", "Page 2 refreshed")}
      </InfoboardPageRotator>,
    );

    expect(screen.getByText("Page 1 refreshed")).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(6_000);
    });
    expect(screen.getByText("Page 2 refreshed")).toBeTruthy();
  });

  it("supports stable preview-only manual page control", async () => {
    const onPageChange = vi.fn();
    render(
      <InfoboardPageRotator
        activePage={1}
        autoRotate={false}
        onPageChange={onPageChange}
        intervalMs={12_000}
      >
        {pageMarkup("event-list", "Page 1")}
        {pageMarkup("event-list-page-1", "Page 2")}
      </InfoboardPageRotator>,
    );
    expect(screen.getByText("Page 2")).toBeTruthy();
    await act(async () => vi.advanceTimersByTime(36_000));
    expect(screen.getByText("Page 2")).toBeTruthy();
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it("advances the controlled Preview Studio page after the production 12 seconds", async () => {
    const onPageChange = vi.fn();
    const onPageCountChange = vi.fn();
    render(
      <InfoboardPageRotator
        activePage={0}
        autoRotate
        onPageChange={onPageChange}
        onPageCountChange={onPageCountChange}
      >
        {pageMarkup("event-list", "Page 1")}
        {pageMarkup("event-list-page-1", "Page 2")}
        {pageMarkup("event-list-page-2", "Page 3")}
      </InfoboardPageRotator>,
    );
    expect(onPageCountChange).toHaveBeenCalledWith(3);
    await act(async () => vi.advanceTimersByTime(12_000));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });
});
