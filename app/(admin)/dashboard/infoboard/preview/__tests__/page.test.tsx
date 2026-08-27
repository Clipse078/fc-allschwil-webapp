/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAnyPermission: vi.fn(),
  getActiveTenant: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("@/lib/permissions/require-any-permission", () => ({
  requireAnyPermission: mocks.requireAnyPermission,
}));
vi.mock("@/lib/tenants/active-tenant", () => ({
  getActiveTenant: mocks.getActiveTenant,
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/components/infoboard/preview/PreviewStudio", () => ({
  PreviewStudio: (props: Record<string, string>) => (
    <div
      data-testid="preview-studio"
      data-screen={props.initialScreen}
      data-date={props.initialDate}
      data-time={props.initialTime}
    />
  ),
}));

describe("/dashboard/infoboard/preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAnyPermission.mockResolvedValue({ user: { id: "admin" } });
    mocks.getActiveTenant.mockResolvedValue({
      id: "tenant-fca",
      key: "fc-allschwil",
      name: "FC Allschwil",
      timezone: "Europe/Zurich",
    });
  });

  it("allows an authenticated Infoboard admin and initializes valid query params", async () => {
    const { default: Page } = await import("../page");
    render(
      await Page({
        searchParams: Promise.resolve({
          screen: "2",
          date: "2026-08-29",
          time: "08:30",
        }),
      }),
    );
    expect(mocks.requireAnyPermission).toHaveBeenCalledOnce();
    expect(screen.getByTestId("preview-studio")).toHaveAttribute(
      "data-screen",
      "2",
    );
    expect(screen.getByTestId("preview-studio")).toHaveAttribute(
      "data-time",
      "08:30",
    );
  });

  it("falls back safely for invalid query params", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-26T16:35:00.000Z"));
    const { default: Page } = await import("../page");
    render(
      await Page({
        searchParams: Promise.resolve({
          screen: "4",
          date: "invalid",
          time: "99:99",
        }),
      }),
    );
    expect(screen.getByTestId("preview-studio")).toHaveAttribute(
      "data-date",
      "2026-08-26",
    );
    expect(screen.getByTestId("preview-studio")).toHaveAttribute(
      "data-time",
      "18:35",
    );
    vi.useRealTimers();
  });
});
