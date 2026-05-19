# SportClubEvo WebApp — Source-of-Truth Cleanup Audit

**Date:** 2026-05-19
**Repo:** `Clipse078/sportclubevo-webapp`
**GitHub default branch:** `master`
**Goal:** Make `STAGE` the single canonical source of truth.

---

## 1. Current Source / Deployment Map

### Branches

| Branch | Tip SHA | Last Commit Date | Commits (total) | Status |
|--------|---------|-------------------|-----------------|--------|
| `origin/master` | `706bcf2` | 2026-05-19 09:48 UTC | 33 (from fork point) | GitHub default branch. All recent PRs merge here. |
| `origin/STAGE` | `e442b50` | 2026-05-01 11:00 CEST | 324 (from fork point) | **Stale — 18 days behind.** Contains older UX/page-foundation work. |

### Common Ancestor

Both branches share ancestor `7625535` (`chore(repo): ignore vercel metadata before stage separation`), which is the original fork point.

### Divergence

- **STAGE has 324 unique commits** not in `master` — primarily UX page-foundation scaffolding, registration workflows, meetings visibility, and login redesign work from before the modular rewrite.
- **master has 29 unique commits** not in `STAGE` — the entire modular governance/RBAC/org-builder stack (PRs #9–#33), all merged May 18–19.
- **Total diff:** 537 files changed, 26,447 insertions, 89,544 deletions between `STAGE → master`.

### Remote Tracking Branches (37 total)

All `cursor/*` branches are agent-created feature branches. 25 have been merged to `master` (PRs #9–#33). 6 remain as open PRs.

### Open PRs

| # | Title | Head → Base | Status |
|---|-------|-------------|--------|
| 1 | `feat: public NewsArticle detail rendering` | `cursor/news-article-public-detail-4646` → `master` | Open — 13 unique commits, pre-modular work |
| 2 | `rebrand: SportClubEvo platform identity + superadmin dashboard` | `cursor/platform-branding-reset-d33c` → `master` | Open — 12 unique commits, pre-modular work |
| 3 | `feat: Tenant Management UI — Phase 5` | `cursor/tenant-management-ui-5097` → `master` | Open — 12 unique commits |
| 4 | `feat: SportClubEvo dashboard rebrand` | `cursor/sce-dashboard-rebrand-5097` → `cursor/tenant-management-ui-5097` | Open — chained off PR #3 |
| 5 | `feat: SportClubEvo Platform Canonical Branch` | `cursor/sportclubevo-platform-canonical` → `master` | Open — 20 unique commits, pre-modular mega-branch |
| 8 | `feat: Meetings + Initiatives + Targets` | `cursor/sportclubevo-platform-canonical-71c0` → `master` | Open — 14 unique commits, **superseded** by PRs #9–#33 |

### Vercel Configuration

- `vercel.json` is identical on both `master` and `STAGE` (standard Next.js config).
- No `.vercel/` project metadata is committed (correctly gitignored).
- **Vercel deployment branch cannot be determined from repo alone** — it is configured in the Vercel dashboard. Given that `STAGE` branch exists and is named `STAGE`, Vercel is almost certainly configured to deploy from `STAGE` (common Vercel convention: production branch = the one named in the dashboard).

---

## 2. Exact Drift Cause

The drift has a clear timeline:

1. **STAGE was the active development branch** through early May (last commit May 1). It accumulated 324 commits of organic development: UX foundations, registration workflows, meetings visibility, login redesign.

2. **master was then used as the PR merge target** starting May 18. Cursor agents created 25 feature branches, all targeting `master` as their base. These PRs (#9–#33) introduced the entire modular rewrite: Targets, Governance, Meetings DB promotion, Visibility, RBAC, OrgBuilder, Communication Templates, and Dashboard.

3. **STAGE was never updated** after May 1. None of the 29 master commits were merged/rebased into `STAGE`.

4. **Result:** Two completely diverged branches sharing only the initial foundation. `master` has the newer modular architecture. `STAGE` has older UX scaffolding that may or may not conflict with the newer work.

**Root cause:** PRs were merged to `master` instead of `STAGE`, and no synchronization workflow existed between the two branches.

---

## 3. Recommended Canonical STAGE Commit/Branch

### Recommendation: Fast-forward `STAGE` to `master` tip (`706bcf2`)

**Rationale:**
- `master` contains **all** the latest modular architecture work (PRs #9–#33).
- The 324 STAGE-only commits represent older work that was either:
  - **Superseded** by the modular rewrite (meetings, initiatives, targets were completely rebuilt), or
  - **UX scaffolding** (PageShell/PageHeader patterns) that needs to be evaluated against the new architecture.
- Force-updating `STAGE` to match `master` is the cleanest path, as attempting to merge 324 divergent commits would create massive conflicts in 537+ files.

### Before resetting STAGE, preserve the old work:

```bash
# Tag the old STAGE tip for reference/archaeology
git tag archive/STAGE-pre-cleanup-2026-05-19 origin/STAGE

# Then reset STAGE to master
git checkout STAGE
git reset --hard origin/master
git push --force-with-lease origin STAGE
```

---

## 4. Branches to Keep / Delete

### KEEP

| Branch | Reason |
|--------|--------|
| `master` | GitHub default branch. Will be synchronized with STAGE. |
| `STAGE` | Will become the canonical deployment branch (after reset to master). |

### DELETE (already merged to master — safe to remove)

These 25 branches correspond to merged PRs #9–#33:

| Branch | Merged PR |
|--------|-----------|
| `cursor/targets-progress-templates-a008` | PR #9 |
| `cursor/governance-foundation-a008` | PR #10 |
| `cursor/cross-module-linking-a008` | PR #11 |
| `cursor/meetings-db-promotion-a008` | PR #12 |
| `cursor/initiatives-db-promotion-a008` | PR #13 |
| `cursor/db-migration-seed-readiness-a008` | PR #14 |
| `cursor/linking-db-query-upgrade-a008` | PR #15 |
| `cursor/meeting-detail-db-a008` | PR #16 |
| `cursor/visibility-access-todos-a008` | PR #17 |
| `cursor/visibility-scope-v1-a008` | PR #18 |
| `cursor/visibility-picker-ui-a008` | PR #19 |
| `cursor/governance-hardening-a008` | PR #20 |
| `cursor/target-visibility-scope-a008` | PR #21 |
| `cursor/permissionmodule-rbac-v1-a008` | PR #22 |
| `cursor/four-eye-enforcement-v1-a008` | PR #23 |
| `cursor/audit-logging-v1-a008` | PR #24 |
| `cursor/restricted-allowlist-picker-a008` | PR #25 |
| `cursor/meeting-sub-entities-v1-a008` | PR #26 |
| `cursor/communication-template-foundation-a008` | PR #27 |
| `cursor/templates-rbac-dashboard-resolver-a008` | PR #28 |
| `cursor/org-builder-phase1-a008` | PR #29 |
| `cursor/org-builder-phase2-allowlist-a008` | PR #30 |
| `cursor/actor-context-hydration-a008` | PR #31 |
| `cursor/governance-hardening-sprint-82f0` | PR #32 |
| `cursor/dashboard-governance-deepening-82f0` | PR #33 |

### CLOSE & DELETE (open PRs — superseded or stale)

| Branch | PR | Reason |
|--------|----|--------|
| `cursor/sportclubevo-platform-canonical-71c0` | #8 | **Fully superseded** by PRs #9–#33 (same features rebuilt properly). |
| `cursor/sportclubevo-platform-canonical` | #5 | **Superseded** — mega-branch approach abandoned in favor of modular PRs. |
| `cursor/sce-dashboard-rebrand-5097` | #4 | Chained off PR #3; pre-modular work. Evaluate before deleting. |
| `cursor/tenant-management-ui-5097` | #3 | Pre-modular tenant work. Evaluate before deleting. |
| `cursor/platform-branding-reset-d33c` | #2 | Pre-modular rebranding. Evaluate before deleting. |
| `cursor/news-article-public-detail-4646` | #1 | Pre-modular public pages. Evaluate before deleting. |

### ARCHIVE CANDIDATES (not in any PR, stale)

| Branch | Content |
|--------|---------|
| `cursor/fix-logout-flow-9e4a` | Merged into canonical branch (PR #7), not into master |
| `cursor/sce-design-alignment-9e4a` | Merged into canonical branch (PR #6), not into master |
| `cursor/strategy-targets-training-planner-kpi-160e` | Likely stale experiment |
| `cursor/strategy-training-targets-93bd` | Likely stale experiment |
| `cursor/platform-evolution-clean-4646` | Likely stale experiment |

---

## 5. Exact Cleanup Commands

### Step 1: Tag old STAGE for archaeology

```bash
git fetch origin
git tag archive/STAGE-pre-cleanup-2026-05-19 origin/STAGE
git push origin archive/STAGE-pre-cleanup-2026-05-19
```

### Step 2: Reset STAGE to master

```bash
git checkout -B STAGE origin/master
git push --force-with-lease origin STAGE
```

### Step 3: Delete merged feature branches (25 branches)

```bash
git push origin --delete \
  cursor/targets-progress-templates-a008 \
  cursor/governance-foundation-a008 \
  cursor/cross-module-linking-a008 \
  cursor/meetings-db-promotion-a008 \
  cursor/initiatives-db-promotion-a008 \
  cursor/db-migration-seed-readiness-a008 \
  cursor/linking-db-query-upgrade-a008 \
  cursor/meeting-detail-db-a008 \
  cursor/visibility-access-todos-a008 \
  cursor/visibility-scope-v1-a008 \
  cursor/visibility-picker-ui-a008 \
  cursor/governance-hardening-a008 \
  cursor/target-visibility-scope-a008 \
  cursor/permissionmodule-rbac-v1-a008 \
  cursor/four-eye-enforcement-v1-a008 \
  cursor/audit-logging-v1-a008 \
  cursor/restricted-allowlist-picker-a008 \
  cursor/meeting-sub-entities-v1-a008 \
  cursor/communication-template-foundation-a008 \
  cursor/templates-rbac-dashboard-resolver-a008 \
  cursor/org-builder-phase1-a008 \
  cursor/org-builder-phase2-allowlist-a008 \
  cursor/actor-context-hydration-a008 \
  cursor/governance-hardening-sprint-82f0 \
  cursor/dashboard-governance-deepening-82f0
```

### Step 4: Close superseded PRs (via GitHub UI or CLI)

```bash
# Close PR #8 (superseded by modular PRs)
gh pr close 8 --comment "Superseded by modular PRs #9–#33. All features rebuilt."

# Close PR #5 (mega-branch abandoned)
gh pr close 5 --comment "Superseded. Modular PR strategy adopted instead."
```

### Step 5: Delete superseded open PR branches

```bash
git push origin --delete \
  cursor/sportclubevo-platform-canonical-71c0 \
  cursor/sportclubevo-platform-canonical
```

### Step 6: Evaluate remaining open PRs (#1–#4)

PRs #1–#4 contain pre-modular work (news articles, tenant management, rebranding). Before deleting:
1. Review each for any unique functionality not yet in `master`.
2. If useful, rebase onto `STAGE` (which now equals `master`) and re-submit as fresh PRs.
3. If superseded, close with comment and delete branches.

### Step 7: Clean up stale experiment branches

```bash
git push origin --delete \
  cursor/fix-logout-flow-9e4a \
  cursor/sce-design-alignment-9e4a \
  cursor/strategy-targets-training-planner-kpi-160e \
  cursor/strategy-training-targets-93bd \
  cursor/platform-evolution-clean-4646
```

---

## 6. Vercel Setting Changes Needed

### In Vercel Dashboard → Project Settings → Git:

1. **Production Branch:** Set to `STAGE` (if not already).
2. **Preview Branches:** Optionally enable for `master` to get preview deployments on master pushes.
3. **Ignored Build Step:** No changes needed — `vercel.json` is already correct.

### In GitHub → Repository Settings:

1. **Default Branch:** Consider changing from `master` to `STAGE` so new PRs target `STAGE` by default. This ensures all future work flows into the canonical deployment branch.
2. **Branch Protection:** Add branch protection rules to `STAGE`:
   - Require PR reviews before merging.
   - Require status checks to pass.
   - Prevent force pushes (after the initial reset).

---

## 7. Future Workflow Rules to Prevent Drift

### Rule 1: Single Merge Target

All PRs **MUST** target `STAGE` as their base branch. `master` should be a read-only mirror or deprecated entirely.

**Implementation:** Change GitHub default branch to `STAGE`.

### Rule 2: No Direct Commits

No direct commits to `STAGE` or `master`. All changes go through PRs.

**Implementation:** Enable branch protection on `STAGE`.

### Rule 3: Cursor Agent Configuration

All Cursor cloud agents must be configured to:
- Create feature branches from `STAGE` (not `master`).
- Set PR base branch to `STAGE`.

### Rule 4: Sync Protocol

If both `master` and `STAGE` are kept:
- After every merge to `STAGE`, fast-forward `master` to match: `git push origin STAGE:master`.
- Or: deprecate `master` entirely and only use `STAGE`.

### Rule 5: Recommended Simplified Branch Strategy

```
STAGE (production / canonical)
  └── cursor/feature-branch-*  (short-lived feature branches)
```

- `STAGE` = production deployment branch = PR merge target.
- `master` = either deprecated or kept as a read-only alias of `STAGE`.
- Feature branches are created from and merged back to `STAGE`.
- No long-lived parallel branches.

---

## Summary

| Item | Current State | Target State |
|------|--------------|--------------|
| Canonical branch | Ambiguous (`master` has latest code, `STAGE` is configured for deploy) | `STAGE` = single source of truth |
| `STAGE` content | 18 days stale, 324 divergent commits | Reset to `master` tip (`706bcf2`) |
| `master` role | Accidental primary (all PRs merge here) | Mirror of `STAGE` or deprecated |
| Feature branches | 37 remote branches, 25 merged, 6 open PRs, ~5 stale | Cleaned up; only active work remains |
| Vercel deploy | Likely deploying stale `STAGE` | Deploys fresh `STAGE` (= latest code) |
| PR target | `master` | `STAGE` |
| Drift prevention | None | Branch protection + default branch change |
