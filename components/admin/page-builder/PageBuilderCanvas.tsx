"use client";

/**
 * components/admin/page-builder/PageBuilderCanvas.tsx
 *
 * Admin-only canvas adapter for Website Page Builder (Slice I — Page Builder Parity).
 *
 * Bridges PageSectionAdminItem[] to HomepageCanvas, which expects
 * HomepageSectionAdminItem[]. Both types are structurally compatible:
 *   - PageSectionAdminItem is a strict superset of HomepageSectionAdminItem
 *   - ApprovalStatus === SectionApprovalStatus (same string literals, see approval-constants.ts)
 *   - Extra page-specific fields (pageId, publishUntil) are ignored by canvas components
 *
 * This adapter does NOT modify HomepageCanvas or any Homepage Builder component.
 * Public website output is unaffected.
 */

import type { PageSectionAdminItem } from "@/lib/page-sections/admin-queries";
import type { HomepageSectionAdminItem } from "@/lib/homepage/admin-queries";
import { HomepageCanvas } from "@/components/admin/homepage-builder/HomepageCanvas";

// ---------------------------------------------------------------------------
// Type adapter
// ---------------------------------------------------------------------------

/**
 * Structural cast: PageSectionAdminItem satisfies every field that
 * HomepageCanvas / HomepageCanvasSection reads at runtime.
 *
 * Safety reasoning:
 *   1. PageSectionAdminItem has all fields HomepageSectionAdminItem defines.
 *   2. ApprovalStatus is a re-export alias of SectionApprovalStatus (same string union).
 *   3. config is Record<string, unknown> at runtime in both types.
 *   4. Extra fields (pageId, publishUntil) are not accessed by canvas components.
 */
function adaptSection(s: PageSectionAdminItem): HomepageSectionAdminItem {
  return s as unknown as HomepageSectionAdminItem;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type PageBuilderCanvasProps = {
  sections: PageSectionAdminItem[];
  selectedId: string | null;
  actionPending: string | null;
  isAnyPending: boolean;
  onSelectSection: (id: string) => void;
  onDeselectSection: () => void;
  onToggle: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  /** Publishes a section via the page-sections workflow API. */
  onPublish: (id: string) => void;
  /** Unpublishes a section via the page-sections workflow API. */
  onUnpublish: (id: string) => void;
  onStartEdit: (id: string) => void;
  onReorder: (orderedIds: string[]) => Promise<void>;
  onDuplicate: (id: string) => void;
  /** Caller must confirm before calling — canvas delegates confirmation. */
  onDelete: (id: string) => void;
  onSaveAsReusable?: (id: string) => void;
  reorderPending?: boolean;
  reorderError?: string | null;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Canvas mode for Website Page Builder.
 *
 * Renders sections using the shared HomepageCanvas component via a
 * structural type adapter. Inherits all canvas capabilities:
 *   - HTML5 drag-and-drop reordering with insertion lines
 *   - Desktop / Tablet / Mobile viewport toggle (admin preview only)
 *   - Section selection with floating toolbar
 *   - Inline quick-action strip on hover
 *   - Keyboard navigation (Arrow keys, Ctrl+Arrow reorder, Escape deselect)
 *   - Accessible live region for move announcements
 */
export function PageBuilderCanvas({ sections, ...rest }: PageBuilderCanvasProps) {
  const adaptedSections = sections.map(adaptSection);

  return (
    <HomepageCanvas
      sections={adaptedSections}
      {...rest}
    />
  );
}
