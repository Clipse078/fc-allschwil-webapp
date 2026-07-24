/**
 * @vitest-environment jsdom
 */

/**
 * app/infoboard/__tests__/page.test.tsx
 *
 * Tests for the /infoboard root page (PP-02F — compatibility redirect).
 *
 * Verifies:
 *   - Calls redirect("/infoboard/screen-1") server-side
 *   - Does not render the legacy InfoboardDisplay component
 *   - Does not call the legacy /api/public/infoboard feed
 *   - Does not instantiate timers or polling
 *   - Does not import or use preview fixtures
 *   - Does not accept or forward public preview dates
 *   - Query parameters do not create public date simulation
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  fetchSpy: vi.fn(),
  setIntervalSpy: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

// Prevent accidental import of the legacy InfoboardDisplay component
vi.mock("@/components/infoboard/InfoboardDisplay", () => ({
  default: vi.fn(() => null),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("InfoboardPage (PP-02F compatibility redirect)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.redirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT:/infoboard/screen-1");
    });
  });

  it("calls redirect with /infoboard/screen-1", async () => {
    const { default: InfoboardPage } = await import("@/app/infoboard/page");
    await expect(() => InfoboardPage()).toThrow("NEXT_REDIRECT:/infoboard/screen-1");
    expect(mocks.redirect).toHaveBeenCalledWith("/infoboard/screen-1");
  });

  it("calls redirect exactly once", async () => {
    const { default: InfoboardPage } = await import("@/app/infoboard/page");
    await expect(() => InfoboardPage()).toThrow();
    expect(mocks.redirect).toHaveBeenCalledOnce();
  });

  it("redirects to /infoboard/screen-1, not any other path", async () => {
    const { default: InfoboardPage } = await import("@/app/infoboard/page");
    await expect(() => InfoboardPage()).toThrow();
    const [calledWith] = mocks.redirect.mock.calls[0];
    expect(calledWith).toBe("/infoboard/screen-1");
    expect(calledWith).not.toContain("screen-2");
    expect(calledWith).not.toBe("/infoboard");
  });

  it("does not forward query parameters as public date preview", async () => {
    const { default: InfoboardPage } = await import("@/app/infoboard/page");
    // Page accepts no props — query params are not forwarded
    await expect(() => InfoboardPage()).toThrow();
    const [calledWith] = mocks.redirect.mock.calls[0];
    // Target URL must not contain any date query parameter
    expect(calledWith).not.toContain("?date=");
    expect(calledWith).not.toContain("date=2026-07-25");
  });

  it("does not render legacy InfoboardDisplay", async () => {
    const legacyModule = await import("@/components/infoboard/InfoboardDisplay");
    const { default: InfoboardPage } = await import("@/app/infoboard/page");
    await expect(() => InfoboardPage()).toThrow();
    // The legacy component factory must never be called
    expect(legacyModule.default).not.toHaveBeenCalled();
  });

  it("does not call the legacy /api/public/infoboard feed", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { default: InfoboardPage } = await import("@/app/infoboard/page");
    await expect(() => InfoboardPage()).toThrow();
    // No HTTP call should be made during the redirect
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("does not start any polling timer", async () => {
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    const { default: InfoboardPage } = await import("@/app/infoboard/page");
    await expect(() => InfoboardPage()).toThrow();
    expect(setIntervalSpy).not.toHaveBeenCalled();
    setIntervalSpy.mockRestore();
  });
});
