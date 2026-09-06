import type {
  SmokeHttpClient,
  SmokeHttpResponse,
} from "@/lib/acceptance/security-smoke/types";

type FetchLike = typeof fetch;

const AUTH_RETURN_REDIRECT_HEADER = "X-Auth-Return-Redirect";

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
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] })
    .getSetCookie;
  if (typeof getSetCookie === "function") {
    return getSetCookie.call(headers);
  }

  const values: string[] = [];
  headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      values.push(value);
    }
  });
  return values;
}

function isAuthSessionCookieName(name: string): boolean {
  return /^(?:__Secure-|__Host-)?authjs\.session-token(?:\.\d+)?$/.test(name);
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
    hasAuthSessionCookie(): boolean {
      for (const name of cookies.keys()) {
        if (isAuthSessionCookieName(name)) {
          return true;
        }
      }
      return false;
    },
    headerValue(): string {
      return Array.from(cookies.entries())
        .map(([name, value]) => `${name}=${value}`)
        .join("; ");
    },
  };
}

function readSessionEmail(session: Record<string, unknown> | null): string | null {
  const user = session?.user;
  if (!user || typeof user !== "object") return null;
  const email = (user as Record<string, unknown>).email;
  return typeof email === "string" ? email.trim().toLowerCase() : null;
}

async function request(
  fetchImpl: FetchLike,
  baseUrl: string,
  jar: ReturnType<typeof createCookieJar>,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<SmokeHttpResponse> {
  const url = new URL(path, `${baseUrl}/`).toString();
  const headers = new Headers();
  const cookieHeader = jar.headerValue();
  if (cookieHeader) {
    headers.set("cookie", cookieHeader);
  }
  if (extraHeaders) {
    for (const [name, value] of Object.entries(extraHeaders)) {
      headers.set(name, value);
    }
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

function parseCredentialsSignInResult(
  response: SmokeHttpResponse,
  baseUrl: string,
): { ok: true } | { ok: false; message: string } {
  if (response.status === 429) {
    return {
      ok: false,
      message: "Credentials login failed with HTTP 429.",
    };
  }

  if (response.status >= 400) {
    return {
      ok: false,
      message: `Credentials login failed with HTTP ${response.status}.`,
    };
  }

  const payload = response.json() as { url?: string } | null;
  const redirectUrl = payload?.url;
  if (typeof redirectUrl === "string" && redirectUrl.length > 0) {
    const parsed = new URL(redirectUrl, `${baseUrl}/`);
    const error = parsed.searchParams.get("error");
    if (error) {
      const code = parsed.searchParams.get("code");
      if (error === "CredentialsSignin" || code === "credentials") {
        return {
          ok: false,
          message: "Credentials login failed: invalid email or password.",
        };
      }
      return {
        ok: false,
        message: `Credentials login failed with auth error ${error}.`,
      };
    }
    return { ok: true };
  }

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (location) {
      const parsed = new URL(location, `${baseUrl}/`);
      const error = parsed.searchParams.get("error");
      if (error) {
        return {
          ok: false,
          message: "Credentials login failed: invalid email or password.",
        };
      }
    }
    return { ok: true };
  }

  return {
    ok: false,
    message: "Credentials login failed: Auth.js did not return a redirect URL.",
  };
}

function normalizeSmokeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function createSmokeSessionCacheClient(
  baseUrl: string,
  fetchImpl: FetchLike = fetch,
): SmokeHttpClient {
  const anonymousClient = createSmokeHttpClient(baseUrl, fetchImpl);
  const clientsByEmail = new Map<string, SmokeHttpClient>();
  let activeClient: SmokeHttpClient = anonymousClient;

  return {
    clearCookies() {
      anonymousClient.clearCookies();
      activeClient = anonymousClient;
    },
    async loginWithCredentials(email: string, password: string) {
      const normalizedEmail = normalizeSmokeEmail(email);
      let client = clientsByEmail.get(normalizedEmail);
      if (!client) {
        client = createSmokeHttpClient(baseUrl, fetchImpl);
        clientsByEmail.set(normalizedEmail, client);
        await client.loginWithCredentials(email, password);
      } else {
        await client.loginWithCredentials(email, password);
      }
      activeClient = client;
    },
    async get(path: string) {
      return activeClient.get(path);
    },
    async post(path: string, body?: unknown) {
      return activeClient.post(path, body);
    },
    async getSession() {
      return activeClient.getSession();
    },
  };
}

export function createSmokeHttpClient(
  baseUrl: string,
  fetchImpl: FetchLike = fetch,
): SmokeHttpClient {
  const jar = createCookieJar();
  const callbackUrl = new URL("/dashboard", `${baseUrl}/`).toString();

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
      const normalizedEmail = normalizeSmokeEmail(email);
      const existingSession = await this.getSession();
      const existingEmail = readSessionEmail(existingSession);
      if (existingEmail === normalizedEmail) {
        return;
      }

      jar.clear();
      const csrfResponse = await request(fetchImpl, baseUrl, jar, "GET", "/api/auth/csrf");
      if (csrfResponse.status === 429) {
        throw new Error("Credentials login failed: CSRF request returned HTTP 429.");
      }
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
          email: normalizedEmail,
          password,
          callbackUrl,
        }),
        { [AUTH_RETURN_REDIRECT_HEADER]: "1" },
      );

      const signInResult = parseCredentialsSignInResult(signInResponse, baseUrl);
      if (!signInResult.ok) {
        throw new Error(signInResult.message);
      }

      if (!jar.hasAuthSessionCookie()) {
        throw new Error(
          "Credentials login failed: Auth.js did not return a session cookie.",
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
