/**
 * SEASON-01 — /api/seasons/[seasonId]/activate route tests.
 *
 * The transactional "Aktuell setzen" business logic (exactly one current
 * Season, previous current cleared) is covered live in
 * lib/seasons/__tests__/season-01-mutations.test.ts — this file only
 * asserts the route delegates to activateSeason() and maps errors.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiPermission: vi.fn(),
  activateSeason: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-permission", () => ({
  requireApiPermission: mocks.requireApiPermission,
}));

vi.mock("@/lib/seasons/mutations", () => ({
  activateSeason: mocks.activateSeason,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { POST } from "@/app/api/seasons/[seasonId]/activate/route";
import { SeasonNotFoundError } from "@/lib/seasons/errors";

const SEASON_ID = "season-1";

function mockAuthorized() {
  mocks.requireApiPermission.mockResolvedValue({
    ok: true,
    status: 200,
    error: null,
    session: { user: { id: "actor-1" } },
  });
}

function ctx() {
  return { params: Promise.resolve({ seasonId: SEASON_ID }) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/seasons/[seasonId]/activate", () => {
  it("delegates to activateSeason with the session-derived actor id", async () => {
    mockAuthorized();
    mocks.activateSeason.mockResolvedValue({
      season: { id: SEASON_ID, key: "2026/2027", name: "Season 2026/2027", isActive: true, startDate: new Date(), endDate: new Date() },
      alreadyActive: false,
    });

    const res = await POST(new Request("http://localhost"), ctx());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mocks.activateSeason).toHaveBeenCalledWith(SEASON_ID, "actor-1");
    expect(body.message).toContain("aktuelle Saison");
  });

  it("returns a distinct message when the Season is already current (idempotent)", async () => {
    mockAuthorized();
    mocks.activateSeason.mockResolvedValue({
      season: { id: SEASON_ID, key: "2026/2027", name: "Season 2026/2027", isActive: true, startDate: new Date(), endDate: new Date() },
      alreadyActive: true,
    });

    const res = await POST(new Request("http://localhost"), ctx());
    const body = await res.json();

    expect(body.message).toContain("bereits aktuell");
  });

  it("maps SeasonNotFoundError to 404", async () => {
    mockAuthorized();
    mocks.activateSeason.mockRejectedValue(new SeasonNotFoundError());

    const res = await POST(new Request("http://localhost"), ctx());
    expect(res.status).toBe(404);
  });

  it("returns 403 when the caller lacks seasons.manage", async () => {
    mocks.requireApiPermission.mockResolvedValue({ ok: false, status: 403, error: "Forbidden", session: null });

    const res = await POST(new Request("http://localhost"), ctx());
    expect(res.status).toBe(403);
    expect(mocks.activateSeason).not.toHaveBeenCalled();
  });
});
