# SportClubEvo Technical Debt Register

> **Document type:** Technical debt register — living document  
> **Status:** Active  
> **Last updated:** 2026-06-25  
> **Maintained by:** SportClubEvo engineering team

---

## Purpose

This register tracks known technical debt items — shortcuts, incomplete implementations, missing patterns, and decisions that were deferred. Every item here represents a risk or quality gap that must be resolved before, or shortly after, the v1.0 go-live.

Items are not a source of shame. They are a sign of deliberate, tracked decision-making.

---

## Debt Register

| Status | Area | Item | Priority | Impact | Notes |
|---|---|---|---|---|---|
| Open | Auth & Middleware | Auth route protection is enforced in `(admin)/layout.tsx`, not in `middleware.ts` | High | Security gap — non-HTML requests (e.g. direct API fetch to admin routes) may bypass layout-level auth | Should be resolved before go-live; evaluate whether `middleware.ts` protection is needed for all routes or only non-RSC paths |
| Open | Organisation Builder | Phase 2 org-based permissions not yet wired | Medium | `ActorContext.orgUnitIds` is populated but permission guards do not yet enforce org-unit membership for route access. `visibleOrgUnitRefs` checks in `canSeeEntity()` are implemented but guards rely only on `permissionKeys`. See `TODO(Phase 2)` in `/dashboard/org-units/page.tsx` and `lib/org/queries.ts`. Resolve in Step 2: Organization-based Permissions. |
| Open | Tenant Isolation | Public API routes have known TODO comments for missing tenant filtering | Critical | A public API call without tenant context could leak cross-tenant data | Known in `app/api/public/events/route.ts` and related files; must be audited and fixed before go-live |
| Open | Documentation | `README.md` at repository root is still the default Next.js boilerplate | Low | Poor first impression for new contributors; no project-specific onboarding | Replace with a SportClubEvo-specific README covering stack, setup, branch conventions, and docs index |
| Open | Website Integration | Website cache/revalidation mechanism is undecided | High | Without a clear cache invalidation strategy, the public website may serve stale content after publish/unpublish | Choose between ISR tag-based revalidation and on-demand webhook; document in an ADR |
| Open | Mobile Backend | Mobile auth token strategy is undecided | High | NextAuth cookie-based sessions are unsuitable for native mobile clients; a separate token flow (JWT + refresh) is needed | Decide before Epic 4 begins; document in an ADR |
| Open | InfoBoard | Weather provider is undecided | Medium | InfoBoard weather tile cannot be implemented until a provider is chosen | Candidates: OpenWeatherMap, MeteoSwiss, Open-Meteo; decision needed before Phase 5 |
| Open | Mobile App | Push notification provider is undecided | High | Cannot implement push infrastructure until provider is chosen | Candidates: Firebase FCM, Apple APNs direct, OneSignal, Expo Push; decision needed before Epic 4 |
| Open | Mobile App | Mobile cross-platform framework is undecided | High | Architectural choice affects Epic 4 API design and Epic 5 delivery | Candidates: React Native (bare), Expo; decision needed before Epic 4 begins |
| Open | API Consistency | Some API routes do not follow the `/api/public/v1/` versioning pattern | Medium | External consumers (website, InfoBoard) depend on stable URLs; unversioned routes are a breaking-change risk | Audit all external-facing routes; migrate unversioned ones to `/v1/` before go-live |
| Open | Security | No `middleware.ts` exists | Medium | Middleware is the standard Next.js mechanism for request-level auth and redirect logic; absence means all auth is layout-level only | Consider whether middleware is needed for edge-level protection or if layout auth is sufficient |
| Open | Frontend | `proxy.ts` is a no-op stub | Low | Dead code with no functionality | Remove or implement; document purpose if retained |
| Open | Testing | No automated test suite | High | Without tests, regressions are caught only by manual testing | Add at minimum integration tests for critical API routes (auth, tenant isolation, public feeds) before go-live |
| Open | Monitoring | No structured uptime monitoring or alerting configured | High | Production incidents will be discovered by users, not by the team | Configure uptime monitoring (e.g. Vercel Analytics, Better Uptime, or similar) before go-live |
| Open | Logging | Structured logging strategy not documented | Medium | `AuditLog` covers business mutations but application-level error logging and tracing are undefined | Define and implement structured error logging before go-live |
| Open | Database | `SHADOW_DATABASE_URL` use in migrations is optional but undocumented | Low | If shadow database is not configured, some migration operations may behave differently | Document whether shadow database is required for the production migration strategy |

---

## Debt Backlog (Lower Priority / Post-v1)

| Status | Area | Item | Priority | Notes |
|---|---|---|---|---|
| Open | UX Consistency | German UI labels used throughout admin navigation | Low | Acceptable for FC Allschwil (German-speaking); becomes a problem when i18n is introduced post-v1 |
| Open | Documentation | No per-module API documentation | Low | Public API contract exists for website feeds; no documentation for internal API routes |
| Open | Frontend | No Storybook or component catalogue | Low | Makes it harder for new contributors to discover reusable components |
| Open | Database | No query performance review | Low | 41 migrations; no index analysis or slow-query review done yet |

---

## Resolved Debt

| Resolved | Area | Item | Resolution |
|---|---|---|---|
| 2026-06-25 | Deployment | No deployment documentation | Created `docs/deployment/` with Vercel project matrix, env entry sheets, runtime diagnostics, and runtime guards |
| 2026-06-25 | Governance | No four-eye governance documentation | Created `docs/governance/four-eye-principle-events-foundation.md` |
| 2026-06-25 | Planning | No product planning document | Created `docs/roadmap/` documentation set |

---

## How to Use This Register

1. When you discover a debt item during development, add it to the register immediately.
2. Assign a Priority: **Critical** (blocks go-live), **High** (must resolve before go-live), **Medium** (should resolve before go-live), **Low** (post-v1 acceptable).
3. When a debt item is resolved, move it to the Resolved table with the resolution date and a brief note.
4. Review the register at the start of every planning session.
