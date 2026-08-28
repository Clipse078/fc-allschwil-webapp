/**
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAnyPermission: vi.fn(),
  hasPermission: vi.fn(),
  getTeamDetailData: vi.fn(),
  getActiveTenant: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

vi.mock("@/lib/permissions/require-any-permission", () => ({
  requireAnyPermission: mocks.requireAnyPermission,
}));
vi.mock("@/lib/permissions/has-permission", () => ({
  hasPermission: mocks.hasPermission,
}));
vi.mock("@/lib/teams/queries", () => ({
  getTeamDetailData: mocks.getTeamDetailData,
}));
vi.mock("@/lib/tenants/active-tenant", () => ({
  getActiveTenant: mocks.getActiveTenant,
}));
vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
}));

import { requireTeamCockpitAccess } from "@/lib/teams/team-cockpit-layout";

const TENANT_ID = "tenant-a";
const TEAM_ID = "team-1";

const TEAM_FIXTURE = {
  id: TEAM_ID,
  name: "FC Test",
  displayName: "FC Test",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAnyPermission.mockResolvedValue({ user: { id: "user-1" } });
  mocks.hasPermission.mockReturnValue(true);
  mocks.getActiveTenant.mockResolvedValue({ id: TENANT_ID, key: "tenant-a" });
  mocks.getTeamDetailData.mockResolvedValue(TEAM_FIXTURE);
});

describe("TEAM-COCKPIT-PREMIUM-01D — requireTeamCockpitAccess", () => {
  it("scopes team lookup to the active tenant", async () => {
    await requireTeamCockpitAccess(TEAM_ID);

    expect(mocks.getTeamDetailData).toHaveBeenCalledWith(TENANT_ID, TEAM_ID);
  });

  it("returns notFound when team is outside tenant", async () => {
    mocks.getTeamDetailData.mockResolvedValue(null);

    await expect(requireTeamCockpitAccess(TEAM_ID)).rejects.toThrow("NOT_FOUND");
  });

  it("returns notFound when tenant is missing", async () => {
    mocks.getActiveTenant.mockResolvedValue(null);

    await expect(requireTeamCockpitAccess(TEAM_ID)).rejects.toThrow("NOT_FOUND");
  });

  it("requires teams view/manage/delete permission boundary", async () => {
    await requireTeamCockpitAccess(TEAM_ID);

    expect(mocks.requireAnyPermission).toHaveBeenCalled();
  });

  it("derives manage/delete flags from session permissions", async () => {
    mocks.hasPermission.mockImplementation((_session, permission) => {
      return permission === "teams.manage";
    });

    const access = await requireTeamCockpitAccess(TEAM_ID);

    expect(access.canManage).toBe(true);
    expect(access.canDelete).toBe(false);
  });
});
