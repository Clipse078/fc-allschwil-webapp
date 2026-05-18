/**
 * Cross-Module Linking Foundation
 *
 * Phase 1: lightweight JSON refs stored on Target.linkedInitiativeRefs /
 * Target.linkedMeetingRefs. Each ref is an EntityRef object.
 *
 * Phase 2 migration path: when Meetings and Initiatives are promoted to
 * DB-backed Prisma models, replace these JSON fields with proper FK
 * relations and junction tables (TargetInitiative, TargetMeeting).
 * The JSON shape below is designed to be forward-compatible.
 *
 * --- Architecture TODOs (Cross-Module Linking Phase 2+) ---
 *
 * TODO: auto-generated metrics
 *   - Training planner sessions → TargetMetric data points automatically
 *     when a Target has moduleKey="training" and the planner logs session counts.
 *   - Media module publish events → "news frequency" metric auto-update.
 *   - Sponsor module deals → "sponsoring" metric auto-update.
 *   - Pattern: each operational module emits a "metric contribution event"
 *     that the Target system processes asynchronously.
 *
 * TODO: operational traceability
 *   - Meeting outcomes → linked Target progress notes.
 *   - Decision records in meetings should be traceable to the Target they serve.
 *   - Initiative completion → Target metric snapshot on close.
 *
 * TODO: initiative contribution scoring
 *   - Each Initiative linked to a Target contributes a weighted score
 *     toward Target progress (e.g. "Website Relaunch" is 30% of Media Target).
 *   - Aggregate contribution score displayed on Target detail as secondary
 *     progress signal alongside direct metric data points.
 *
 * TODO: meeting outcome integration
 *   - Meeting action items that reference a Target should surface on the
 *     Target detail page as "open actions".
 *   - Decision records from meetings auto-append to Target nudgeJson.
 *
 * TODO: module-driven nudges
 *   - Linked modules should be able to push nudge payloads to a Target's
 *     nudgeJson when they detect stall or risk conditions.
 *   - Example: if a linked Initiative is overdue, add a nudge to all
 *     parent Targets suggesting a review.
 *
 * TODO: AI recommendation layer
 *   - Analyse cross-link graph to recommend: "This Target has 0 linked
 *     Initiatives — consider creating one to operationalise it."
 *   - Surface unlinkable orphan entities: Initiatives with no Target parent.
 *   - Recommend metric baselines based on club category and template matches.
 *   - Suggest Meeting agenda items based on SUBMITTED/stalled Targets.
 */

export type LinkableModule = "targets" | "initiatives" | "meetings";

/** A lightweight reference to an entity in another module. */
export type EntityRef = {
  /** Slug or cuid — unique identifier within the target module. */
  slug: string;
  /** Human-readable display title for UI. */
  title: string;
  /**
   * Optional resolved URL for direct navigation.
   * Populated at render time from slug + known route pattern.
   */
  url?: string;
};

/** The full cross-link payload stored as JSON on a Target row. */
export type TargetCrossLinks = {
  initiativeRefs: EntityRef[];
  meetingRefs: EntityRef[];
};
