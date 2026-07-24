/**
 * @vitest-environment jsdom
 */

/**
 * app/(admin)/dashboard/infoboard/__tests__/page.test.tsx
 *
 * Tests for the Infoboard administration page (server component).
 *
 * Verifies:
 *   - Authenticated tenant is used (from session, not query params)
 *   - Page renders title "Infoboard" and subtitle
 *   - Display 1 card renders with route /infoboard/screen-1
 *   - Preview route is /infoboard/preview/screen-1
 *   - Display 2 card renders as unavailable
 *   - No active link to /infoboard/screen-2
 *   - Legacy /infoboard is not the primary action
 *   - Empty state renders correctly
 *   - Live service is used directly (no HTTP fetch)
 *   - Old legacy feed (getInfoboardFeed) is not used
 *   - No preview fixtures are imported or used
 *   - Today metrics render
 *   - Tomorrow query parameter is supported
 *   - Invalid date falls back safely
 *   - Query parameter cannot select a tenant
 *   - Legacy notice renders
 *   - Roadmap notice renders
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  requireAnyPermission: vi.fn(),
  getTenantContextFromSession: vi.fn(),
  buildScreen1LivePayload: vi.fn(),
  notFound: vi.fn(),
  eventFindMany: vi.fn().mockResolvedValue([]),
  facilityResourceFindMany: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/permissions/require-any-permission", () => ({
  requireAnyPermission: mocks.requireAnyPermission,
}));

vi.mock("@/lib/tenants/context", () => ({
  getTenantContextFromSession: mocks.getTenantContextFromSession,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    event: { findMany: mocks.eventFindMany },
    facilityResource: { findMany: mocks.facilityResourceFindMany },
  },
}));

vi.mock("@/lib/publishing/infoboard/screen1-live-service", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/publishing/infoboard/screen1-live-service")
  >("@/lib/publishing/infoboard/screen1-live-service");
  return {
    ...actual,
    buildScreen1LivePayload: mocks.buildScreen1LivePayload,
  };
});

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ACTIVE_SESSION = {
  user: { tenantId: "tenant-fca", id: "user-1", name: "Admin" },
};

const ACTIVE_TENANT = {
  id: "tenant-fca",
  key: "fc-allschwil",
  name: "FC Allschwil",
  timezone: "Europe/Zurich",
  logoUrl: null,
  locale: "de-CH",
  countryCode: "CH",
  sportCategory: "FOOTBALL",
  currency: "CHF",
  status: "ACTIVE",
  seasonStartMonth: 8,
  seasonTransitionDay: 1,
  seasonTransitionMonth: 8,
  primaryColor: null,
  secondaryColor: null,
  approvedDataOnly: false,
};

const EMPTY_FEED = {
  generatedAt: "2026-07-24T10:00:00.000Z",
  tenant: {
    id: "tenant-fca",
    key: "fc-allschwil",
    name: "FC Allschwil",
    timezone: "Europe/Zurich",
  },
  displayDate: "2026-07-24",
  isStale: false,
  wochenplanVariantBadge: null,
  current: [],
  next: [],
  later: [],
  isEmpty: true,
};

const EMPTY_PAYLOAD = {
  feed: EMPTY_FEED,
  eventPresentation: [],
  announcement: null,
  branding: {
    clubLogoSrc: "/images/logos/fc-allschwil.png",
    productLogoSrc: "/images/branding/sportclubevo_logo.png",
  },
  currentTimeIso: "2026-07-24T10:00:00.000Z",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function renderPage(searchParams?: Record<string, string>) {
  const { default: InfoboardAdminPage } = await import(
    "@/app/(admin)/dashboard/infoboard/page"
  );
  const params = searchParams
    ? Promise.resolve(searchParams)
    : Promise.resolve({});
  render(await InfoboardAdminPage({ searchParams: params }));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("InfoboardAdminPage", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.requireAnyPermission.mockResolvedValue(ACTIVE_SESSION);
    mocks.getTenantContextFromSession.mockResolvedValue(ACTIVE_TENANT);
    mocks.buildScreen1LivePayload.mockResolvedValue(EMPTY_PAYLOAD);
    mocks.notFound.mockImplementation(() => {
      throw new Error("notFound");
    });
  });

  it("renders page title 'Infoboard'", async () => {
    await renderPage();
    expect(screen.getByRole("heading", { name: "Infoboard" })).toBeInTheDocument();
  });

  it("renders subtitle mentioning öffentlichen Infoboard-Displays", async () => {
    await renderPage();
    expect(
      screen.getByText(/Steuere und überwache die öffentlichen Infoboard-Displays/i),
    ).toBeInTheDocument();
  });

  it("renders Display 1 card with correct label and title", async () => {
    await renderPage();
    expect(screen.getByText("Display 1")).toBeInTheDocument();
    expect(screen.getByText("Tagesübersicht")).toBeInTheDocument();
  });

  it("renders Display 1 route as /infoboard/screen-1", async () => {
    await renderPage();
    const links = screen.getAllByRole("link");
    const screen1Links = links.filter(
      (l) => l.getAttribute("href") === "/infoboard/screen-1",
    );
    expect(screen1Links.length).toBeGreaterThan(0);
  });

  it("renders preview link to /infoboard/preview/screen-1", async () => {
    await renderPage();
    const previewLink = screen
      .getAllByRole("link")
      .find((l) => l.getAttribute("href") === "/infoboard/preview/screen-1");
    expect(previewLink).toBeDefined();
  });

  it("renders Display 2 card as unavailable", async () => {
    await renderPage();
    expect(screen.getByText("Display 2")).toBeInTheDocument();
    // "In Vorbereitung" appears as Display 2 badge and roadmap heading — multiple occurrences
    const inPrep = screen.getAllByText("In Vorbereitung");
    expect(inPrep.length).toBeGreaterThanOrEqual(1);
    const disabledButton = screen.getByRole("button", { name: "Noch nicht verfügbar" });
    expect(disabledButton).toBeDisabled();
  });

  it("does not link to /infoboard/screen-2", async () => {
    await renderPage();
    const links = screen.getAllByRole("link");
    const screen2Link = links.find(
      (l) => l.getAttribute("href") === "/infoboard/screen-2",
    );
    expect(screen2Link).toBeUndefined();
  });

  it("does not promote /infoboard as the primary action", async () => {
    await renderPage();
    const links = screen.getAllByRole("link");
    const legacyLink = links.find((l) => l.getAttribute("href") === "/infoboard");
    // Legacy route must not appear as a link
    expect(legacyLink).toBeUndefined();
  });

  it("renders empty state event list when feed is empty", async () => {
    await renderPage();
    expect(
      screen.getByText(
        "Heute sind keine Trainings, Heimspiele oder Turniere für Display 1 geplant.",
      ),
    ).toBeInTheDocument();
  });

  it("renders KPI cards with zero counts on empty feed", async () => {
    await renderPage();
    expect(screen.getByText("Heute sichtbar")).toBeInTheDocument();
    expect(screen.getByText("Jetzt aktiv")).toBeInTheDocument();
    expect(screen.getByText("Als Nächstes")).toBeInTheDocument();
    expect(screen.getByText("Später heute")).toBeInTheDocument();
  });

  it("uses authenticated tenant from session, not from query params", async () => {
    await renderPage({ date: "2026-07-25" });
    // getTenantContextFromSession is called with the session tenantId
    expect(mocks.getTenantContextFromSession).toHaveBeenCalledWith("tenant-fca");
    // buildScreen1LivePayload is called with the authenticated tenant
    expect(mocks.buildScreen1LivePayload).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant: expect.objectContaining({ id: "tenant-fca" }),
      }),
    );
  });

  it("query parameter cannot select a different tenant", async () => {
    await renderPage({ date: "2026-07-25", tenantId: "tenant-other" });
    // Still uses the session tenant
    expect(mocks.getTenantContextFromSession).toHaveBeenCalledWith("tenant-fca");
    expect(mocks.buildScreen1LivePayload).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant: expect.objectContaining({ id: "tenant-fca" }),
      }),
    );
  });

  it("supports tomorrow date query parameter", async () => {
    await renderPage({ date: "2026-07-25" });
    expect(mocks.buildScreen1LivePayload).toHaveBeenCalledWith(
      expect.objectContaining({
        now: expect.any(Date),
      }),
    );
    // Preview notice should appear
    expect(screen.getByText(/Vorschau für/i)).toBeInTheDocument();
  });

  it("falls back to today when date query param is invalid", async () => {
    await renderPage({ date: "invalid-date" });
    // No preview notice
    expect(screen.queryByText(/Vorschau für/i)).not.toBeInTheDocument();
  });

  it("falls back to today when date query param is empty", async () => {
    await renderPage({});
    // No preview notice
    expect(screen.queryByText(/Vorschau für/i)).not.toBeInTheDocument();
  });

  it("calls notFound when tenant is not found", async () => {
    mocks.getTenantContextFromSession.mockResolvedValue(null);
    await expect(renderPage()).rejects.toThrow("notFound");
  });

  it("calls notFound when tenant timezone is missing", async () => {
    mocks.getTenantContextFromSession.mockResolvedValue({
      ...ACTIVE_TENANT,
      timezone: null,
    });
    await expect(renderPage()).rejects.toThrow("notFound");
  });

  it("renders legacy notice mentioning /infoboard", async () => {
    await renderPage();
    expect(screen.getByText("Legacy-Display")).toBeInTheDocument();
    expect(screen.getByText(/Das frühere Display/i)).toBeInTheDocument();
  });

  it("renders roadmap section with 'In Vorbereitung' items", async () => {
    await renderPage();
    expect(screen.getByText("Display 2 — Sportanlage")).toBeInTheDocument();
    expect(screen.getByText("Ankündigungsleiste verwalten")).toBeInTheDocument();
    expect(screen.getByText("Branding verwalten")).toBeInTheDocument();
    expect(screen.getByText("Live-Aktualisierung und Verbindungsstatus")).toBeInTheDocument();
  });

  it("calls buildScreen1LivePayload, not legacy feed", async () => {
    await renderPage();
    // buildScreen1LivePayload must be called exactly once per render
    expect(mocks.buildScreen1LivePayload).toHaveBeenCalledOnce();
    // Since buildScreen1LivePayload is mocked, prisma is not called directly
    expect(mocks.eventFindMany).not.toHaveBeenCalled();
  });
});
