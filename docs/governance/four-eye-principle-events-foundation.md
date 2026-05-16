# Four-Eye Principle — Events Foundation

## Current state
The current Events domain still performs direct writes through API mutation routes.

Observed direct-write routes include:
- `app/api/events/route.ts` -> create event
- `app/api/events/import/route.ts` -> import events into live event records

These are currently audited, but not yet review-gated.

---

## Decision
Events are the first domain to move to a formal four-eye workflow.

Reason:
- Events feed Website
- Events feed Wochenplan
- Events feed Infoboard
- Events influence operational club communication

Because of this, direct create/update/delete is no longer the target model.

---

## Phase 1 foundation introduced now
We introduced policy-layer definitions only:
- shared review policy types
- event-specific review policy map
- no runtime behavior change yet
- no Prisma schema change yet
- no UI breakage

This is intentionally non-destructive.

---

## Target event workflow
Target model for event mutations:

1. Creator creates or edits event
2. Event enters review workflow
3. Reviewer approves or rejects
4. Only approved events may be published to downstream channels

Suggested stages:
- `draft`
- `submitted`
- `approved`
- `rejected`
- `published`

---

## Publish governance
The following targets must not allow uncontrolled direct publishing:
- Website
- Infoboard

Recommended principle:
- creation/editing can be done by creator role
- approval must be done by another authorized role
- publishing only after approval

---

## Next implementation step
Next safe implementation step:
1. extend event persistence model with review workflow fields
2. keep existing reads backward-compatible
3. convert event create flow from direct active creation to review submission
4. introduce reviewer actions separately after that

Do not retrofit all domains at once.
Start with Events only.
