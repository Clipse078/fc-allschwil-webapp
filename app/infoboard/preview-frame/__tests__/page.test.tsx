/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAnyPermission: vi.fn(),
  getActiveTenant: vi.fn(),
  buildScreen1PreviewData: vi.fn(),
  buildScreen2PreviewData: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("@/lib/permissions/require-any-permission", () => ({
  requireAnyPermission: mocks.requireAnyPermission,
}));
vi.mock("@/lib/tenants/active-tenant", () => ({
  getActiveTenant: mocks.getActiveTenant,
}));
vi.mock("@/lib/infoboard/preview-data", () => ({
  buildScreen1PreviewData: mocks.buildScreen1PreviewData,
  buildScreen2PreviewData: mocks.buildScreen2PreviewData,
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/components/infoboard/preview/PreviewFrame", () => ({
  PreviewFrameScreen1: () => <div data-testid="screen-1-renderer" />,
  PreviewFrameScreen2: () => <div data-testid="screen-2-renderer" />,
  PreviewFrameStatic: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/components/infoboard/anlageplan/InfoboardAnlageplan", () => ({
  InfoboardAnlageplan: () => <div data-testid="anlageplan-renderer" />,
}));

const tenant = {
  id: "tenant-fca",
  key: "fc-allschwil",
  name: "FC Allschwil",
  timezone: "Europe/Zurich",
  logoUrl: null,
  infoboardDisplayTheme: null,
};

const screen1Data = {
  payload: {
    feed: {},
    branding: {},
    currentTimeIso: "2026-08-29T06:30:00.000Z",
    announcement: null,
    eventPresentation: [],
    theme: "DARK",
    headerConfig: null,
    presentation: null,
  },
  weather: null,
};

async function renderPage(params: Record<string, string>) {
  const { default: Page } = await import("../page");
  render(await Page({ searchParams: Promise.resolve(params) }));
}

describe("authenticated Infoboard Preview frame", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAnyPermission.mockResolvedValue({ user: { id: "admin" } });
    mocks.getActiveTenant.mockResolvedValue(tenant);
    mocks.buildScreen1PreviewData.mockResolvedValue(screen1Data);
    mocks.buildScreen2PreviewData.mockResolvedValue({
      renderer: "screen2",
      payload: {
        feed: {},
        branding: {},
        currentTimeIso: "2026-08-29T06:30:00.000Z",
        theme: "DARK",
      },
      weather: null,
    });
  });

  it("uses the admin guard and tenant-zoned simulated time", async () => {
    await renderPage({ screen: "1", date: "2026-08-29", time: "08:30" });
    expect(mocks.requireAnyPermission).toHaveBeenCalledOnce();
    expect(mocks.buildScreen1PreviewData).toHaveBeenCalledWith(
      tenant,
      new Date("2026-08-29T06:30:00.000Z"),
    );
    expect(screen.getByTestId("screen-1-renderer")).toBeTruthy();
  });

  it("switches to the production Screen 2 renderer", async () => {
    await renderPage({ screen: "2", date: "2026-08-29", time: "08:30" });
    expect(mocks.buildScreen2PreviewData).toHaveBeenCalledOnce();
    expect(screen.getByTestId("screen-2-renderer")).toBeTruthy();
    expect(screen.queryByTestId("screen-1-renderer")).toBeNull();
  });

  it("uses the production Anlageplan renderer when Screen 2 is configured for it", async () => {
    mocks.buildScreen2PreviewData.mockResolvedValue({
      renderer: "anlageplan",
      payload: {},
      weather: null,
      shellConfig: {},
      branding: {},
    });
    await renderPage({ screen: "2", date: "2026-08-29", time: "08:30" });
    expect(screen.getByTestId("anlageplan-renderer")).toBeTruthy();
  });
});
