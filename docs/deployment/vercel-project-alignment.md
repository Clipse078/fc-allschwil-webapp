# Vercel Project Alignment — SportClubEvo WebApp

This document describes the plan to align the GitHub repository, local workspace, and Vercel projects
with the canonical `sportclubevo-webapp` identity.

---

## Current State (as of canonical branch creation)

| Asset | Current Name | Target Name |
|---|---|---|
| GitHub repo | `fc-allschwil-webapp` | `sportclubevo-webapp` |
| Local folder (dev machine) | `C:\Users\MichaelDuijster\fc-allschwil-webapp` | `C:\Users\MichaelDuijster\sportclubevo-webapp` |
| `package.json` name | ~~`fc-allschwil-webapp`~~ | ✅ `sportclubevo-webapp` |
| Root metadata title | ~~`FC Allschwil WebApp`~~ | ✅ `SportClubEvo – Club Management Platform` |
| Vercel staging project | `fc-allschwil-webapp-stage` | `sportclubevo-webapp-stage` |
| Vercel production project | `fc-allschwil-webapp` | `sportclubevo-webapp` |

---

## Step-by-Step Alignment Plan

### 1. Rename GitHub Repository

> **When:** After merging the canonical branch and verifying the build on staging.

1. Go to the GitHub repository → **Settings → General**.
2. Under "Repository name", change `fc-allschwil-webapp` → `sportclubevo-webapp`.
3. Click **Rename**.

GitHub will automatically redirect all old URLs. Update any local remotes:

```bash
git remote set-url origin https://github.com/<org>/sportclubevo-webapp.git
```

---

### 2. Rename Local Folder

> **When:** After renaming the GitHub repo (so the remote URL is stable).

1. Close any open editors / terminal sessions pointing to the old folder.
2. Rename via Windows Explorer or PowerShell:

```powershell
Rename-Item "C:\Users\MichaelDuijster\fc-allschwil-webapp" "sportclubevo-webapp"
```

3. Re-open the project from the new path in your editor.
4. Verify `git remote -v` still shows the correct remote URL (update with `git remote set-url` if needed).

---

### 3. Create New Vercel Projects

> **When:** After the GitHub repo has been renamed so Vercel picks up the correct repo name.

#### 3a. Create `sportclubevo-webapp-stage` (Staging)

1. Go to [vercel.com/new](https://vercel.com/new).
2. Import from GitHub: select `sportclubevo-webapp`.
3. Project name: `sportclubevo-webapp-stage`.
4. Configure:
   - **Framework Preset:** Next.js
   - **Branch:** `STAGE` (or your staging branch)
   - **Environment Variables:** copy from the existing `fc-allschwil-webapp-stage` project
     (use the Vercel dashboard → Project → Settings → Environment Variables → Export).
5. Deploy and verify the build succeeds.

#### 3b. Create `sportclubevo-webapp` (Production)

1. Go to [vercel.com/new](https://vercel.com/new).
2. Import from GitHub: select `sportclubevo-webapp`.
3. Project name: `sportclubevo-webapp`.
4. Configure:
   - **Framework Preset:** Next.js
   - **Branch:** `master`
   - **Environment Variables:** copy from the existing production project.
5. Deploy and verify the build succeeds.
6. Re-assign your production custom domain(s) to this new project.

---

### 4. Retire `fc-allschwil-webapp-stage`

> **When:** After `sportclubevo-webapp-stage` has been verified with at least one full deploy cycle.

1. In Vercel dashboard, open the old `fc-allschwil-webapp-stage` project.
2. Go to **Settings → General → Delete Project**.
3. Confirm deletion.

> ⚠️ Do NOT delete until the new staging project is confirmed healthy and all environment
> variables have been migrated.

---

### 5. Retire `fc-allschwil-webapp` (Old Production)

> **When:** After the new `sportclubevo-webapp` production project is live and custom domains
> are fully transferred.

1. Remove custom domains from the old project first (Domains → Remove).
2. Delete the old project via **Settings → General → Delete Project**.

---

## FCA Reference Classification

The following FC Allschwil references remain in the codebase and are **intentionally permitted**
as tenant #1 data/context:

| File | Nature | Status |
|---|---|---|
| `prisma/seed.ts` | FC Allschwil as tenant #1 seed data | ✅ Allowed — tenant data |
| `app/api/events/import/route.ts` | Team name import mapping for FC Allschwil | ✅ Allowed — tenant data |
| `app/api/events/import/preview/route.ts` | Team name import mapping for FC Allschwil | ✅ Allowed — tenant data |
| `lib/teams/team-season-rules.ts` | `buildTeamSeasonDisplayName` prefixes "FC Allschwil" | ⚠️ Tenant-data context; refactor when multi-tenant naming is implemented |
| `components/admin/teams/TeamSeasonCreateCard.tsx` | Default display name suggestion | ⚠️ Tenant-data context; refactor when multi-tenant naming is implemented |
| `components/admin/events/OtherEventCreateForm.tsx` | Placeholder example text | ✅ Allowed — example text only |
| `components/shared/FcaBrandCrest.tsx` | SVG crest component for tenant branding | ✅ Allowed — tenant asset |

The following references were **removed** from the global platform identity:

| File | Change |
|---|---|
| `components/auth/LoginForm.tsx` | Replaced FC Allschwil login with SportClubEvo platform login |
| `app/layout.tsx` | Updated metadata title/description to SportClubEvo |
| `app/(admin)/layout.tsx` | Replaced `FcaBrandCrest` watermark with `SportClubEvoMark` |
| `components/admin/shared/AdminWatermark.tsx` | Replaced FC Allschwil logo with `SportClubEvoMark` |
| `components/admin/layout/AdminPageHeader.tsx` | Changed default eyebrow from "FC Allschwil WebApp" to "SportClubEvo Platform" |
| `app/(admin)/dashboard/users/[userId]/tenants/actions.ts` | Removed `admin@fcallschwil.ch` from superadmin guard |
| `package.json` | Renamed from `fc-allschwil-webapp` to `sportclubevo-webapp` |

---

## Notes

- CSS utility class names prefixed with `fca-` (e.g., `.fca-eyebrow`, `.fca-card`) are internal
  design tokens inherited from the FC Allschwil era. They are not user-visible and do not
  constitute platform identity. They will be refactored to `sce-` prefixes in a future design
  system cleanup sprint.
- The `STAGE` branch in Git maps to the staging Vercel project. The `master` branch maps to production.
