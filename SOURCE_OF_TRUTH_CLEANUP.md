# SportClubEvo WebApp — Source-of-Truth Cleanup Audit

> Generated: 2026-05-19
> Repository: `Clipse078/sportclubevo-webapp`

---

## 1. Current Source / Deployment Map

### Repository Topology

| Item | Value |
|---|---|
| **Remote** | `origin` → `github.com/Clipse078/sportclubevo-webapp` |
| **Default branch (GitHub)** | `master` |
| **Local branch checked out** | `master` (clean, up-to-date with `origin/master`) |
| **`master` tip** | `706bcf2` — `feat(dashboard): Governance Overview v1` (2026-05-19) |
| **`STAGE` tip** | `e442b50` — `Modules: finalize standalone meetings and initiatives routes + header update` (2026-05-01) |
| **Merge-base (common ancestor)** | `7625535` — `chore(repo): ignore vercel metadata before stage separation` (2026-04-19) |

### Commit Counts

| Branch | Total commits | Commits unique (not in other) |
|---|---|---|
| `origin/STAGE` | 328 | 324 unique to STAGE |
| `master` | 33 | 29 unique to master |
| Shared (at merge-base) | 4 | — |

### File-Level Divergence

```
537 files changed, 26,447 insertions(+), 89,544 deletions(-)
STAGE has 572 files  |  master has 345 files
```

### Branch Inventory (38 remote branches total)

**Merged into `master` (25 branches):**

All `cursor/*-a008` and `cursor/*-82f0` agent branches (PRs #14–#33) — feature work from 2026-05-18/19 that went into `master`.

**Merged into `STAGE` (0 branches):**

No feature branch has ever been merged into STAGE via PR. STAGE evolved as a direct-push linear history.

**Unmerged branches (11):**

| Branch | Last commit | Status |
|---|---|---|
| `cursor/fix-logout-flow-9e4a` | 2026-05-17 | Standalone logout fix |
| `cursor/news-article-public-detail-4646` | 2026-05-16 | News article feature |
| `cursor/platform-branding-reset-d33c` | 2026-05-17 | Branding reset attempt |
| `cursor/platform-evolution-clean-4646` | 2026-05-16 | Orphan baseline (clean rewrite attempt) |
| `cursor/sce-dashboard-rebrand-5097` | 2026-05-17 | Dashboard rebrand |
| `cursor/sce-design-alignment-9e4a` | 2026-05-17 | Design alignment + superadmin |
| `cursor/sportclubevo-platform-canonical` | 2026-05-17 | Merge integration branch (manual merges) |
| `cursor/sportclubevo-platform-canonical-71c0` | 2026-05-18 | Canonical sprint (targets, meetings, initiatives) |
| `cursor/strategy-targets-training-planner-kpi-160e` | 2026-05-16 | Full strategy/planner sprint |
| `cursor/strategy-training-targets-93bd` | 2026-05-16 | Training targets |
| `cursor/tenant-management-ui-5097` | 2026-05-17 | Tenant branding center |

### Vercel Deployment

- `vercel.json` exists in the repo but contains only build commands — no branch configuration.
- No `.vercel/` local project directory is present.
- Vercel branch-deploy settings are configured in the Vercel Dashboard, not in the repo. Based on the branch name `STAGE` and the commit message `chore(deploy): prepare webapp for stage deployment`, **Vercel is almost certainly configured to deploy from the `STAGE` branch**.

---

## 2. Exact Drift Cause

The drift has a single, clear root cause:

### STAGE and master diverged on 2026-04-19 and were never reconciled.

**Timeline:**
1. **2026-04-19:** Commit `7625535` (`chore(repo): ignore vercel metadata before stage separation`) is the last shared commit.
2. **After 2026-04-19 — STAGE path:** 324 commits were pushed directly to STAGE. These represent the **production UX evolution**: auth, login, registrations, persons, teams, ratings, planning (Wochenplan), infoboard, admin config, meetings/initiatives UX, and page foundation work. This is the version Vercel deploys.
3. **After 2026-04-19 — master path:** A separate set of 29 commits were built on master via Cursor agent PRs (#14–#33). These represent **governance/backend hardening**: DB-backed models, visibility, RBAC, audit logging, org-builder, templates, and a governance dashboard. These were never synced to STAGE.

**Why they look different:**
- **STAGE** has the full UX (572 files) — everything the user sees in Vercel.
- **master** has the governance backend (345 files) — a parallel backend refactor that shares no UX commits with STAGE.
- The two branches evolved independently with **zero cross-pollination** for 30 days.

---

## 3. Recommended Canonical STAGE Commit / Branch

### Decision: `origin/STAGE` at `e442b50` is the canonical baseline.

**Rationale:**
- STAGE is the deployed branch (Vercel).
- STAGE contains 324 unique commits of production UX and feature work.
- master contains 29 commits of governance/backend work that was never deployed or tested against STAGE.
- The master governance features *may* be valuable, but they were built on an outdated 2026-04-19 snapshot and may not integrate cleanly.

### Recommended approach:

1. **STAGE (`e442b50`) becomes the canonical `main` branch.**
2. The 29 governance commits on master become a **feature branch** to be reviewed, rebased, and merged *into STAGE* after conflict resolution.
3. All future PRs target STAGE (or its renamed successor).

---

## 4. Branches to Keep / Delete

### KEEP (3 branches)

| Branch | Reason |
|---|---|
| `STAGE` | **Source of truth** — deployed, canonical |
| `master` | Keep temporarily as `archive/master-governance-2026-05-19` for the 29 governance commits to be cherry-picked/rebased later |
| `cursor/fix-logout-flow-9e4a` | Potentially useful standalone fix — review for cherry-pick into STAGE |

### ARCHIVE then DELETE (25 branches — already merged into master)

All `cursor/*-a008` and `cursor/*-82f0` branches whose tips are ancestors of `master`. Their commits exist in `master` (which will itself be archived), so these are redundant:

```
cursor/actor-context-hydration-a008
cursor/audit-logging-v1-a008
cursor/communication-template-foundation-a008
cursor/cross-module-linking-a008
cursor/dashboard-governance-deepening-82f0
cursor/db-migration-seed-readiness-a008
cursor/four-eye-enforcement-v1-a008
cursor/governance-foundation-a008
cursor/governance-hardening-a008
cursor/governance-hardening-sprint-82f0
cursor/initiatives-db-promotion-a008
cursor/linking-db-query-upgrade-a008
cursor/meeting-detail-db-a008
cursor/meeting-sub-entities-v1-a008
cursor/meetings-db-promotion-a008
cursor/org-builder-phase1-a008
cursor/org-builder-phase2-allowlist-a008
cursor/permissionmodule-rbac-v1-a008
cursor/restricted-allowlist-picker-a008
cursor/target-visibility-scope-a008
cursor/targets-progress-templates-a008
cursor/templates-rbac-dashboard-resolver-a008
cursor/visibility-access-todos-a008
cursor/visibility-picker-ui-a008
cursor/visibility-scope-v1-a008
```

### DELETE (10 branches — unmerged, superseded or experimental)

| Branch | Reason |
|---|---|
| `cursor/news-article-public-detail-4646` | Stale feature experiment |
| `cursor/platform-branding-reset-d33c` | Superseded by STAGE |
| `cursor/platform-evolution-clean-4646` | Orphan rewrite attempt — not viable |
| `cursor/sce-dashboard-rebrand-5097` | Superseded by STAGE |
| `cursor/sce-design-alignment-9e4a` | Superseded; superadmin change needs separate cherry-pick if wanted |
| `cursor/sportclubevo-platform-canonical` | Manual merge branch — superseded |
| `cursor/sportclubevo-platform-canonical-71c0` | Canonical sprint — superseded by master governance work |
| `cursor/strategy-targets-training-planner-kpi-160e` | Old strategy sprint — superseded |
| `cursor/strategy-training-targets-93bd` | Old targets experiment |
| `cursor/tenant-management-ui-5097` | Tenant branding — review before delete, may want cherry-pick |

---

## 5. Exact Cleanup Commands

**These commands are provided for review. Do NOT execute until explicitly approved.**

### Step 1: Archive master as a tag (preserves all 29 governance commits)

```bash
git tag archive/master-governance-2026-05-19 origin/master
git push origin archive/master-governance-2026-05-19
```

### Step 2: Make STAGE the new default branch

```bash
# On GitHub: Settings → Branches → change default branch to STAGE

# Locally:
git fetch origin
git checkout STAGE
git branch -D master
```

### Step 3: Rename STAGE to main (optional, recommended)

```bash
# On GitHub: rename STAGE to main via Settings → Branches
# Or via git:
git branch -m STAGE main
git push origin main
git push origin --delete STAGE
# Then update GitHub default branch to main
```

### Step 4: Delete merged feature branches (25 branches)

```bash
git push origin --delete \
  cursor/actor-context-hydration-a008 \
  cursor/audit-logging-v1-a008 \
  cursor/communication-template-foundation-a008 \
  cursor/cross-module-linking-a008 \
  cursor/dashboard-governance-deepening-82f0 \
  cursor/db-migration-seed-readiness-a008 \
  cursor/four-eye-enforcement-v1-a008 \
  cursor/governance-foundation-a008 \
  cursor/governance-hardening-a008 \
  cursor/governance-hardening-sprint-82f0 \
  cursor/initiatives-db-promotion-a008 \
  cursor/linking-db-query-upgrade-a008 \
  cursor/meeting-detail-db-a008 \
  cursor/meeting-sub-entities-v1-a008 \
  cursor/meetings-db-promotion-a008 \
  cursor/org-builder-phase1-a008 \
  cursor/org-builder-phase2-allowlist-a008 \
  cursor/permissionmodule-rbac-v1-a008 \
  cursor/restricted-allowlist-picker-a008 \
  cursor/target-visibility-scope-a008 \
  cursor/targets-progress-templates-a008 \
  cursor/templates-rbac-dashboard-resolver-a008 \
  cursor/visibility-access-todos-a008 \
  cursor/visibility-picker-ui-a008 \
  cursor/visibility-scope-v1-a008
```

### Step 5: Delete superseded experimental branches (10 branches)

```bash
git push origin --delete \
  cursor/news-article-public-detail-4646 \
  cursor/platform-branding-reset-d33c \
  cursor/platform-evolution-clean-4646 \
  cursor/sce-dashboard-rebrand-5097 \
  cursor/sce-design-alignment-9e4a \
  cursor/sportclubevo-platform-canonical \
  cursor/sportclubevo-platform-canonical-71c0 \
  cursor/strategy-targets-training-planner-kpi-160e \
  cursor/strategy-training-targets-93bd \
  cursor/tenant-management-ui-5097
```

### Step 6: Create governance integration branch (for the 29 master-only commits)

```bash
git checkout STAGE
git checkout -b feature/governance-integration
git cherry-pick 44a1c38..706bcf2
# Resolve conflicts, test, then PR into STAGE
```

### Step 7: Delete old master after governance commits are integrated

```bash
# Only after feature/governance-integration is merged:
git push origin --delete master
```

---

## 6. Vercel Setting Changes Needed

| Setting | Current (likely) | Required |
|---|---|---|
| **Production Branch** | `STAGE` | Keep as `STAGE` (or update to `main` if renamed) |
| **Preview Branches** | Probably all branches | Restrict to `feature/*` and `fix/*` patterns only |
| **Auto-deploy** | Enabled for STAGE | Keep enabled |
| **GitHub default branch** | `master` | **Change to `STAGE`** (or `main` if renamed) |

### Specific Vercel Dashboard actions:

1. Go to **Project Settings → Git → Production Branch**
   - Confirm it is set to `STAGE` (or change to `main` after rename)
2. Go to **Project Settings → Git → Ignored Build Step**
   - Consider adding branch filters to prevent spurious preview deploys from stale branches
3. After cleanup, ensure the Vercel GitHub integration webhook points to the correct default branch

---

## 7. Future Workflow Rules to Prevent Drift

### Rule 1: Single Production Branch
- **`STAGE`** (or `main`) is the only deployable branch.
- All PRs must target `STAGE` as their base branch.
- No direct pushes to `STAGE` — enforce branch protection with required PR reviews.

### Rule 2: Branch Protection
```
GitHub → Settings → Branches → Branch protection rules for STAGE:
  ✅ Require pull request before merging
  ✅ Require status checks (build + lint at minimum)
  ✅ Do not allow bypassing the above settings
  ❌ No direct pushes
```

### Rule 3: No Parallel Long-Lived Branches
- `master` should not exist as an independent development line.
- If a `develop` or `next` branch is needed, it must be kept in sync with STAGE weekly via merge or rebase.

### Rule 4: Agent Branch Hygiene
- All Cursor agent branches use `cursor/` prefix.
- Agent branches must target `STAGE` as their PR base.
- Merged agent branches are auto-deleted (GitHub setting: "Automatically delete head branches").

### Rule 5: Weekly Sync Check
- Run `git log --oneline --left-right STAGE...master` weekly (if master still exists).
- If divergence > 0 commits, escalate immediately.

### Rule 6: Vercel Deploy Lock
- Only `STAGE` (or `main`) triggers production deploys.
- Preview deploys are limited to `feature/*` and `fix/*` branches.
- Stale preview deployments are cleaned monthly.

---

## Summary

| # | Finding | Action |
|---|---|---|
| 1 | STAGE and master diverged 30 days ago (2026-04-19) | Acknowledge; STAGE is canonical |
| 2 | 324 UX commits on STAGE never reached master | STAGE is authoritative |
| 3 | 29 governance commits on master never reached STAGE | Archive master, cherry-pick governance features into STAGE via a dedicated integration branch |
| 4 | 25 agent branches already merged into master | Delete after archiving master |
| 5 | 11 experimental branches exist | Review and delete |
| 6 | Vercel deploys from STAGE | Correct — keep this; update GitHub default branch to match |
| 7 | No branch protection exists | Enable protection on STAGE |
