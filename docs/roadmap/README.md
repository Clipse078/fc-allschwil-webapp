# SportClubEvo Roadmap Documentation

> This folder contains the complete product and engineering documentation for SportClubEvo.  
> Start here if you are new to the project.

---

## Document Index

| File | Description |
|---|---|
| [00-product-blueprint.md](./00-product-blueprint.md) | Product vision, mission, target users, MVP definition, locked decisions, non-negotiable rules, quality gates |
| [01-roadmap.md](./01-roadmap.md) | Current release focus, agreed 9-phase execution sequence, epic summaries, post-v1 summary |
| [02-go-live-checklist.md](./02-go-live-checklist.md) | Go-live readiness checklist — Infrastructure, Database, Security, Tenant Isolation, Auth, Public API, Website, InfoBoard, Planner, Documentation, Testing, Deployment, Smoke Testing, Rollback, Customer Validation |
| [03-technical-debt.md](./03-technical-debt.md) | Technical debt register — known gaps, missing decisions, and items to resolve before go-live |
| [04-release-history.md](./04-release-history.md) | Release changelog — v0.x development history, v1.0 planned release, template for future releases |
| [05-architecture-decisions.md](./05-architecture-decisions.md) | ADR log — 12 accepted architecture decisions (Season as leading entity, multi-tenant, API versioning, STAGE anti-drift, and more) |
| [06-engineering-principles.md](./06-engineering-principles.md) | Engineering standards — API-first, tenant-safe queries, server-side permissions, shared components, audit logging, STAGE workflow, auth safety rule |
| [07-module-dependencies.md](./07-module-dependencies.md) | Module dependency map — execution order from Org Builder → Permissions → People → Teams → Seasons → Planner → Website → InfoBoard → Mobile |
| [08-post-v1-ideas.md](./08-post-v1-ideas.md) | Collected post-v1 modules — Training Designer, Finance, Polls, Volunteer Management, Analytics, i18n, Marketplace, and more |
| [sportclubevo-v1-master-backlog.md](./sportclubevo-v1-master-backlog.md) | **Master Backlog** — detailed feature backlog, 90-row status table, living progress checklist. This is the source of truth for feature scope and status. |

---

## Navigation Guide

**New to the project?** Start with `00-product-blueprint.md` to understand what SportClubEvo is and why it exists.

**Planning work?** Use `01-roadmap.md` for the execution sequence and `sportclubevo-v1-master-backlog.md` for feature-level status.

**Preparing for go-live?** Work through `02-go-live-checklist.md` section by section.

**Found a technical debt item?** Add it to `03-technical-debt.md`.

**Making an architectural decision?** Add an ADR to `05-architecture-decisions.md`.

**Thinking about a post-v1 feature?** Add it to `08-post-v1-ideas.md` — do not add it to the v1 backlog.

---

## Backlog Source of Truth

`sportclubevo-v1-master-backlog.md` is the **detailed backlog source of truth**.  
It contains the complete feature list, status for every item, priority, release target, and the living progress checklist.  
All other documents in this folder reference it — they do not duplicate it.
