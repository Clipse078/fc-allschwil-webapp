/**
 * lib/cms/inspector-types.ts
 *
 * Shared inspector data types used by InspectorPanel.
 *
 * Both HomepageSectionAdminItem and PageSectionAdminItem are adapted to
 * InspectorSectionData before being passed to the InspectorPanel, so the
 * inspector has no knowledge of section-specific API shapes.
 *
 * All API calls are abstracted into callback bundles that callers provide.
 * The inspector renders buttons only for callbacks that are defined.
 */

import type { ContentRevisionItem } from "@/lib/cms/revision-engine";

// ---------------------------------------------------------------------------
// Generic section shape
// ---------------------------------------------------------------------------

/**
 * Minimal section data consumed by InspectorPanel.
 * Both HomepageSectionAdminItem and PageSectionAdminItem are compatible with
 * this shape (both have all these fields).
 */
export type InspectorSectionData = {
  id: string;
  type: string;
  label: string;
  isEnabled: boolean;
  config: Record<string, unknown>;
  /** "DRAFT" | "PUBLISHED" */
  publishStatus: string;
  /** "NOT_REQUIRED" | "DRAFT" | "IN_REVIEW" | "APPROVED" | "CHANGES_REQUESTED" */
  approvalStatus: string;
  scheduledPublishAt: Date | null;
};

// ---------------------------------------------------------------------------
// Workflow callbacks
// ---------------------------------------------------------------------------

/**
 * Abstract workflow action callbacks passed to InspectorPanel.
 * Each callback, when defined, causes the corresponding button to appear.
 * Each returns the updated section (after the API call succeeds).
 */
export type InspectorWorkflowCallbacks = {
  publish?: () => Promise<InspectorSectionData>;
  unpublish?: () => Promise<InspectorSectionData>;
  requestReview?: () => Promise<InspectorSectionData>;
  /** approve may carry an optional note (for homepage approval flow). */
  approve?: (note?: string) => Promise<InspectorSectionData>;
  /** reject may carry an optional note. */
  reject?: (note?: string) => Promise<InspectorSectionData>;
  schedule?: (isoDate: string) => Promise<InspectorSectionData>;
};

// ---------------------------------------------------------------------------
// Revision callbacks
// ---------------------------------------------------------------------------

/**
 * Optional revision history callbacks.
 * When omitted (e.g. for homepage sections), the Publishing section
 * hides the revision history area.
 */
export type InspectorRevisionCallbacks = {
  loadRevisions: () => Promise<ContentRevisionItem[]>;
  restore: (revId: string) => Promise<InspectorSectionData>;
};

// ---------------------------------------------------------------------------
// Adapter helpers
// ---------------------------------------------------------------------------

/**
 * Adapt a PageSectionAdminItem-shaped object to InspectorSectionData.
 * Keeps only the fields InspectorPanel cares about.
 */
export function adaptToInspectorData(section: {
  id: string;
  type: string;
  label: string;
  isEnabled: boolean;
  config: Record<string, unknown>;
  publishStatus: string;
  approvalStatus: string;
  scheduledPublishAt: Date | null;
}): InspectorSectionData {
  return {
    id: section.id,
    type: section.type,
    label: section.label,
    isEnabled: section.isEnabled,
    config: section.config,
    publishStatus: section.publishStatus,
    approvalStatus: section.approvalStatus,
    scheduledPublishAt: section.scheduledPublishAt,
  };
}
