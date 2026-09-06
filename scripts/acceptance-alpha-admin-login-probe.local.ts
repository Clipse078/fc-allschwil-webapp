import { execSync } from "node:child_process";
import { ACCEPTANCE_FIXTURE } from "@/lib/acceptance/bootstrap";
import { createCookieJar } from "@/lib/acceptance/security-smoke/http-client";

const EXPECTED_HEAD = "a29e8197256cfd0997a9e3a41f52add5e18f3471";
const BASE = "https://acceptance.sportclubevo.com";

const cookieNames = (h: Headers) => {
  const g = (h as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  const rows =
    typeof g === "function"
      ? g.call(h)
      : (() => {
          const found: string[] = [];
          h.forEach((v, k) => {
            if (k.toLowerCase() === "set-cookie") found.push(v);
          });
          return found;
        })();
  return rows
    .map((r) => r.split(";")[0].split("=")[0].trim())
    .filter(Boolean);
};
const safeUrl = (raw: string | null) => {
  if (!raw) return "(none)";
  try {
    const u = new URL(raw, `${BASE}/`);
    const q = new URLSearchParams();
    for (const k of ["error", "code"]) if (u.searchParams.get(k)) q.set(k, u.searchParams.get(k)!);
    const s = q.toString();
    return s ? `${u.origin}${u.pathname}?${s}` : `${u.origin}${u.pathname}`;
  } catch {
    return "(unparseable)";
  }
};
const sessionEmail = (s: Record<string, unknown> | null) => {
  const u = s?.user;
  return u && typeof u === "object" && typeof (u as Record<string, unknown>).email === "string"
    ? String((u as Record<string, unknown>).email).trim().toLowerCase()
    : null;
};
const isSessionCookie = (n: string) => /^(?:__Secure-|__Host-)?authjs\.session-token(?:\.\d+)?$/.test(n);

async function req(
  jar: ReturnType<typeof createCookieJar>,
  method: "GET" | "POST",
  path: string,
  body?: URLSearchParams,
  extra?: Record<string, string>,
) {
  const headers = new Headers();
  const c = jar.headerValue();
  if (c) headers.set("cookie", c);
  if (extra) for (const [k, v] of Object.entries(extra)) headers.set(k, v);
  if (method === "POST" && body) headers.set("content-type", "application/x-www-form-urlencoded");
  const res = await fetch(new URL(path, `${BASE}/`), {
    method,
    headers,
    body: method === "POST" ? body?.toString() : undefined,
    redirect: "manual",
  });
  jar.ingest(res.headers);
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, headers: res.headers, json };
}

async function main() {
  const head = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  console.log(`CURRENT HEAD: ${head}`);
  if (head !== EXPECTED_HEAD) console.log(`EXPECTED HEAD: ${EXPECTED_HEAD}`);

  const password = process.env.ACCEPTANCE_ALPHA_ADMIN_PASSWORD?.trim() ?? "";
  if (password.length < 12) {
    console.error("ACCEPTANCE_ALPHA_ADMIN_PASSWORD is missing or shorter than 12 characters.");
    process.exit(1);
  }

  const email = ACCEPTANCE_FIXTURE.users.alphaAdmin.email;
  const jar = createCookieJar();
  const seen = new Set<string>();

  const csrf = await req(jar, "GET", "/api/auth/csrf");
  for (const n of cookieNames(csrf.headers)) seen.add(n);
  const csrfToken = (csrf.json as { csrfToken?: string } | null)?.csrfToken;
  console.log("\nCSRF:\n- HTTP status: " + csrf.status);
  console.log("- token present: " + (csrfToken ? "YES" : "NO"));
  console.log("- Set-Cookie names: " + (cookieNames(csrf.headers).join(", ") || "(none)"));

  const cb = await req(
    jar,
    "POST",
    "/api/auth/callback/credentials",
    new URLSearchParams({
      csrfToken: csrfToken ?? "",
      email,
      password,
      callbackUrl: new URL("/dashboard", `${BASE}/`).toString(),
    }),
    { "X-Auth-Return-Redirect": "1" },
  );
  for (const n of cookieNames(cb.headers)) seen.add(n);
  const redirect =
    typeof (cb.json as { url?: string } | null)?.url === "string"
      ? (cb.json as { url: string }).url
      : cb.headers.get("location");

  console.log("\nCREDENTIAL CALLBACK:\n- HTTP status: " + cb.status);
  console.log("- content type: " + (cb.headers.get("content-type") ?? "(none)"));
  console.log("- sanitized redirect URL: " + safeUrl(redirect));
  console.log("- Set-Cookie names: " + (cookieNames(cb.headers).join(", ") || "(none)"));

  console.log("\nCOOKIE JAR:\n- cookie names: " + ([...seen].sort().join(", ") || "(none)"));
  console.log("- session cookie detected: " + (jar.hasAuthSessionCookie() ? "YES" : "NO"));

  const sess = await req(jar, "GET", "/api/auth/session");
  for (const n of cookieNames(sess.headers)) seen.add(n);
  const session =
    sess.status < 400 && sess.json && typeof sess.json === "object"
      ? (sess.json as Record<string, unknown>)
      : null;
  const authEmail = sessionEmail(session);

  console.log("\nAUTH SESSION:\n- HTTP status: " + sess.status);
  console.log("- authenticated: " + (authEmail ? "YES" : "NO"));
  console.log("- authenticated email: " + (authEmail ?? "(none)"));

  let classification = "other";
  const r = redirect ?? "";
  if (r.includes("error=CredentialsSignin") || r.includes("code=credentials")) classification = "CredentialsSignin";
  else if (![...seen].some(isSessionCookie)) classification = "session cookie missing";
  else if (authEmail) classification = "authenticated successfully";
  else if (sess.status >= 400) classification = `session cookie captured but session null (HTTP ${sess.status})`;
  else classification = "session cookie captured but session null";

  console.log("\nCLASSIFICATION:\n- " + classification);
}

main().catch((e) => {
  console.error("PROBE FAILED: " + (e instanceof Error ? e.message : String(e)));
  process.exit(1);
});
