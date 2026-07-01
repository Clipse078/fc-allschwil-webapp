"use client";

import { useState, useRef, useCallback } from "react";
import { AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import type { HomepageSectionAdminItem } from "@/lib/homepage/admin-queries";
import { HomepageCanvasSection } from "./HomepageCanvasSection";
import { HomepageCanvasEmptyState } from "./HomepageCanvasEmptyState";

// ---------------------------------------------------------------------------
// Insertion line — rendered between sections during drag
// ---------------------------------------------------------------------------

function InsertionLine({ isActive }: { isActive: boolean }) {
  return (
    <div
      className="relative mx-1 h-2 flex items-center pointer-events-none select-none"
      aria-hidden="true"
    >
      <div
        className={[
          "absolute inset-x-0 h-[2px] rounded-full transition-all duration-100 origin-center",
          isActive ? "opacity-100 scale-x-100" : "opacity-0 scale-x-95",
        ].join(" ")}
        style={{ background: "var(--sce-primary)" }}
      />
      <div
        className={[
          "absolute left-0 h-3 w-3 -translate-x-0.5 rounded-full border-2 bg-[var(--surface)] transition-opacity duration-100",
          isActive ? "opacity-100" : "opacity-0",
        ].join(" ")}
        style={{ borderColor: "var(--sce-primary)" }}
      />
      <div
        className={[
          "absolute right-0 h-3 w-3 translate-x-0.5 rounded-full border-2 bg-[var(--surface)] transition-opacity duration-100",
          isActive ? "opacity-100" : "opacity-0",
        ].join(" ")}
        style={{ borderColor: "var(--sce-primary)" }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
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
  onReorder: (orderedIds: string[]) => Promise<void>;
  reorderPending?: boolean;
  reorderError?: string | null;
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
  onReorder,
  reorderPending,
  reorderError,
}: Props) {
  // ── DnD state (refs for synchronous access + state for rendering) ─────────
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  // Refs always hold the latest value — prevents stale-closure bugs in
  // drag event handlers that fire before React can flush state updates.
  const draggedIdRef = useRef<string | null>(null);
  const dropIndexRef = useRef<number | null>(null);

  // ── Aria live announcement ─────────────────────────────────────────────────
  const [announcement, setAnnouncement] = useState("");

  // ── Refs for keyboard focus management ────────────────────────────────────
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // ── DnD helpers ───────────────────────────────────────────────────────────

  const updateDraggedId = useCallback((id: string | null) => {
    draggedIdRef.current = id;
    setDraggedId(id);
  }, []);

  const updateDropIndex = useCallback((idx: number | null) => {
    dropIndexRef.current = idx;
    setDropIndex(idx);
  }, []);

  const handleDragStart = useCallback(
    (id: string) => {
      updateDraggedId(id);
      updateDropIndex(null);
    },
    [updateDraggedId, updateDropIndex],
  );

  const handleDragEnd = useCallback(() => {
    updateDraggedId(null);
    updateDropIndex(null);
  }, [updateDraggedId, updateDropIndex]);

  const handleSectionDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>, idx: number, sectionId: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      // Use ref (synchronous) — state may lag behind on the first dragover
      // event that fires before React flushes the dragstart state update.
      if (draggedIdRef.current === null || draggedIdRef.current === sectionId) {
        return;
      }
      const rect = e.currentTarget.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      updateDropIndex(e.clientY < midY ? idx : idx + 1);
    },
    [updateDropIndex],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      // Read from ref for latest values (avoids stale-closure issues).
      const currentDraggedId =
        draggedIdRef.current ?? e.dataTransfer.getData("text/plain") ?? null;
      const currentDropIndex = dropIndexRef.current;

      if (!currentDraggedId || currentDropIndex === null) {
        handleDragEnd();
        return;
      }

      const draggedIdx = sections.findIndex((s) => s.id === currentDraggedId);
      if (draggedIdx < 0) {
        handleDragEnd();
        return;
      }

      const rest = sections.filter((s) => s.id !== currentDraggedId);
      let insertIdx =
        currentDropIndex > draggedIdx ? currentDropIndex - 1 : currentDropIndex;
      insertIdx = Math.max(0, Math.min(rest.length, insertIdx));

      const newSections = [
        ...rest.slice(0, insertIdx),
        sections[draggedIdx],
        ...rest.slice(insertIdx),
      ];

      const newOrderIds = newSections.map((s) => s.id);
      const currentOrderIds = sections.map((s) => s.id);

      handleDragEnd();

      if (newOrderIds.join(",") !== currentOrderIds.join(",")) {
        const movedSection = sections[draggedIdx];
        const newPos = insertIdx + 1;
        void onReorder(newOrderIds).then(() => {
          setAnnouncement(
            `„${movedSection.label}" nach Position ${newPos} verschoben.`,
          );
          setTimeout(() => setAnnouncement(""), 3000);
        });
      }
    },
    [sections, handleDragEnd, onReorder],
  );

  // ── Keyboard focus helpers ─────────────────────────────────────────────────

  const focusSectionAt = useCallback((idx: number) => {
    itemRefs.current[idx]?.focus();
  }, []);

  // ── Derived values for rendering ──────────────────────────────────────────

  const draggedIdx =
    draggedId !== null ? sections.findIndex((s) => s.id === draggedId) : -1;

  function isActiveDropLine(lineIdx: number): boolean {
    if (draggedId === null || dropIndex === null || dropIndex !== lineIdx) return false;
    // Suppress indicator at the no-op positions (would leave section in same place)
    if (draggedIdx >= 0 && (lineIdx === draggedIdx || lineIdx === draggedIdx + 1)) {
      return false;
    }
    return true;
  }

  // ── Empty state ────────────────────────────────────────────────────────────

  if (sections.length === 0) {
    return (
      <HomepageCanvasEmptyState
        onBootstrap={onBootstrap}
        bootstrapping={bootstrapping}
      />
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col">
      {/* Accessible live region for move announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>

      {/* Section list */}
      <div
        className="px-5 pt-4 pb-2"
        role="list"
        aria-label="Homepage-Sektionen (Canvas)"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        {/* Insertion line before first section */}
        <InsertionLine isActive={isActiveDropLine(0)} />

        {sections.map((section, idx) => {
          const isFirst = idx === 0;
          const isLast = idx === sections.length - 1;
          const isSelected = selectedId === section.id;
          const isDragging = draggedId === section.id;
          const isPending =
            actionPending === section.id ||
            actionPending === `${section.id}-up` ||
            actionPending === `${section.id}-down` ||
            actionPending === `${section.id}-publish` ||
            actionPending === `${section.id}-unpublish` ||
            actionPending === `${section.id}-request-review`;

          return (
            <div
              key={section.id}
              role="listitem"
              onDragOver={(e) => handleSectionDragOver(e, idx, section.id)}
              onDrop={handleDrop}
            >
              <HomepageCanvasSection
                section={section}
                index={idx}
                isFirst={isFirst}
                isLast={isLast}
                isSelected={isSelected}
                isPending={isPending}
                isAnyPending={isAnyPending}
                isDragging={isDragging}
                onSelect={() => onSelectSection(section.id)}
                onToggle={() => onToggle(section.id)}
                onMoveUp={() => onMoveUp(section.id)}
                onMoveDown={() => onMoveDown(section.id)}
                onPublish={() => onPublish(section.id)}
                onUnpublish={() => onUnpublish(section.id)}
                onStartEdit={() => onStartEdit(section.id)}
                onDragStart={() => handleDragStart(section.id)}
                onDragEnd={handleDragEnd}
                onFocusPrevious={idx > 0 ? () => focusSectionAt(idx - 1) : undefined}
                onFocusNext={
                  idx < sections.length - 1 ? () => focusSectionAt(idx + 1) : undefined
                }
                sectionRef={(el) => {
                  itemRefs.current[idx] = el;
                }}
              />

              {/* Insertion line after each section */}
              <InsertionLine isActive={isActiveDropLine(idx + 1)} />
            </div>
          );
        })}
      </div>

      {/* Status footer */}
      <div className="px-5 pb-4 pt-1 flex items-center gap-2 min-h-[28px]">
        {reorderPending && (
          <span className="flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
            <Loader2 className="h-3 w-3 animate-spin" />
            Reihenfolge wird gespeichert…
          </span>
        )}
        {!reorderPending && reorderError && (
          <span className="flex items-center gap-1.5 text-[11px] text-rose-600">
            <AlertCircle className="h-3 w-3 shrink-0" />
            {reorderError}
          </span>
        )}
        {!reorderPending && !reorderError && announcement && (
          <span className="flex items-center gap-1.5 text-[11px] text-emerald-600">
            <CheckCircle2 className="h-3 w-3 shrink-0" />
            {announcement}
          </span>
        )}
      </div>
    </div>
  );
}
