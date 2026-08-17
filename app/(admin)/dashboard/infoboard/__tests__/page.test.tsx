/**
 * @vitest-environment jsdom
 */

/**
 * app/(admin)/dashboard/infoboard/__tests__/page.test.tsx
 *
 * Tests for the Infoboard V2 administration page (server component).
 *
 * Verifies:
 *   - Authenticated tenant is used (from session, not query params)
 *   - Page renders title "Infoboards" and subtitle
 *   - Infoboard management workspace renders
 *   - No hard-coded Display 1 / Display 2 concept
 *   - Empty state renders when no boards exist
 *   - Summary count renders when boards exist
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  requireAnyPermission: vi.fn(),
  getActiveTenant: vi.fn(),
  listInfoboards: vi.fn(),
  countInfoboards: vi.fn(),
  notFound: vi.fn(),
  hasTenantDeletionAuthority: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/lib/permissions/require-any-permission", () => ({
  requireAnyPermission: mocks.requireAnyPermission,
}));

vi.mock("@/lib/tenants/active-tenant", () => ({
  getActiveTenant: mocks.getActiveTenant,
}));

vi.mock("@/lib/infoboard/queries", () => ({
  listInfoboards: mocks.listInfoboards,
  countInfoboards: mocks.countInfoboards,
}));

vi.mock("@/lib/permissions/services/effective-permission-resolver", () => ({
  createEffectivePermissionResolver: () => ({
    hasTenantDeletionAuthority: mocks.hasTenantDeletionAuthority,
  }),
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  useRouter: () => ({ refresh: vi.fn() }),
}));

// Stub Link so href is testable
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ACTIVE_TENANT = {
  id: "tenant-fca",
  key: "fc-allschwil",
  name: "FC Allschwil",
  timezone: "Europe/Zurich",
  logoUrl: null,
  infoboardDisplayTheme: null,
};

const SAMPLE_BOARD = {
  id: "board-1",
  tenantId: "tenant-fca",
  name: "Tagesübersicht",
  slug: "screen-1",
  status: "ACTIVE" as const,
  templateType: "TAGESUEBERSICHT",
  displayTheme: null,
  headerSubtitleEnabled: true,
  announcementEnabled: false,
  sortOrder: 0,
  createdAt: new Date("2026-08-01"),
  updatedAt: new Date("2026-08-01"),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function renderPage() {
  const { default: InfoboardAdminPage } = await import("../page");
  const ui = await InfoboardAdminPage();
  render(ui as React.ReactElement);
}

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();

  mocks.requireAnyPermission.mockResolvedValue({ user: { id: "user-test" } });
  mocks.getActiveTenant.mockResolvedValue(ACTIVE_TENANT);
  mocks.listInfoboards.mockResolvedValue([]);
  mocks.countInfoboards.mockResolvedValue({ total: 0, active: 0, draft: 0, disabled: 0 });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("InfoboardAdminPage V2 — page structure", () => {
  it("renders the Infoboards title", async () => {
    await renderPage();
    expect(screen.getByText("Infoboards")).toBeTruthy();
  });

  it("renders the management subtitle", async () => {
    await renderPage();
    expect(screen.getByText("Verwalte alle Infoboards, deren Inhalte, Layouts und Geräte.")).toBeTruthy();
  });

  it("does not render hard-coded Display 1 or Display 2", async () => {
    await renderPage();
    expect(screen.queryByText("Display 1")).toBeNull();
    expect(screen.queryByText("Display 2")).toBeNull();
  });

  it("does not render legacy/roadmap placeholders", async () => {
    await renderPage();
    expect(screen.queryByText("In Vorbereitung")).toBeNull();
    expect(screen.queryByText("Geplant")).toBeNull();
    expect(screen.queryByText("Noch nicht verfügbar")).toBeNull();
    expect(screen.queryByText("Legacy-Display")).toBeNull();
  });
});

describe("InfoboardAdminPage V2 — empty state", () => {
  it("renders empty state when no boards exist", async () => {
    await renderPage();
    expect(screen.getByText("Noch keine Infoboards")).toBeTruthy();
  });
});

describe("InfoboardAdminPage V2 — with boards", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.requireAnyPermission.mockResolvedValue({ user: { id: "user-test" } });
    mocks.getActiveTenant.mockResolvedValue(ACTIVE_TENANT);
    mocks.listInfoboards.mockResolvedValue([SAMPLE_BOARD]);
    mocks.countInfoboards.mockResolvedValue({ total: 1, active: 1, draft: 0, disabled: 0 });
  });

  it("renders status filter chips", async () => {
    await renderPage();
    expect(screen.getByText("Alle")).toBeTruthy();
    expect(screen.getAllByText("Aktiv").length).toBeGreaterThan(0);
  });

  it("renders a card for each Infoboard (board name visible)", async () => {
    await renderPage();
    // The board name "Tagesübersicht" should be visible (may appear multiple times due to template label)
    expect(screen.getAllByText("Tagesübersicht").length).toBeGreaterThan(0);
  });
});

describe("InfoboardAdminPage V2 — auth", () => {
  it("calls requireAnyPermission", async () => {
    await renderPage();
    expect(mocks.requireAnyPermission).toHaveBeenCalledOnce();
  });

  it("calls getActiveTenant", async () => {
    await renderPage();
    expect(mocks.getActiveTenant).toHaveBeenCalledOnce();
  });
});
