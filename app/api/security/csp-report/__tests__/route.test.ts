import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/security/csp-report/route";

const { databaseModuleFactory } = vi.hoisted(() => ({
  databaseModuleFactory: vi.fn(() => ({
    prisma: {
      $queryRaw: vi.fn(),
      $executeRaw: vi.fn(),
    },
  })),
}));

vi.mock("@/lib/db", databaseModuleFactory);

function cspRequest(body: BodyInit, headers: HeadersInit = {}) {
  return new Request("https://sce.example/api/security/csp-report", {
    method: "POST",
    headers: {
      "Content-Type": "application/csp-report",
      ...headers,
    },
    body,
  });
}

describe("CSP report endpoint", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts a valid CSP violation without exposing its contents", async () => {
    const response = await POST(
      cspRequest(
        JSON.stringify({
          "csp-report": {
            "document-uri": "https://sce.example/dashboard",
            "effective-directive": "script-src-elem",
            "violated-directive": "script-src-elem",
            "blocked-uri": "inline",
            "status-code": 200,
          },
        }),
      ),
    );

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(databaseModuleFactory).not.toHaveBeenCalled();
  });

  it("rejects malformed and non-CSP JSON without logging", async () => {
    const malformedResponse = await POST(cspRequest("{not-json"));
    const unrelatedResponse = await POST(
      cspRequest(JSON.stringify({ event: "arbitrary-log-message" })),
    );

    expect(malformedResponse.status).toBe(400);
    expect(unrelatedResponse.status).toBe(400);
    expect(await malformedResponse.text()).toBe("");
    expect(await unrelatedResponse.text()).toBe("");
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("rejects unsupported content without reading or logging it", async () => {
    const response = await POST(
      new Request("https://sce.example/api/security/csp-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          "csp-report": { "effective-directive": "script-src" },
        }),
      }),
    );

    expect(response.status).toBe(415);
    expect(await response.text()).toBe("");
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("rejects declared and streamed bodies larger than 16 KiB", async () => {
    const declaredOversizedResponse = await POST(
      cspRequest("{}", { "Content-Length": "16385" }),
    );
    const streamedOversizedResponse = await POST(cspRequest("x".repeat(16385)));

    expect(declaredOversizedResponse.status).toBe(413);
    expect(streamedOversizedResponse.status).toBe(413);
    expect(await declaredOversizedResponse.text()).toBe("");
    expect(await streamedOversizedResponse.text()).toBe("");
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("escapes control characters and omits unrecognized report fields", async () => {
    const response = await POST(
      cspRequest(
        JSON.stringify({
          "csp-report": {
            "effective-directive": "script-src\nforged-log-line",
            "blocked-uri": "https://example.invalid/\r\ninjected",
            arbitrary: "must-not-be-logged",
          },
        }),
      ),
    );

    expect(response.status).toBe(204);
    const serializedLog = String(
      vi.mocked(console.warn).mock.calls[0]?.[1],
    );
    expect(serializedLog).not.toContain("\n");
    expect(serializedLog).not.toContain("\r");
    expect(serializedLog).not.toContain("arbitrary");
    expect(serializedLog).not.toContain("must-not-be-logged");
  });
});
