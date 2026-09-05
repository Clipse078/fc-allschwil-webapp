/**
 * SCE-CANONICAL-PUBLISHING-01 — public website cache notification tests.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    tenant: {
      findFirst: vi.fn(),
    },
  },
}));

import {
  buildPublicCacheTag,
  buildPublicCacheTags,
  PUBLIC_CACHE_DOMAINS,
} from "../public-cache-tags";
import {
  getTenantRevalidationEndpoint,
  notifyTenantPublicWebsiteCache,
  resetPublicCacheNotificationConfigForTests,
} from "../public-cache-notification";

describe("public-cache-tags", () => {
  it("builds tenant-scoped canonical tags", () => {
    expect(buildPublicCacheTag("fc-allschwil", PUBLIC_CACHE_DOMAINS.WEEKPLAN)).toBe(
      "sce:fc-allschwil:weekplan",
    );
    expect(
      buildPublicCacheTags("fc-allschwil", [
        PUBLIC_CACHE_DOMAINS.WEEKPLAN,
        PUBLIC_CACHE_DOMAINS.TOURNAMENTS,
      ]),
    ).toEqual(["sce:fc-allschwil:weekplan", "sce:fc-allschwil:tournaments"]);
  });
});

describe("public-cache-notification", () => {
  const originalConfig = process.env.PUBLIC_WEBSITE_REVALIDATION_CONFIG;
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    resetPublicCacheNotificationConfigForTests();
    process.env.PUBLIC_WEBSITE_REVALIDATION_CONFIG = JSON.stringify({
      "fc-allschwil": {
        url: "https://www.fcallschwil.ch/api/revalidate",
        secret: "test-secret",
      },
    });
  });

  afterEach(() => {
    process.env.PUBLIC_WEBSITE_REVALIDATION_CONFIG = originalConfig;
    delete process.env.VERCEL_TARGET_ENV;
    delete process.env.ACCEPTANCE_ENABLED_EXTERNAL_PROVIDERS;
    resetPublicCacheNotificationConfigForTests();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("returns configured endpoint for tenant slug", () => {
    expect(getTenantRevalidationEndpoint("fc-allschwil")).toEqual({
      url: "https://www.fcallschwil.ch/api/revalidate",
      secret: "test-secret",
    });
    expect(getTenantRevalidationEndpoint("unknown")).toBeNull();
  });

  it("posts signed revalidation payload for configured tenant", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    await notifyTenantPublicWebsiteCache({
      tenantSlug: "fc-allschwil",
      domains: [PUBLIC_CACHE_DOMAINS.WEEKPLAN],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [
      string,
      { method: string; headers: Record<string, string>; body: string },
    ];

    expect(url).toBe("https://www.fcallschwil.ch/api/revalidate");
    expect(options.method).toBe("POST");

    const payload = JSON.parse(options.body);
    expect(payload).toEqual({
      tenant: "fc-allschwil",
      domains: ["weekplan"],
      tags: ["sce:fc-allschwil:weekplan"],
    });

    expect(options.headers["X-SCE-Revalidation-Signature"]).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it("does not throw when fetch fails", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    await expect(
      notifyTenantPublicWebsiteCache({
        tenantSlug: "fc-allschwil",
        domains: [PUBLIC_CACHE_DOMAINS.WEEKPLAN],
      }),
    ).resolves.toBeUndefined();
  });

  it("skips notification when tenant is not configured", async () => {
    await notifyTenantPublicWebsiteCache({
      tenantSlug: "other-club",
      domains: [PUBLIC_CACHE_DOMAINS.WEEKPLAN],
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("cannot emit an unsigned notification when HMAC config is missing", async () => {
    delete process.env.PUBLIC_WEBSITE_REVALIDATION_CONFIG;
    resetPublicCacheNotificationConfigForTests();

    await notifyTenantPublicWebsiteCache({
      tenantSlug: "fc-allschwil",
      domains: [PUBLIC_CACHE_DOMAINS.WEEKPLAN],
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not revalidate from Acceptance when copied config is not explicitly enabled", async () => {
    process.env.VERCEL_TARGET_ENV = "acceptance";
    resetPublicCacheNotificationConfigForTests();

    await notifyTenantPublicWebsiteCache({
      tenantSlug: "fc-allschwil",
      domains: [PUBLIC_CACHE_DOMAINS.WEEKPLAN],
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not log malformed configuration source or secret fragments", () => {
    const secretFragment = "hmac-secret-must-not-be-logged";
    process.env.PUBLIC_WEBSITE_REVALIDATION_CONFIG =
      `{"tenant":{"secret":"${secretFragment}"`;
    resetPublicCacheNotificationConfigForTests();
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(getTenantRevalidationEndpoint("tenant")).toBeNull();
    expect(error).toHaveBeenCalledWith(
      "[public-cache-notification] Invalid PUBLIC_WEBSITE_REVALIDATION_CONFIG JSON",
    );
    expect(JSON.stringify(error.mock.calls)).not.toContain(secretFragment);
    expect(JSON.stringify(error.mock.calls)).not.toContain(
      process.env.PUBLIC_WEBSITE_REVALIDATION_CONFIG,
    );
  });
});
