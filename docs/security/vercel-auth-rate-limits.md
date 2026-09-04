# Vercel WAF — Authentication & Identity Rate Limits

This document is the **checked-in configuration contract** for SportClubEvo's
primary distributed abuse protection on authentication and identity-related
endpoints. Michael must create these rules manually in the Vercel project —
this repository does **not** mutate Vercel settings automatically.

## Architecture

| Layer | Responsibility |
|-------|----------------|
| **Vercel WAF** (edge) | Coarse distributed burst protection by IP |
| **Application policy** (`lib/security/abuse-policy.ts`) | Generic responses, cooldowns, best-effort in-process limits |
| **Authorization** | Existing permission checks (`users.invite`, session gates, etc.) |

Canonical application constants mirror these thresholds in
`WAF_AUTH_RATE_LIMITS` inside `lib/security/abuse-policy.ts`.

---

## Rule 1 — Authentication burst protection

| Field | Value |
|-------|-------|
| **Path pattern** | `/api/auth/*` |
| **Auth.js credentials POST** | `/api/auth/callback/credentials` (included by wildcard) |
| **HTTP method** | `POST` |
| **Counting key** | IP |
| **Threshold** | 10 requests / minute / IP |
| **Action** | Rate limit (429) |
| **Rationale** | Credential stuffing and brute-force burst protection |

Application defense-in-depth: `checkApplicationRateLimit("login", ip)` in
`app/api/auth/[...nextauth]/route.ts` (10 / minute, best-effort).

---

## Rule 2 — Password reset request

| Field | Value |
|-------|-------|
| **Path** | `/api/auth/forgot-password` |
| **HTTP method** | `POST` |
| **Counting key** | IP |
| **Threshold** | 5 requests / 10 minutes / IP |
| **Action** | Rate limit (429) |
| **Rationale** | Reset-email abuse protection |

Application defense-in-depth: 5 / 15 minutes in-process (`forgotPassword` surface).
The application returns a **generic 429** with `Retry-After` that does not reveal
whether an account exists.

---

## Rule 3 — Reset / invitation token submission

| Field | Value |
|-------|-------|
| **Paths** | `/api/auth/reset-password`, `/api/auth/invitation/accept` |
| **HTTP method** | `POST` |
| **Counting key** | IP |
| **Threshold** | 10 requests / 10 minutes / IP |
| **Action** | Rate limit (429) |
| **Rationale** | Token guessing and automated submission protection |

Application defense-in-depth: 10 / 10 minutes per surface.

---

## Rule 4 — Public registrations

| Field | Value |
|-------|-------|
| **Path pattern** | `/api/public/*/registrations` |
| **HTTP method** | `POST` |
| **Counting key** | IP |
| **Threshold** | 10 requests / minute / IP |
| **Action** | Rate limit (429) |
| **Rationale** | High-volume automated registration spam |

Application defense-in-depth: 5 / minute in-process (stricter than WAF).

---

## Rule 5 — Admin invite resend

| Field | Value |
|-------|-------|
| **Path pattern** | `/api/admin/users/*/invite` |
| **HTTP method** | `POST` |
| **Counting key** | IP |
| **Threshold** | 20 requests / 10 minutes / IP |
| **Action** | Rate limit (429) |
| **Rationale** | Requires authenticated `users.invite`; looser edge threshold |

Application protection (stronger): **60-second cooldown** per tenant + target user
using existing `PasswordResetToken.createdAt` — no schema change.

---

## Michael's Vercel checklist

For each rule below, in **Vercel project → Firewall → Configure → New Rule**:

- [ ] **Rule 1** — Path `/api/auth/*`, Method `POST`, Key `IP`, 10 req / 1 min, Action: Rate limit
- [ ] **Rule 2** — Path `/api/auth/forgot-password`, Method `POST`, Key `IP`, 5 req / 10 min, Action: Rate limit
- [ ] **Rule 3** — Paths `/api/auth/reset-password` and `/api/auth/invitation/accept`, Method `POST`, Key `IP`, 10 req / 10 min, Action: Rate limit
- [ ] **Rule 4** — Path `/api/public/*/registrations`, Method `POST`, Key `IP`, 10 req / 1 min, Action: Rate limit
- [ ] **Rule 5** — Path `/api/admin/users/*/invite`, Method `POST`, Key `IP`, 20 req / 10 min, Action: Rate limit

Apply to **Preview**, **STAGE**, and **Production** unless a environment-specific
exception is documented below.

### Environment guidance

| Environment | Guidance |
|-------------|----------|
| **Preview** | Enable all rules; use for PR validation |
| **STAGE** | Enable all rules before external user pilot |
| **Production** | Enable all rules at go-live |

---

## Expected 429 behavior

When WAF or application policy rate-limits a request:

- **Status:** `429 Too Many Requests`
- **Header:** `Retry-After: <seconds>` (integer, ≥ 1)
- **Body:** Generic error — no emails, user IDs, tenant IDs, IP addresses, or internal rule names

Example application response:

```json
{ "error": "Zu viele Anfragen. Bitte versuche es später erneut." }
```

Public registration responses use `{ "ok": false, "error": "..." }` with the same
semantics.

Forgot-password **success path** remains opaque `200` when within limits.

---

## Testing instructions

### 1. WAF rules (after manual Vercel configuration)

From a single IP, send rapid `POST` requests to each protected path and confirm
`429` after the configured threshold. Verify `Retry-After` is present.

```bash
# Example (replace host and body as needed)
for i in $(seq 1 12); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST https://stage.sportclubevo.app/api/auth/forgot-password \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com"}'
done
```

### 2. Application-layer limits (local / preview without WAF)

Run focused tests:

```bash
npx vitest run lib/security/__tests__
npx vitest run lib/auth/__tests__/password-reset.test.ts
npx vitest run app/api/admin/users/\[userId\]/invite/__tests__/route.test.ts
```

### 3. Enumeration checks

- Login: invalid email and wrong password both return the same client message.
- Forgot-password: unknown email returns same `200` opaque success as known email.
- Reset / invitation: invalid tokens return generic errors without token details in logs.

---

## Rollback instructions

1. In **Vercel → Firewall**, disable or delete the five rules above.
2. Application-layer protections remain active (defense-in-depth) — they are
   best-effort only and safe to leave in place.
3. If application 429 responses cause issues, revert the deployment branch;
   do not disable bcrypt, opaque forgot-password, or authorization checks.

---

## What this does NOT cover

- No Redis / Upstash / Vercel KV — distributed state is WAF-only for this slice.
- No changes to `it@fcallschwil.ch` credentials.
- No database migrations or schema changes.
- Authenticated read endpoints are intentionally **not** rate-limited.
