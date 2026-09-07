import { describe, expect, it } from "vitest";
import { getTenantClubAdminRoleKey } from "@/lib/roles/tenant-role-keys";

describe("SUPERADMIN-OPS-01A isolation", () => {
  it("does not hardcode FC Allschwil in platform role key helper", () => {
    expect(getTenantClubAdminRoleKey("fc-allschwil")).toBe("club_admin__fc-allschwil");
    expect(getTenantClubAdminRoleKey("another-club")).toBe("club_admin__another-club");
  });
});
