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

function loggedReport(): Record<string, unknown> {
  const serialized = vi.mocked(console.warn).mock.calls[0]?.[1];
  return JSON.parse(String(serialized)) as Record<string, unknown>;
}

describe("CSP report endpoint", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it("strips document-uri query strings", async () => {
    await POST(
      cspRequest(
        JSON.stringify({
          "csp-report": {
            "effective-directive": "script-src",
            "document-uri":
              "https://sce.example/reset-password?token=reset-secret",
          },
        }),
      ),
    );

    expect(loggedReport()["document-uri"]).toBe(
      "https://sce.example/reset-password",
    );
    expect(JSON.stringify(loggedReport())).not.toContain("reset-secret");
  });

  it("strips document-uri fragments", async () => {
    await POST(
      cspRequest(
        JSON.stringify({
          "csp-report": {
            "effective-directive": "style-src",
            "document-uri":
              "https://sce.example/reset-password#token=fragment-secret",
          },
        }),
      ),
    );

    expect(loggedReport()["document-uri"]).toBe(
      "https://sce.example/reset-password",
    );
    expect(JSON.stringify(loggedReport())).not.toContain("fragment-secret");
  });

  it("never logs reset or invitation bearer tokens", async () => {
    const tokens = ["reset-token-value", "invitation-token-value"];

    for (const token of tokens) {
      await POST(
        cspRequest(
          JSON.stringify({
            "csp-report": {
              "effective-directive": "script-src",
              "document-uri": `https://sce.example/reset-password?token=${token}`,
            },
          }),
        ),
      );
    }

    const output = JSON.stringify(vi.mocked(console.warn).mock.calls);
    expect(output).not.toContain("reset-token-value");
    expect(output).not.toContain("invitation-token-value");
  });

  it("sanitizes every allowlisted URL-bearing CSP field", async () => {
    await POST(
      cspRequest(
        JSON.stringify({
          "csp-report": {
            "effective-directive": "script-src",
            "document-uri": "https://user:pass@sce.example/page?doc=secret#doc",
            "blocked-uri": "https://cdn.example/script.js?blocked=secret#blocked",
            "source-file": "https://sce.example/app.js?source=secret#source",
          },
        }),
      ),
    );

    expect(loggedReport()).toMatchObject({
      "document-uri": "https://sce.example/page",
      "blocked-uri": "https://cdn.example/script.js",
      "source-file": "https://sce.example/app.js",
    });
    const output = JSON.stringify(loggedReport());
    expect(output).not.toMatch(/user|pass|secret|#doc|#blocked|#source/);
  });

  it("replaces malformed URLs without logging their raw token-bearing input", async () => {
    await POST(
      cspRequest(
        JSON.stringify({
          "csp-report": {
            "effective-directive": "script-src",
            "document-uri":
              "https://[malformed.example/reset-password?token=raw-secret",
          },
        }),
      ),
    );

    expect(loggedReport()["document-uri"]).toBe("[invalid-url]");
    expect(JSON.stringify(loggedReport())).not.toContain("raw-secret");
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

  it("retains the process-local limit of 20 logs per minute", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2100-01-01T00:00:00.000Z"));

    for (let index = 0; index < 21; index += 1) {
      const response = await POST(
        cspRequest(
          JSON.stringify({
            "csp-report": {
              "effective-directive": "script-src",
              "document-uri": `https://sce.example/page/${index}`,
            },
          }),
        ),
      );
      expect(response.status).toBe(204);
    }

    expect(console.warn).toHaveBeenCalledTimes(20);
  });
});
