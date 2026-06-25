# SportClubEvo Post-v1 Ideas

> **Document type:** Post-v1 ideas and deferred modules  
> **Status:** Active — collected and deferred; not in v1.0 scope  
> **Last updated:** 2026-06-25  
> **Maintained by:** SportClubEvo product team

---

## Purpose

This document collects all features and modules that are explicitly deferred to after the first commercial release of SportClubEvo (v1.0). Nothing in this document is in scope for v1.0.

This list exists so that:

1. Architectural decisions made during v1.0 development remain compatible with future needs.
2. Product conversations about post-v1 capabilities have a single reference point.
3. No post-v1 item is accidentally prioritised into the v1 release.

Items may be promoted to the main backlog (`sportclubevo-v1-master-backlog.md`) only after v1.0 has gone live and a new planning session has confirmed the priority.

---

## Deferred Modules

### Mobile Expansion

**What:** Capabilities beyond the MVP mobile app — advanced trainer tools, player-facing features, video content, integration with wearables or performance tracking devices.

**Why deferred:** The MVP mobile app (Epic 5) must prove adoption before expanding scope.

**Dependencies:** Mobile App MVP (Epic 5) stable and in daily use by at least one tenant.

---

### Training Designer

**What:** A tool for trainers to design structured training sessions — drills, exercises, time blocks, equipment required. Sessions can be assigned to teams and linked to calendar events.

**Why deferred:** Requires the Exercise Library to be defined first. Also requires a clear picture of trainer adoption from the MVP mobile app.

**Dependencies:** People, Teams, Seasons, Events, Exercise Library.

---

### Exercise Library

**What:** A catalogue of exercises and drills, managed at both the platform level (shared across tenants) and the tenant level (club-specific exercises). Exercises are tagged, searchable, and linkable to training sessions.

**Why deferred:** Requires content strategy (who creates and maintains the library?) before schema design.

**Dependencies:** People, Teams (which exercises apply to which age/level groups).

---

### Finance / ClubFinance

**What:** Membership fee management, invoice generation, QR-bill support (Swiss payment standard), sponsorship billing, and financial reporting for club administrators.

**Why deferred:** Requires new schema models (`Membership`, `Invoice`, `Sponsor` upgrade) and payment rail decisions. Also requires legal/compliance review for Swiss financial data handling.

**Dependencies:** People, Sponsors (upgraded model), Memberships, QR-bill configuration.

**Open Question:** Should Finance be a first-party SportClubEvo module or an integration with an existing accounting tool (e.g. Banana Accounting, Bexio)?

---

### Polls

**What:** Structured polls for club members — training time preference votes, event participation surveys, governance votes (e.g. AGM pre-votes).

**Why deferred:** Nice-to-have; mobile app adoption must be established first to make polls meaningful.

**Dependencies:** People, Teams, Communication model, Mobile App (for reach).

---

### Volunteer Management

**What:** Track and coordinate club volunteers — roles, availability, event assignments, hour tracking.

**Why deferred:** Requires a volunteer availability model that does not exist in the current schema.

**Dependencies:** People, Events, Organisation Builder (volunteer groups as OrgUnits).

---

### Sponsor Portal / Business Club Expansion

**What:** A dedicated portal for sponsors to view their brand exposure, manage their content (logo, description, website link), and receive reports. Business Club module for premium sponsor tiers.

**Why deferred:** Requires a `Sponsor` model upgrade (currently sponsors exist as InfoBoard/website content, not as first-class entities with portal access).

**Dependencies:** Tenant branding, Website publishing, InfoBoard, Finance (sponsor invoicing).

---

### Player Development

**What:** Track individual player progress over time — skill assessments, coach notes, development goals, milestone achievements. Visible to trainers and (with permission) to parents.

**Why deferred:** Requires a defined assessment framework per sport/age group before schema design is meaningful.

**Dependencies:** People, Teams, Seasons, Training Designer (assessment can link to training sessions).

---

### Ratings

**What:** Structured player and performance ratings after matches or training sessions. Aggregated over a season for team selection and development tracking.

**Why deferred:** Sensitive feature (rated individuals must consent / be protected). Requires a clear permission and visibility model before implementation.

**Dependencies:** People, Teams, Seasons, Events (ratings are per-event), Player Development.

---

### Career History

**What:** Long-term player career record — clubs played for, seasons, positions, milestones. Portable, player-owned record.

**Why deferred:** Requires data portability and privacy model decisions that are out of scope for v1.0.

**Dependencies:** People, Teams, Seasons, Player Development.

---

### Equipment Inventory

**What:** Track club equipment — bibs, balls, goals, medical kits. Assign equipment to teams, events, and storage locations. Track condition and replacement cycles.

**Why deferred:** Useful but not operationally critical for the FC Allschwil go-live.

**Dependencies:** Facilities (`FacilityResource` model is the closest current model; may need an `Equipment` model extension), Teams, Events.

---

### Communication Automation

**What:** Automated, template-driven communication — reminder emails for upcoming matches, absence notifications, registration confirmations, newsletter dispatch. The `CommunicationTemplate` model already exists.

**Why deferred:** The `CommunicationTemplate` model is in place. The full dispatch pipeline (email provider integration, delivery tracking, unsubscribe management) is post-v1.

**Dependencies:** People, Teams, Events, Mobile Backend (push dispatch), `CommunicationTemplate` (foundation already in place).

**Open Question:** Which email delivery provider (e.g. Postmark, Resend, SendGrid)?

---

### Smart System Nudging

**What:** Proactive in-app nudges — "3 players have not confirmed attendance for Saturday's match", "Week Plan has not been published for next week", "Team has no trainer assigned for the upcoming season". Surfaced in the dashboard and optionally via push notification.

**Why deferred:** Requires a robust event-driven architecture and a well-defined nudge rule engine. Better designed after v1.0 usage patterns are understood.

**Dependencies:** Events, Planner, Teams, People, Communication Automation, Mobile Backend.

---

### Analytics and KPI Reporting

**What:** In-app analytics for club administrators — attendance trends, registration conversion rates, website traffic, team performance summaries. The `Target`/`TargetMetric`/`TargetDataPoint` models already exist for KPI tracking.

**Why deferred:** KPI model foundation is in place. Full analytics dashboard (charts, filters, export) is post-v1.

**Dependencies:** Targets & KPIs (foundation already in place), Events, Teams, Seasons.

---

### Google Analytics Integration

**What:** Embed GA4 tracking in tenant public pages (public website and InfoBoard) for web analytics.

**Why deferred:** Requires GDPR/privacy compliance review for Swiss tenants before implementation.

**Dependencies:** Website publishing, Tenant configuration (GA property ID per tenant).

---

### Google Search Console Integration

**What:** Surface search performance data (impressions, clicks, average position) for tenant websites inside SportClubEvo.

**Why deferred:** Value depends on tenant SEO maturity; not relevant at MVP stage.

**Dependencies:** Website publishing, Google API authentication.

---

### Microsoft Clarity Integration

**What:** Heatmap and session recording for UX improvement of the WebApp admin interface.

**Why deferred:** Privacy implications must be reviewed before deploying session recording tools.

**Dependencies:** Tenant configuration.

---

### Federation Adapters at Scale

**What:** Direct integrations with additional football and sports federation APIs beyond FVNWS/Clubcorner — SFV, FFBSO, cantonal associations. Automated fixture import, player data sync, result submission.

**Why deferred:** The adapter architecture (ADR-008) is in place. Expanding to new federations requires federation API access agreements and adapter development per federation.

**Dependencies:** Event import adapter architecture, Teams, Seasons.

---

### Dedicated Tenant Apps

**What:** White-label mobile apps branded per tenant (e.g. "FC Allschwil App") deployed to App Store / Google Play as separate apps. Complementary to or replacing the shared SportClubEvo app for premium tenants.

**Why deferred:** Requires the shared mobile app (Epic 5) to prove the concept first. White-labelling adds App Store management complexity.

**Dependencies:** Mobile App MVP (Epic 5) stable, Tenant branding.

---

### Marketplace

**What:** A SportClubEvo marketplace where clubs can discover and activate third-party integrations — ticketing systems, live streaming platforms, equipment suppliers, insurance providers.

**Why deferred:** Requires a platform maturity and a partner ecosystem that does not exist yet.

**Dependencies:** Multi-tenant architecture stable, Tenant onboarding (self-service), Billing.

---

### Tenant Self-Service Onboarding

**What:** A self-service flow for new sports clubs to sign up, configure their tenant, and start using SportClubEvo without platform admin involvement.

**Why deferred:** Manual onboarding is sufficient for the initial tenant set. Self-service adds significant product and engineering complexity (billing, legal, support automation).

**Dependencies:** Tenant model, Billing, Subscription management.

---

### Billing and Subscription Management

**What:** Subscription invoicing, plan management (upgrade/downgrade/cancel), payment handling for tenant subscriptions.

**Why deferred:** Revenue model and pricing tiers are not finalised for v1.0. FC Allschwil is the pilot tenant.

**Dependencies:** Tenant model, Finance.

---

### Internationalisation (i18n)

**What:** UI language switching (German, French, Italian, English as minimum for Swiss market). Multi-language content support — news and pages in multiple languages.

**Why deferred:** FC Allschwil operates in German. i18n adds significant development overhead and a content management layer for translated content.

**Dependencies:** All UI components (all labels must be externalised), Website CMS (multi-language pages and news).

**Note:** The German UI labels currently used throughout the admin navigation are acceptable for v1.0 but will need to be externalised before i18n can be implemented.

---

## Adding New Post-v1 Ideas

To add a new post-v1 idea:

1. Add an entry to this document following the template above.
2. Do **not** add it to `sportclubevo-v1-master-backlog.md` as a planned v1.0 item.
3. When the idea is ready for scoping, open a product discussion and — if approved — add it to the master backlog with a `Post-v1` status and a specific target release.
