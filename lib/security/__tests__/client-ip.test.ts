import { describe, it, expect } from "vitest";
import { getClientIp, UNKNOWN_CLIENT_IP } from "../client-ip";

function makeRequest(headers: Record<string, string>): Pick<NextRequest, "headers"> {
  return {
    headers: {
      get(name: string) {
        const key = Object.keys(headers).find((h) => h.toLowerCase() === name.toLowerCase());
        return key ? headers[key] : null;
      },
    },
  } as Pick<NextRequest, "headers">;
}

describe("getClientIp", () => {
  it("uses the first x-forwarded-for hop", () => {
    const ip = getClientIp(
      makeRequest({ "x-forwarded-for": "203.0.113.10, 10.0.0.1, 172.16.0.1" }),
    );
    expect(ip).toBe("203.0.113.10");
  });

  it("trims whitespace from x-forwarded-for", () => {
    const ip = getClientIp(makeRequest({ "x-forwarded-for": " 198.51.100.4 , 10.0.0.2" }));
    expect(ip).toBe("198.51.100.4");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const ip = getClientIp(makeRequest({ "x-real-ip": "192.0.2.44" }));
    expect(ip).toBe("192.0.2.44");
  });

  it("prefers x-forwarded-for over x-real-ip", () => {
    const ip = getClientIp(
      makeRequest({
        "x-forwarded-for": "203.0.113.1",
        "x-real-ip": "192.0.2.1",
      }),
    );
    expect(ip).toBe("203.0.113.1");
  });

  it("returns stable fallback when no trusted headers exist", () => {
    expect(getClientIp(makeRequest({}))).toBe(UNKNOWN_CLIENT_IP);
  });
});
