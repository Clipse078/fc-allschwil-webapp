/**
 * lib/reusable-components/types.ts
 *
 * Shared TypeScript types for the Reusable Component system (CMS V2 Slice 12).
 *
 * This file has NO server-side imports — safe in both Server and Client Components.
 */

import type {
  SectionPublishStatus,
  SectionApprovalStatus,
} from "@/lib/cms/section-publishing";

// ---------------------------------------------------------------------------
// Core admin item (returned by all list/get queries)
// ---------------------------------------------------------------------------

export type ReusableComponentAdminItem = {
  id: string;
  tenantId: string;
  type: string;
  title: string;
  slug: string;
  description: string | null;
  config: Record<string, unknown>;

  // Publishing
  publishStatus: SectionPublishStatus;
  publishedAt: Date | null;
  unpublishedAt: Date | null;
  lastPublishedAt: Date | null;
  scheduledPublishAt: Date | null;

  // Approval
  approvalStatus: SectionApprovalStatus;
  reviewerUserId: string | null;
  reviewRequestedAt: Date | null;
  reviewedAt: Date | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  approvalNote: string | null;
  approvedByUserId: string | null;
  rejectedByUserId: string | null;

  // Lifecycle
  createdByUserId: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;

  // Eager-loaded relations (optional)
  createdByUser?: { firstName: string; lastName: string } | null;
  approvedByUser?: { firstName: string; lastName: string } | null;
};

// ---------------------------------------------------------------------------
// Usage item
// ---------------------------------------------------------------------------

export type ReusableComponentUsageItem = {
  id: string;
  entityType: string;
  entityId: string;
  fieldPath: string;
  createdAt: Date;
  label: string;
  href: string | undefined;
};

// ---------------------------------------------------------------------------
// List query filters
// ---------------------------------------------------------------------------

export type ListReusableComponentsFilter = {
  type?: string;
  publishStatus?: string;
  includeArchived?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
};

// ---------------------------------------------------------------------------
// Mutation inputs
// ---------------------------------------------------------------------------

export type CreateReusableComponentInput = {
  type: string;
  title: string;
  slug?: string;
  description?: string;
  config?: Record<string, unknown>;
  createdByUserId?: string;
};

export type UpdateReusableComponentInput = {
  title?: string;
  slug?: string;
  description?: string;
  config?: Record<string, unknown>;
};
