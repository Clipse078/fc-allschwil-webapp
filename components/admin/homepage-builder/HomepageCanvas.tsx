"use client";

import type { HomepageSectionAdminItem } from "@/lib/homepage/admin-queries";
import { HomepageCanvasSection } from "./HomepageCanvasSection";
import { HomepageCanvasEmptyState } from "./HomepageCanvasEmptyState";

// ---------------------------------------------------------------------------
// Props — handlers receive id so the canvas can pre-bind per section,
// matching the same pattern used in HomepageBuilderWorkspace for the list view.
// ---------------------------------------------------------------------------

type Props = {
  sections: HomepageSectionAdminItem[];
  selectedId: string | null;
  actionPending: string | null;
  isAnyPending: boolean;
  onBootstrap?: () => void;
  bootstrapping?: boolean;
  onSelectSection: (id: string) => void;
  onToggle: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onPublish: (id: string) => void;
  onUnpublish: (id: string) => void;
  onStartEdit: (id: string) => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HomepageCanvas({
  sections,
  selectedId,
  actionPending,
  isAnyPending,
  onBootstrap,
  bootstrapping,
  onSelectSection,
  onToggle,
  onMoveUp,
  onMoveDown,
  onPublish,
  onUnpublish,
  onStartEdit,
}: Props) {
  if (sections.length === 0) {
    return (
      <HomepageCanvasEmptyState
        onBootstrap={onBootstrap}
        bootstrapping={bootstrapping}
      />
    );
  }

  return (
    <div
      className="p-5 space-y-1"
      role="list"
      aria-label="Homepage-Sektionen (Canvas)"
    >
      {sections.map((section, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === sections.length - 1;
        const isSelected = selectedId === section.id;
        const isPending =
          actionPending === section.id ||
          actionPending === `${section.id}-up` ||
          actionPending === `${section.id}-down` ||
          actionPending === `${section.id}-publish` ||
          actionPending === `${section.id}-unpublish` ||
          actionPending === `${section.id}-request-review`;

        return (
          <div key={section.id} role="listitem">
            <HomepageCanvasSection
              section={section}
              index={idx}
              isFirst={isFirst}
              isLast={isLast}
              isSelected={isSelected}
              isPending={isPending}
              isAnyPending={isAnyPending}
              onSelect={() => onSelectSection(section.id)}
              onToggle={() => onToggle(section.id)}
              onMoveUp={() => onMoveUp(section.id)}
              onMoveDown={() => onMoveDown(section.id)}
              onPublish={() => onPublish(section.id)}
              onUnpublish={() => onUnpublish(section.id)}
              onStartEdit={() => onStartEdit(section.id)}
            />
          </div>
        );
      })}

      <div className="pt-3 pb-1 text-center">
        <p className="text-[11px] text-[var(--muted)] italic">
          Canvas Mode · Drag &amp; Drop folgt in Slice E
        </p>
      </div>
    </div>
  );
}
