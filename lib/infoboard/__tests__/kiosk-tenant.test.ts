/**
 * lib/infoboard/__tests__/kiosk-tenant.test.ts
 *
 * Tests for kiosk tenant resolution.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { resolveKioskTenantKey } from "../kiosk-tenant";

afterEach(() => {
  delete process.env.KIOSK_DEFAULT_TENANT_KEY;
});

describe("resolveKioskTenantKey", () => {
  it("returns DEFAULT_TENANT_KEY when env var is not set", () => {
    delete process.env.KIOSK_DEFAULT_TENANT_KEY;
    const key = resolveKioskTenantKey();
    expect(key).toBe("fc-allschwil");
  });

  it("returns KIOSK_DEFAULT_TENANT_KEY env var when set", () => {
    process.env.KIOSK_DEFAULT_TENANT_KEY = "another-club";
    const key = resolveKioskTenantKey();
    expect(key).toBe("another-club");
  });

  it("trims whitespace from the env var", () => {
    process.env.KIOSK_DEFAULT_TENANT_KEY = "  my-club  ";
    const key = resolveKioskTenantKey();
    expect(key).toBe("my-club");
  });

  it("falls back to DEFAULT_TENANT_KEY when env var is empty string", () => {
    process.env.KIOSK_DEFAULT_TENANT_KEY = "";
    const key = resolveKioskTenantKey();
    expect(key).toBe("fc-allschwil");
  });

  it("falls back to DEFAULT_TENANT_KEY when env var is whitespace only", () => {
    process.env.KIOSK_DEFAULT_TENANT_KEY = "   ";
    const key = resolveKioskTenantKey();
    expect(key).toBe("fc-allschwil");
  });
});
