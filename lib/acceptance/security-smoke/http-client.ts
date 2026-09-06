import type {
  SmokeHttpClient,
  SmokeHttpResponse,
} from "@/lib/acceptance/security-smoke/types";

type FetchLike = typeof fetch;

function parseSetCookieHeader(setCookie: string): { name: string; value: string } | null {
  const [pair] = setCookie.split(";");
  const separator = pair.indexOf("=");
  if (separator <= 0) return null;
  const name = pair.slice(0, separator).trim();
  const value = pair.slice(separator + 1).trim();
  if (!name) return null;
  return { name, value };
}

function collectSetCookieHeaders(headers: Headers): string[] {
  const values: string[] = [];
  headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      values.push(value);
    }
  });
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] })
    .getSetCookie;
  if (typeof getSetCookie === "function") {
    return getSetCookie.call(headers);
  }
  return values;
}

export function createCookieJar() {
  const cookies = new Map<string, string>();

  return {
    ingest(headers: Headers) {
      for (const setCookie of collectSetCookieHeaders(headers)) {
        const parsed = parseSetCookieHeader(setCookie);
        if (!parsed) continue;
        if (parsed.value === "" || setCookie.toLowerCase().includes("max-age=0")) {
          cookies.delete(parsed.name);
          continue;
        }
        cookies.set(parsed.name, parsed.value);
      }
    },
    clear() {
      cookies.clear();
    },
    headerValue(): string {
      return Array.from(cookies.entries())
        .map(([name, value]) => `${name}=${value}`)
        .join("; ");
    },
  };
}

async function request(
  fetchImpl: FetchLike,
  baseUrl: string,
  jar: ReturnType<typeof createCookieJar>,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<SmokeHttpResponse> {
  const url = new URL(path, `${baseUrl}/`).toString();
  const headers = new Headers();
  const cookieHeader = jar.headerValue();
  if (cookieHeader) {
    headers.set("cookie", cookieHeader);
  }

  const init: RequestInit = { method, headers, redirect: "manual" };
  if (method === "POST") {
    if (body === undefined) {
      headers.set("content-type", "application/json");
      init.body = "{}";
    } else if (body instanceof URLSearchParams) {
      headers.set("content-type", "application/x-www-form-urlencoded");
      init.body = body.toString();
    } else {
      headers.set("content-type", "application/json");
      init.body = JSON.stringify(body);
    }
  }

  const response = await fetchImpl(url, init);
  jar.ingest(response.headers);
  const bodyText = await response.text();
  return {
    status: response.status,
    headers: response.headers,
    bodyText,
    json() {
      try {
        return JSON.parse(bodyText);
      } catch {
        return null;
      }
    },
  };
}

export function createSmokeHttpClient(
  baseUrl: string,
  fetchImpl: FetchLike = fetch,
): SmokeHttpClient {
  const jar = createCookieJar();

  return {
    clearCookies() {
      jar.clear();
    },
    async get(path: string) {
      return request(fetchImpl, baseUrl, jar, "GET", path);
    },
    async post(path: string, body?: unknown) {
      return request(fetchImpl, baseUrl, jar, "POST", path, body);
    },
    async loginWithCredentials(email: string, password: string) {
      jar.clear();
      const csrfResponse = await request(fetchImpl, baseUrl, jar, "GET", "/api/auth/csrf");
      const csrfPayload = csrfResponse.json() as { csrfToken?: string } | null;
      const csrfToken = csrfPayload?.csrfToken;
      if (!csrfToken) {
        throw new Error("Credentials login failed: CSRF token was not returned.");
      }

      const signInResponse = await request(
        fetchImpl,
        baseUrl,
        jar,
        "POST",
        "/api/auth/callback/credentials",
        new URLSearchParams({
          csrfToken,
          email,
          password,
          redirect: "false",
          json: "true",
        }),
      );

      if (signInResponse.status >= 400) {
        throw new Error(
          `Credentials login failed with HTTP ${signInResponse.status}.`,
        );
      }

      const session = await this.getSession();
      if (!session?.user) {
        throw new Error("Credentials login failed: authenticated session was not established.");
      }
    },
    async getSession() {
      const response = await request(fetchImpl, baseUrl, jar, "GET", "/api/auth/session");
      if (response.status >= 400) return null;
      const payload = response.json();
      if (!payload || typeof payload !== "object") return null;
      return payload as Record<string, unknown>;
    },
  };
}
