# SportClubEvo v1.0 Go-Live Readiness Checklist

> **Document type:** Go-live readiness checklist  
> **Status:** Active — check items off as they are verified in production  
> **Last updated:** 2026-06-25  
> **Owner:** SportClubEvo core team

---

## How to Use This Checklist

Work through each section in order before declaring v1.0 production-ready. Each item must be verified — not assumed. Assign an owner and a verification date to each completed item. Do not sign off on a section unless every item in it is checked.

---

## 1. Infrastructure

- [ ] Production environment deployed and confirmed stable on Vercel
- [ ] Custom domain configured and resolving correctly
- [ ] DNS TTLs confirmed appropriate for go-live
- [ ] SSL certificate active, valid, and set to auto-renew
- [ ] Vercel project matrix documented and current (`docs/deployment/vercel-project-matrix.md`)
- [ ] All required environment variables configured in Vercel production (not just STAGE)
- [ ] `APP_ENV` and `VERCEL_ENV` values correct in production
- [ ] `NEXTAUTH_URL` set to production URL
- [ ] `APP_BASE_URL` set to production URL
- [ ] Health endpoint (`/api/health`) returns 200 in production
- [ ] Diagnostic endpoint (`/api/health/diag`) reviewed and access-restricted in production

---

## 2. Database

- [ ] Production database provisioned and accessible
- [ ] `DATABASE_URL` configured for production
- [ ] `prisma migrate deploy` run successfully against production database
- [ ] All 41 migrations applied with no errors
- [ ] `prisma migrate status` confirms no pending migrations
- [ ] Database connection pool configured appropriately
- [ ] Database access is not publicly reachable (firewall / VPC rules)
- [ ] Production database is separate from STAGE / development databases

---

## 3. Security

- [ ] `NEXTAUTH_SECRET` is production-unique and not shared with STAGE
- [ ] All secrets rotated from development and STAGE values
- [ ] Password hashing (bcryptjs) confirmed working in production
- [ ] Impersonation restricted to platform admin roles only
- [ ] Impersonation events written to `AuditLog` and verified
- [ ] Session JWT expiry reviewed and appropriate
- [ ] No sensitive values hardcoded in application code
- [ ] Vercel environment variable audit completed — no dev-only secrets in production
- [ ] Security headers reviewed (Content-Security-Policy, X-Frame-Options, etc.)

---

## 4. Tenant Isolation

- [ ] All admin API routes verified to include `tenantId` scoping
- [ ] All public API routes reviewed for tenant filtering (known TODO items resolved — see `03-technical-debt.md`)
- [ ] `/api/public/events` confirmed to filter by tenant
- [ ] `/api/public/infoboard` confirmed to filter by tenant
- [ ] `/api/public/wochenplan` confirmed to filter by tenant
- [ ] Cross-tenant data access test performed: confirmed tenant A cannot read tenant B data
- [ ] `approvedDataOnly` flag on `Tenant` model enforced on all public content routes
- [ ] Tenant cockpit access restricted to correct tenant users

---

## 5. Auth and Permissions

- [ ] RBAC permission matrix reviewed — all modules have appropriate permission keys assigned
- [ ] All API routes have explicit permission checks (no unprotected mutations)
- [ ] Route protection confirmed: unauthenticated requests to `(admin)` routes redirect to `/login`
- [ ] Open question resolved: auth enforced via layout vs. middleware (see `03-technical-debt.md` ADR-011)
- [ ] Admin-only routes confirmed inaccessible to non-admin roles
- [ ] Role assignment UI tested — roles apply correctly to new users
- [ ] Impersonation stop flow tested end-to-end
- [ ] `lastLoginAt` update confirmed working

---

## 6. Public API

- [ ] `/api/public/v1/website/news/**` returns correct data
- [ ] `/api/public/v1/website/pages/**` returns correct data
- [ ] `/api/public/events` returns correct data, filtered by tenant
- [ ] `/api/public/infoboard` returns correct data, filtered by tenant
- [ ] `/api/public/wochenplan` returns correct data, filtered by tenant
- [ ] All public endpoints return appropriate HTTP status codes
- [ ] Rate limiting reviewed (if applicable)
- [ ] CORS headers confirmed appropriate for website and InfoBoard consumers
- [ ] Public API versioning (`/v1/`) confirmed in place
- [ ] Public API contract (`docs/public-website-feed-contract-v1.md`) is current

---

## 7. Website Integration

- [ ] Public website deployment consuming WebApp public API
- [ ] `approvedDataOnly` flag tested — unapproved content does not appear on website
- [ ] Website cache refresh triggers after publish action
- [ ] Website cache invalidation triggers after unpublish action
- [ ] ISR / on-demand revalidation mechanism decided and implemented (see `03-technical-debt.md`)
- [ ] All content types (news, teams, matches, events, sponsors, homepage blocks) verified end-to-end
- [ ] Editorial workflow tested: Draft → In Review → Scheduled → Published → Archived
- [ ] Website displays no stale or unpublished content

---

## 8. InfoBoard

- [ ] `/infoboard` route accessible and rendering correctly
- [ ] Today's matches display correctly from planning data
- [ ] Today's events display correctly from planning data
- [ ] Pitch overview displays correctly
- [ ] Dressing room overview displays correctly
- [ ] Auto refresh working at configured interval
- [ ] Full-screen mode working in target browser
- [ ] Kiosk mode tested on target display hardware
- [ ] Sponsor screensaver cycling correctly
- [ ] InfoBoard displays no content from other tenants

---

## 9. Week Planner

- [ ] Wochenplan admin UI functional
- [ ] Facility and resource configuration UI functional
- [ ] Conflict detection triggers correctly on overlapping allocations
- [ ] Standard Week Plan saves and applies correctly
- [ ] Bad Weather Week Plan activates and overrides Standard Week Plan correctly
- [ ] Publishing to website triggers correctly
- [ ] Publishing to InfoBoard triggers correctly
- [ ] Public Wochenplan feed (`/api/public/wochenplan`) returns current active plan

---

## 10. Documentation

- [ ] Admin Guide written, reviewed, and accessible to FC Allschwil admin
- [ ] Trainer Guide written, reviewed, and accessible to trainers
- [ ] Coordinator Guide written, reviewed, and accessible to coordinators
- [ ] Public API contract (`docs/public-website-feed-contract-v1.md`) current and reviewed
- [ ] Deployment documentation (`docs/deployment/`) current
- [ ] Vercel environment variable sheets (`docs/deployment/*-vercel-env-entry-sheet.md`) current

---

## 11. Testing

- [ ] Responsive design tested on mobile (iOS, Android), tablet, and desktop
- [ ] Cross-browser testing completed: Chrome, Safari, Firefox, Edge
- [ ] Device testing on representative iOS device
- [ ] Device testing on representative Android device
- [ ] InfoBoard tested on target kiosk hardware/browser
- [ ] Performance review: Lighthouse scores reviewed for key pages
- [ ] Core Web Vitals reviewed and critical issues resolved
- [ ] Accessibility baseline review completed (keyboard navigation, contrast)

---

## 12. Deployment Process

- [ ] Deployment checklist written and rehearsed end-to-end
- [ ] `npm run deploy:check` (lint + build) passes cleanly
- [ ] `prisma migrate deploy` rehearsed against a production-equivalent database
- [ ] Zero-downtime deployment strategy confirmed (Vercel handles this by default — verify)
- [ ] Post-deployment smoke test procedure documented
- [ ] All team members with deployment access confirmed

---

## 13. Smoke Testing

Run these checks immediately after every production deployment:

- [ ] `/api/health` returns HTTP 200
- [ ] Login at `/login` succeeds with a real production user
- [ ] Dashboard loads without error
- [ ] At least one public API endpoint returns expected data
- [ ] InfoBoard at `/infoboard` renders without error
- [ ] Public website confirms data is fresh post-deployment

---

## 14. Rollback

- [ ] Rollback procedure documented: previous Vercel deployment can be promoted in < 5 minutes
- [ ] Database migration rollback procedure documented for each migration type
- [ ] Rollback test performed in STAGE environment
- [ ] Team knows who has authority to call a rollback and how to execute it

---

## 15. Customer Validation

- [ ] FC Allschwil admin has reviewed and approved the production environment
- [ ] FC Allschwil coordinator has completed an end-to-end workflow walkthrough
- [ ] At least one trainer has verified their view and schedule
- [ ] At least one parent has verified the registration and calendar flow
- [ ] FC Allschwil has signed off on the go-live
- [ ] Support channel established and team notified

---

## Sign-Off

| Area | Verified by | Date |
|---|---|---|
| Infrastructure | | |
| Database | | |
| Security | | |
| Tenant Isolation | | |
| Auth & Permissions | | |
| Public API | | |
| Website Integration | | |
| InfoBoard | | |
| Week Planner | | |
| Documentation | | |
| Testing | | |
| Deployment | | |
| Smoke Testing | | |
| Rollback | | |
| Customer Validation | | |
