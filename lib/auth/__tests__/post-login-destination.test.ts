import { describe, expect, it } from "vitest";
import {
  DEFAULT_POST_LOGIN_DESTINATION,
  PLATFORM_POST_LOGIN_DESTINATION,
  resolvePostLoginDestination,
} from "@/lib/auth/post-login-destination";
import { PERMISSIONS } from "@/lib/permissions/permissions";

describe("resolvePostLoginDestination", () => {
  it.each([PERMISSIONS.TENANTS_VIEW, PERMISSIONS.TENANTS_MANAGE])(
    "routes a platform-only operator with %s to Command Center",
    (permission) => {
      expect(
        resolvePostLoginDestination({
          activeTenantId: null,
          isImpersonating: false,
          permissionKeys: [permission],
        }),
      ).toBe(PLATFORM_POST_LOGIN_DESTINATION);
    },
  );

  it("keeps a tenant administrator on the tenant dashboard", () => {
    expect(
      resolvePostLoginDestination({
        activeTenantId: "tenant-fca",
        isImpersonating: false,
        permissionKeys: [PERMISSIONS.TENANTS_MANAGE],
      }),
    ).toBe(DEFAULT_POST_LOGIN_DESTINATION);
  });

  it("does not infer platform authority from having no tenant", () => {
    expect(
      resolvePostLoginDestination({
        activeTenantId: null,
        isImpersonating: false,
        permissionKeys: [],
      }),
    ).toBe(DEFAULT_POST_LOGIN_DESTINATION);
  });

  it("never routes an impersonated identity using platform authority", () => {
    expect(
      resolvePostLoginDestination({
        activeTenantId: null,
        isImpersonating: true,
        permissionKeys: [PERMISSIONS.TENANTS_MANAGE],
      }),
    ).toBe(DEFAULT_POST_LOGIN_DESTINATION);
  });
});
