/**
 * lib/website-builder/adapter.ts
 *
 * Adapter interface for the unified WebsiteBuilderClient.
 *
 * Both the Homepage Builder and the Page Builder implement this interface,
 * allowing WebsiteBuilderClient to be backend-agnostic.
 *
 * Homepage sections → HomepageSectionAdapter (homepage-adapter.ts)
 * Page sections     → PageSectionAdapter     (page-adapter.ts)
 */

import type { ContentRevisionItem } from "@/lib/cms/revision-engine";

// ---------------------------------------------------------------------------
// Common section shape
// ---------------------------------------------------------------------------

/**
 * Minimal section type shared by both HomepageSection and WebsitePageSection.
 * All fields must be provided by every adapter.
 */
export type SectionItem = {
  id: string;
  type: string;
  label: string;
  sortOrder: number;
  isEnabled: boolean;
  config: Record<string, unknown>;
  publishStatus: string;
  approvalStatus: string;
  scheduledPublishAt: Date | string | null;
};

/** Normalised preview section — used by the PreviewPanel. */
export type PreviewSectionItem = {
  id: string;
  type: string;
  label: string;
  sortOrder: number;
  isEnabled: boolean;
  publishStatus: string;
  approvalStatus: string;
  config: Record<string, unknown>;
  block: { displayName: string; description: string; category: string } | null;
};

// ---------------------------------------------------------------------------
// Capabilities
// ---------------------------------------------------------------------------

/**
 * Feature flags for the builder UI.
 * Adapters set these to reflect what the underlying backend supports.
 */
export type SectionCapabilities = {
  /** Whether the "Add section" panel is shown. */
  canCreate: boolean;
  /** Whether the delete button is shown. */
  canDelete: boolean;
  /** Whether the duplicate button is shown. */
  canDuplicate: boolean;
  /** Whether native drag-and-drop reorder is enabled. */
  canDragReorder: boolean;
  /** Whether the revision history panel is shown. */
  hasRevisions: boolean;
};

// ---------------------------------------------------------------------------
// Adapter interface
// ---------------------------------------------------------------------------

/**
 * Backend adapter for WebsiteBuilderClient.
 *
 * All methods map to HTTP calls against the section-specific API.
 * The builder calls these methods and never hardcodes endpoint paths.
 */
export interface SectionAdapter {
  /** Load all sections in sort order. */
  load(): Promise<SectionItem[]>;

  /** Create a new section (throws if canCreate = false). */
  create(
    type: string,
    label: string,
    config: Record<string, unknown>,
  ): Promise<SectionItem>;

  /** Save section label + config, returns the updated section. */
  saveConfig(
    id: string,
    label: string,
    config: Record<string, unknown>,
  ): Promise<SectionItem>;

  /** Toggle section enabled/disabled. */
  toggle(id: string): Promise<SectionItem>;

  /** Move section up or down; returns the re-ordered sections array. */
  move(id: string, direction: "up" | "down"): Promise<SectionItem[]>;

  /** Delete section (throws if canDelete = false). */
  delete(id: string): Promise<void>;

  /** Duplicate section (throws if canDuplicate = false). */
  duplicate(id: string): Promise<SectionItem>;

  /**
   * Reorder sections via drag-and-drop.
   * Returns the re-ordered sections array.
   * Throws if canDragReorder = false.
   */
  reorder(orderedIds: string[]): Promise<SectionItem[]>;

  /**
   * Execute a workflow action (publish, unpublish, schedule, request-review,
   * approve, reject).
   */
  workflow(
    id: string,
    action: string,
    extra?: Record<string, unknown>,
  ): Promise<SectionItem>;

  /** Fetch revision history (returns [] if hasRevisions = false). */
  getRevisions(id: string): Promise<ContentRevisionItem[]>;

  /** Restore a revision; returns updated section. */
  restoreRevision(id: string, revId: string): Promise<SectionItem>;

  /** Load sections for the preview panel (always includes drafts). */
  loadPreview(): Promise<PreviewSectionItem[]>;

  /**
   * Optional: bootstrap default sections when none exist.
   * Only supplied by the homepage adapter.
   */
  bootstrap?: () => Promise<SectionItem[]>;

  /** What the builder can do. Drives conditional UI rendering. */
  capabilities: SectionCapabilities;

  /** Human-readable title shown in the preview panel header. */
  contextTitle: string;

  /** Slug shown in the preview panel header. */
  contextSlug: string;
}
