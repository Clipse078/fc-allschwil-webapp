# SportClubEvo WebApp — Source-of-Truth Cleanup Audit

Date: 2026-05-19
Audit branch: `cursor/source-of-truth-audit-1a2e`
Repo: `Clipse078/sportclubevo-webapp`
Author: Cursor cloud agent (audit only — no destructive operations)

This document is **read-only audit + cleanup proposal**. No branches are deleted, no
remote refs are overwritten, no Vercel settings are changed. Approval is required
before executing any of the commands in section 6.

---

## 1. Current source / deployment map

### 1.1 Remotes

```
origin  https://github.com/Clipse078/sportclubevo-webapp  (fetch + push)
```
Default branch on GitHub: **`master`**.

### 1.2 Branches that matter

| Branch | Tip commit | Last commit (UTC) | Authors |
|--------|------------|-------------------|---------|
| `origin/master` (default) | `706bcf2` "feat(dashboard): Governance Overview v1" | 2026-05-19 09:48 | `Clipse078`, `Michael Duijster`, `Cursor Agent` |
| `origin/STAGE` | `e442b50` "Modules: finalize standalone meetings and initiatives routes + header update" | 2026-05-01 09:00 | `Clipse078`, `Michael Duijster` (no Cursor agent commits) |
| Merge base | `7625535` "chore(repo): ignore vercel metadata before stage separation" | 2026-04-19 07:07 | — |

There are 36 additional remote `cursor/*` feature branches; all of them descend
from `master` (each one is the source branch of a merged or open PR — see §1.5).

### 1.3 Divergence

Counted from the common merge base `7625535`:

- `origin/STAGE` is **324 commits ahead** of merge base, **0 commits merged** from `master` since.
- `origin/master` is **29 commits ahead** of merge base, **0 commits merged** from `STAGE` since.
- The two branches have **never been merged after split**.

### 1.4 What the two lines actually contain

Two completely different bodies of work were piled on top of the same merge base
without ever touching:

`origin/STAGE` (324 commits, direct pushes from product devs):
- Page foundation roll‑out (PageShell / PageHeader applied across ~25 admin
  pages: meetings, initiatives, teams, persons, events, planner, logs, …)
- Persons module consolidation (BasePersonProfile, profile primitives,
  trainer qualifications card, photo uploader, season ratings)
- Teams module (premium roster UX, Jahrgang logic, KPI breakdown, trainer
  recommendation, qualification rules, club configuration)
- Wochenplan / planner / season planning grid + workflow policies
- Infoboard (TV layout, sponsor screensaver, big match mode)
- Registrations workflow engine + template steps + premium detail cockpit
- Login redesign + auth proxy migration
- Standalone Meetings and Initiatives modules (UI/route layer, **not** wired
  to the new DB models that live on `master`)
- 66 `.bak` files and a `.baseline-backups/` directory still tracked in tree

`origin/master` (29 commits, all from merged Cursor‑agent PRs):
- Targets module (DB‑backed) + progress tracking + curated templates
- Module Governance Foundation (stage transitions, four‑eye approval)
- Cross‑module linking foundation
- DB promotion of Meeting and Initiative (replaces in‑memory stubs)
- Visibility scope v1 + visibility picker UI + RESTRICTED allowlist picker
- Permission modules MEETINGS / INITIATIVES + permission guards
- Audit logging v1 (11 endpoints)
- Communication template foundation + dashboard v1
- Org Builder Phase 1–3 (OrgUnit graph, allowlist select, ActorContext
  hydration)
- 12 Prisma migrations (`20260518*` + `20260519*`) and ~1.5k‑line
  `schema.prisma` diff that **does not exist on STAGE**

### 1.5 PR history

```
Merged PRs   into master : 25   (#9 … #33, all cursor/*-a008 / -82f0 branches)
Merged PRs   into STAGE  :  0
Open  PRs    targeting   : master only (6 drafts, none on STAGE)
```

Effectively: **all PR review traffic flows into `master`. STAGE only receives
direct pushes from two human contributors.**

### 1.6 Local working copy

```
HEAD = master (706bcf2) — clean, in sync with origin/master.
```

The local checkout therefore reflects the **governance/RBAC** line, not the
**product/UX** line. This is the immediate visible cause of the "local looks
different from Vercel STAGE" symptom in the screenshots: local is showing
`master`; Vercel STAGE is showing `origin/STAGE`, and those two trees have not
been reconciled in a month.

### 1.7 Vercel deployment branch

Inferred (cannot be confirmed without dashboard access from the agent VM):

- Vercel STAGE environment is wired to deploy from the `STAGE` branch.
  Evidence:
  - The branch is named `STAGE` (uppercase, project‑specific) — this is only a
    natural choice if Vercel was explicitly configured to follow it.
  - All "screenshots indicate STAGE looks newer than local" symptoms map
    cleanly to "STAGE branch contains 324 unique commits the local `master`
    doesn't".
  - There is a merge‑base commit `7625535` literally called *"chore(repo):
    ignore vercel metadata before stage separation"*, which is the moment
    STAGE was split off as a Vercel deployment target.
- A Production environment, if any, most likely still tracks `master`
  (Vercel default for the GitHub default branch). This must be verified in
  the Vercel dashboard before any branch is deleted.

**ACTION REQUIRED (human, in Vercel dashboard):**
Project Settings → Git → confirm:
1. Production Branch (probably `master`).
2. Preview / "STAGE" environment branch (probably `STAGE`).
3. Whether any other branches are configured as deploy hooks or aliased to a
   custom domain.

Do **not** change those settings yet — they are evidence; we need them
documented before cleanup.

---

## 2. Exact cause of the drift

A single root cause with three contributing process gaps:

**Root cause:** STAGE was forked off `master` on 2026-04-19 with the explicit
purpose of becoming a separate deploy target, but the team kept merging work
into `master` (PR review path for all Cursor‑agent contributions) **and**
pushing work directly to `STAGE` (direct human pushes for product/UX) — and
nothing ever flowed between the two branches.

Contributing factors:

1. **Two parallel write paths, neither aware of the other.**
   - Cursor cloud‑agent PRs all target `master` (25 merged, 6 open). None
     target STAGE.
   - Direct `git push origin STAGE` from `Clipse078` / `Michael Duijster`
     produced 324 commits without going through PR review.
2. **No back‑merge cadence.** STAGE has never had `master` merged into it
   after the 2026-04-19 split. `master` has never had STAGE merged into it.
3. **Deploy target ≠ default branch.** Vercel STAGE follows `STAGE`, but
   GitHub default is `master`, so newcomers (and the cloud agents) naturally
   open PRs against `master`.

**Symptom on screenshots:**
- Local checkout shows `master` → governance/RBAC dashboard, no Wochenplan,
  no premium people module, no infoboard, old vereinsleitung detail pages.
- Vercel STAGE shows `STAGE` → premium people/teams/wochenplan/infoboard,
  but no DB‑backed Meetings/Initiatives/Targets, no visibility scope, no
  audit logging, no Org Builder.

---

## 3. Canonical target

### 3.1 Decision: STAGE is the single source of truth

This is the user directive and matches the deployment reality (Vercel
STAGE = our shared playable build). Going forward:

- **`STAGE`** is the integration branch and the one Vercel STAGE deploys
  from. All work lands here.
- **`master`** is demoted: it remains as the GitHub default only because we
  cannot retire it without coordinating with Vercel; it is **not** an
  independent feature target. Nothing merges into `master` unless it is
  first in `STAGE` or it is a hotfix that will immediately be back‑merged
  into `STAGE`.
- All Cursor‑agent PRs and human PRs **must** target `STAGE`.

### 3.2 But STAGE today is *not* yet that canonical commit

STAGE today (`e442b50`) is **missing 29 commits / 12 prisma migrations / the
~1.5k‑line schema.prisma upgrade** that have been merged into `master`. If we
declare STAGE canonical *as is*, we lose Targets, Module Governance
Foundation, DB‑backed Meetings + Initiatives, Visibility scope, Audit
logging, Communication templates, and Org Builder Phase 1–3.

Therefore the canonical STAGE commit is **not the current tip**. The
canonical STAGE has to be:

> "current `origin/STAGE` tip **plus** all of `master`'s 29 commits since the
> 2026-04-19 merge base, conflicts resolved (mostly in
> `app/(admin)/vereinsleitung/**`, `components/admin/vereinsleitung/**`,
> `prisma/schema.prisma`, `prisma/seed.ts`, sidebar / permissions /
> page‑header)."

The mechanical recipe to produce that commit is in §6.

### 3.3 Conflict surface (already mapped)

55 path‑level overlaps; after dropping `.bak` and `.baseline-backups/`
artefacts, the **real** conflict surface is 26 files:

```
app/(admin)/vereinsleitung/initiativen/page.tsx
app/(admin)/vereinsleitung/initiativen/[slug]/page.tsx
app/(admin)/vereinsleitung/initiativen/[slug]/edit/page.tsx
app/(admin)/vereinsleitung/meetings/page.tsx
app/(admin)/vereinsleitung/meetings/new/page.tsx
app/(admin)/vereinsleitung/meetings/[slug]/page.tsx
app/(admin)/vereinsleitung/meetings/[slug]/edit/page.tsx
app/(admin)/vereinsleitung/page.tsx
components/admin/layout/AdminPageHeader.tsx
components/admin/layout/AdminSidebar.tsx
components/admin/vereinsleitung/VereinsleitungDashboard.tsx
components/admin/vereinsleitung/VereinsleitungKpiCard.tsx
components/admin/vereinsleitung/VereinsleitungMeetingActionsCard.tsx
components/admin/vereinsleitung/VereinsleitungMeetingAgendaCard.tsx
components/admin/vereinsleitung/VereinsleitungMeetingDecisionsCard.tsx
components/admin/vereinsleitung/VereinsleitungMeetingDetail.tsx
components/admin/vereinsleitung/VereinsleitungMeetingInfoCard.tsx
components/admin/vereinsleitung/VereinsleitungMeetingParticipantsCard.tsx
components/admin/vereinsleitung/VereinsleitungMeetingsCard.tsx
components/admin/vereinsleitung/VereinsleitungMeetingsList.tsx
lib/permissions/get-visible-admin-nav.ts
lib/permissions/permissions.ts
package.json
package-lock.json
prisma/schema.prisma
prisma/seed.ts
```

Resolution policy proposed for those 26 files (must be confirmed by humans
on the merge PR):

- `prisma/schema.prisma`, `prisma/seed.ts`, all `prisma/migrations/2026051*`:
  **take master verbatim** — these are additive DB models for Targets /
  Meeting / Initiative / Visibility / Templates / OrgBuilder. STAGE never
  modified the schema.
- `lib/permissions/**`, `components/admin/layout/**`: **prefer master** for
  the new permission modules (MEETINGS, INITIATIVES, TEMPLATES) and
  ActorContext orgUnit hydration; cherry‑pick STAGE's nav‑label updates on
  top.
- `app/(admin)/vereinsleitung/**` and
  `components/admin/vereinsleitung/Vereinsleitung*.tsx`: **product/UX
  decision required.** STAGE's standalone Meetings/Initiatives routes were
  built against the old in‑memory stubs; master's pages are wired to the
  new DB models. The merge must keep STAGE's UX/page‑foundation polish but
  point it at the master DB layer. Owner: a human dev pair or one
  follow‑up cloud‑agent task.
- `package.json` / `package-lock.json`: regenerate by re‑running
  `npm install` after the textual merge (do not hand‑merge the lockfile).

---

## 4. Branches: keep / archive / delete

**Nothing is deleted in this audit.** This is the proposal.

### 4.1 Keep (active)

| Branch | Reason |
|--------|--------|
| `STAGE` | New canonical integration + Vercel STAGE deploy target. |
| `master` | Keep until Vercel/GitHub default branch can be flipped to `STAGE`. After flip, retain as historical or rename to `legacy/master` (see §4.3). |

### 4.2 Open PR feature branches — keep until PR is closed/merged

These are still referenced by an open PR; do not delete:

```
cursor/sportclubevo-platform-canonical-71c0   (PR #8,  draft)
cursor/sportclubevo-platform-canonical        (PR #5,  draft)
cursor/sce-dashboard-rebrand-5097             (PR #4,  draft)
cursor/tenant-management-ui-5097              (PR #3,  draft)
cursor/platform-branding-reset-d33c           (PR #2,  draft)
cursor/news-article-public-detail-4646        (PR #1,  draft)
```

Action: **re‑target each of these PRs from `master` → `STAGE`** once the
master→STAGE catch‑up merge has landed. Then either merge them into STAGE
or close as obsolete.

### 4.3 Archive after one back‑merge cycle (do **not** delete yet)

These 25 branches are the source branches of PRs that are already merged
into `master`. They stop being needed the moment the corresponding PR is
green on `STAGE`:

```
cursor/dashboard-governance-deepening-82f0      (PR #33)
cursor/governance-hardening-sprint-82f0         (PR #32)
cursor/actor-context-hydration-a008             (PR #31)
cursor/org-builder-phase2-allowlist-a008        (PR #30)
cursor/org-builder-phase1-a008                  (PR #29)
cursor/templates-rbac-dashboard-resolver-a008   (PR #28)
cursor/communication-template-foundation-a008   (PR #27)
cursor/meeting-sub-entities-v1-a008             (PR #26)
cursor/restricted-allowlist-picker-a008         (PR #25)
cursor/audit-logging-v1-a008                    (PR #24)
cursor/four-eye-enforcement-v1-a008             (PR #23)
cursor/permissionmodule-rbac-v1-a008            (PR #22)
cursor/target-visibility-scope-a008             (PR #21)
cursor/governance-hardening-a008                (PR #20)
cursor/visibility-picker-ui-a008                (PR #19)
cursor/visibility-scope-v1-a008                 (PR #18)
cursor/visibility-access-todos-a008             (PR #17)
cursor/meeting-detail-db-a008                   (PR #16)
cursor/linking-db-query-upgrade-a008            (PR #15)
cursor/db-migration-seed-readiness-a008         (PR #14)
cursor/initiatives-db-promotion-a008            (PR #13)
cursor/meetings-db-promotion-a008               (PR #12)
cursor/cross-module-linking-a008                (PR #11)
cursor/governance-foundation-a008               (PR #10)
cursor/targets-progress-templates-a008          (PR #9)
cursor/fix-logout-flow-9e4a                     (PR #7)
cursor/sce-design-alignment-9e4a                (PR #6)
```

Action (after STAGE is canonical and contains all of `master`):
`git push origin --delete <branch>` for each. Their history is preserved
inside the merge commit on STAGE.

### 4.4 Audit branch

| Branch | Action |
|--------|--------|
| `cursor/source-of-truth-audit-1a2e` | This audit. Merge into `master` for record, then delete. Or leave open as the PR carrying this document. |

---

## 5. Vercel setting changes needed

To execute in Vercel **after** the catch‑up merge has landed in §6 and
been smoke‑tested on a STAGE deploy:

1. **Project → Settings → Git → Production Branch**
   - Today (assumed): `master`
   - Future option A (recommended): keep Production Branch = `master`,
     deploy to Production *only* via manual promote / explicit alias. STAGE
     branch continues to drive the STAGE environment.
   - Future option B (cleaner long‑term): set Production Branch = `STAGE`,
     drop `master` entirely. Requires aligning the GitHub default branch
     too. Do **not** do this until the team is comfortable that STAGE is
     stable.
2. **Project → Settings → Git → Ignored Build Step**
   - Add: `if [ "$VERCEL_GIT_COMMIT_REF" != "STAGE" ] && [ "$VERCEL_GIT_COMMIT_REF" != "master" ]; then exit 0; fi`
   - This prevents Vercel from spinning up preview deployments for every
     `cursor/*` branch (we have 36 of them today; most are stale).
3. **Project → Settings → Environment Variables**
   - Confirm STAGE env vars (`APP_ENV=stage`, `APP_BASE_URL`, …) are scoped
     to the STAGE environment and not bleeding into Production.
4. **Branch protection in GitHub** (not Vercel, but sibling change):
   - Protect `STAGE`: require PRs, disallow direct pushes, require ≥1
     review.
   - Protect `master`: require PRs, disallow direct pushes, **block merges
     except from `STAGE`** (post‑transition rule).

Until those are flipped, the only behavioural change Vercel needs is:
**point STAGE at the new merged tip of STAGE**. That happens automatically
on push, no dashboard action required.

---

## 6. Exact cleanup commands (review before running)

> All commands assume you start from a clean working tree on the
> `cursor/source-of-truth-audit-1a2e` branch (this PR's branch). Each phase
> ends in a push, so each phase is independently reviewable. Nothing here
> deletes or rewrites a remote branch.

### Phase A — make local match remote, freeze direct pushes

```bash
# 1. Snapshot everyone's working state.
git fetch --all --prune
git checkout master && git pull --ff-only
git checkout -B local/STAGE origin/STAGE   # local mirror, never pushed

# 2. (Human, GitHub UI) Lock direct pushes:
#    Settings → Branches → add protection rule:
#      - STAGE: require PR, require status checks, require linear history,
#               disallow force-push, disallow direct push.
#      - master: same, plus "restrict who can push" → empty.
```

### Phase B — bring `master` into `STAGE` (the actual reconciliation)

This is the destructive‑looking but correct step: it brings the 29 missing
commits (Targets / Governance / DB‑backed Meetings+Initiatives / Visibility
/ Audit / Templates / Org Builder + 12 prisma migrations) onto STAGE.

```bash
# Open a long-lived integration branch off STAGE.
git checkout -B cursor/stage-catchup-from-master-1a2e origin/STAGE

# Merge master in. Expect the 26-file conflict surface from §3.3.
git merge --no-ff origin/master \
  -m "merge: bring master governance/DB layer into STAGE (source-of-truth cleanup)"

# Resolve conflicts per §3.3 policy:
#   prisma/**          : take master ("theirs")
#   lib/permissions/** : take master, then layer STAGE label tweaks
#   app/(admin)/vereinsleitung/**, components/admin/vereinsleitung/** :
#                        manual UX merge — keep STAGE's PageShell/PageHeader
#                        polish, point handlers at the new DB-backed
#                        Meeting / Initiative APIs from master.
#   package.json       : combine deps; do not hand-edit lockfile
#   package-lock.json  : delete and regenerate via `npm install`

# Regenerate Prisma + verify migrations are linear.
npm install
npx prisma generate
npx prisma migrate status   # must show every master migration "applied" in shadow DB

# Build + lint smoke test.
npm run lint
npm run build

git add -A
git commit --amend --no-edit       # only if extra resolution edits
git push -u origin cursor/stage-catchup-from-master-1a2e

# Open PR: cursor/stage-catchup-from-master-1a2e  →  STAGE
# Once approved + green:
#   merge with "Create a merge commit" (NOT squash — we want master's
#   29 commits visible in STAGE history).
```

### Phase C — re‑point pending work at STAGE

```bash
# 1. (Human, GitHub UI) For every still-open PR (#1, #2, #3, #4, #5, #8 today):
#    Edit → change base branch from "master" to "STAGE".
#
# 2. Cursor cloud-agent default base: ask team to set the default base for
#    new cloud agents to "STAGE" in the Cursor Dashboard (Cloud Agents →
#    Defaults → Base Branch).
#
# 3. Repository default branch: leave "master" as GitHub default until
#    after Vercel Production policy is decided (§5.1). When ready:
#      Settings → Branches → Default branch → switch to STAGE.
```

### Phase D — archive the merged feature branches (only after Phase B is green on STAGE)

```bash
# 25 already-merged feature branches whose PRs are closed (§4.3).
for b in \
  cursor/dashboard-governance-deepening-82f0 \
  cursor/governance-hardening-sprint-82f0 \
  cursor/actor-context-hydration-a008 \
  cursor/org-builder-phase2-allowlist-a008 \
  cursor/org-builder-phase1-a008 \
  cursor/templates-rbac-dashboard-resolver-a008 \
  cursor/communication-template-foundation-a008 \
  cursor/meeting-sub-entities-v1-a008 \
  cursor/restricted-allowlist-picker-a008 \
  cursor/audit-logging-v1-a008 \
  cursor/four-eye-enforcement-v1-a008 \
  cursor/permissionmodule-rbac-v1-a008 \
  cursor/target-visibility-scope-a008 \
  cursor/governance-hardening-a008 \
  cursor/visibility-picker-ui-a008 \
  cursor/visibility-scope-v1-a008 \
  cursor/visibility-access-todos-a008 \
  cursor/meeting-detail-db-a008 \
  cursor/linking-db-query-upgrade-a008 \
  cursor/db-migration-seed-readiness-a008 \
  cursor/initiatives-db-promotion-a008 \
  cursor/meetings-db-promotion-a008 \
  cursor/cross-module-linking-a008 \
  cursor/governance-foundation-a008 \
  cursor/targets-progress-templates-a008 \
  cursor/fix-logout-flow-9e4a \
  cursor/sce-design-alignment-9e4a
do
  git push origin --delete "$b"
done
```

### Phase E — back‑merge cadence (recurring)

```bash
# Whenever master receives a hotfix:
git checkout STAGE && git pull --ff-only
git merge --no-ff origin/master -m "merge: master hotfix backport"
# Resolve, push, deploy via STAGE.
```

> All commands above are **proposals**. Per the user directive (`Do NOT
> delete branches yet unless explicitly asked` / `Do NOT overwrite STAGE
> yet unless explicitly asked`) Phases B–D are **not** executed in this
> audit PR.

---

## 7. Future workflow rules to prevent this recurring

These are the rules that, had they been enforced on 2026-04-19, would have
prevented the entire drift. Codify them in `AGENTS.md` and in GitHub
branch protection.

1. **One integration branch: `STAGE`.** Every change — human, Cursor agent,
   Bugbot, anything — lands on `STAGE` via PR. Period.
2. **No direct pushes to `STAGE` or `master`.** Enforce in GitHub branch
   protection ("Require a pull request before merging" + "Restrict who
   can push to matching branches" → empty allowlist).
3. **All PRs target `STAGE`.** Configure in:
   - GitHub: change default branch to `STAGE` once §5.1 is decided, so the
     PR template auto‑targets it.
   - Cursor Dashboard: Cloud Agents → set default base branch to `STAGE`.
4. **`master` is a downstream of `STAGE`, not a sibling.** The only commits
   that land on `master` are merge commits from `STAGE` (or from
   short‑lived `hotfix/*` branches that are immediately back‑merged into
   `STAGE`).
5. **Vercel STAGE auto‑deploys `STAGE`. Vercel Production deploys only
   from `master` and only via explicit promote.** Document this in
   `docs/deployment/`.
6. **Weekly cleanup pass**, automated:
   - List branches whose PRs are merged or closed > 14 days → delete.
   - List branches with no commits in 30 days → flag for archive.
   - Run `npx prisma migrate status` on STAGE; fail CI if drift detected.
7. **CI gate on schema drift.** Any PR that touches `prisma/schema.prisma`
   without adding a corresponding migration under `prisma/migrations/`
   fails the build. (Already partially in place via `npm run db:status`.)
8. **`.bak` / `.baseline-backups/` are forbidden in git.** Add to CI:
   ```bash
   if git diff --name-only origin/STAGE... | grep -E '(\.bak$|^\.baseline-backups/)'; then
     echo "::error::Backup artefacts must not be committed."; exit 1
   fi
   ```
9. **Document the model.** This document (`docs/source-of-truth-audit.md`)
   becomes the seed for `docs/deployment/branching-model.md` after Phase
   B lands.

---

## 8. Summary

- The drift is **real, large, and one‑shot fixable**: 324 product/UX
  commits on `STAGE`, 29 governance/DB commits on `master`, 0 cross‑merges
  in a month, 26 conflicting files, 12 prisma migrations only on `master`.
- **Canonical commit** = current `origin/STAGE` tip merged with
  `origin/master` (29 commits + their migrations), conflicts resolved per
  §3.3.
- **Nothing has been deleted, force‑pushed, or rewritten** by this audit.
  Only this document and the `cursor/source-of-truth-audit-1a2e` branch
  exist as a result.
- **Next gate:** human approval on this PR + on the conflict‑resolution
  policy in §3.3, then run Phase B in §6.
