"use client";

import { useState } from "react";
import type {
  WochenplanBoardDayKey,
  WochenplanBoardEvent,
  WochenplanBoardPitchRowKey,
  WochenplanBoardSlotKey,
} from "@/lib/wochenplan/types";
import WochenplanEventCard from "@/components/admin/wochenplan/WochenplanEventCard";
import WochenplanRoomConflictBadge from "@/components/admin/wochenplan/WochenplanRoomConflictBadge";

type WochenplanDayGridProps = {
  dayLabel: string;
  dayKey: WochenplanBoardDayKey;
  pitchRows: Array<{ key: WochenplanBoardPitchRowKey; label: string }>;
  timeSlots: WochenplanBoardSlotKey[];
  events: WochenplanBoardEvent[];
  roomConflictCount: number;
  onOpenDayPlanner: (dayKey: WochenplanBoardDayKey, dayLabel: string) => void;
  onDropEvent: (
    eventId: string,
    nextDayKey: WochenplanBoardDayKey,
    nextPitchRowKey: WochenplanBoardPitchRowKey,
    nextSlotKey: WochenplanBoardSlotKey,
  ) => void;
  selectedEventId: string | null;
  onSelectEvent: (eventId: string) => void;
  onDragStart: (eventId: string) => void;
  onDragEnd: () => void;
  draggingEventId: string | null;
};

type DropTarget = {
  pitchRowKey: WochenplanBoardPitchRowKey;
  slotKey: WochenplanBoardSlotKey;
} | null;

function hasRoomConflictForEvent(
  event: WochenplanBoardEvent,
  allEventsForDay: WochenplanBoardEvent[],
) {
  const sameSlotEvents = allEventsForDay.filter(
    (candidate) => candidate.id !== event.id && candidate.slotKey === event.slotKey,
  );

  const eventRooms = [
    event.allocation.homeDressingRoomCode,
    event.allocation.awayDressingRoomCode,
  ].filter(Boolean) as string[];

  return sameSlotEvents.some((candidate) => {
    const candidateRooms = [
      candidate.allocation.homeDressingRoomCode,
      candidate.allocation.awayDressingRoomCode,
    ].filter(Boolean) as string[];

    return eventRooms.some((roomCode) => candidateRooms.includes(roomCode));
  });
}

function hasPitchConflictForEvent(
  event: WochenplanBoardEvent,
  cellEvents: WochenplanBoardEvent[],
) {
  const otherEvents = cellEvents.filter((candidate) => candidate.id !== event.id);

  if (otherEvents.length === 0) {
    return false;
  }

  if (event.eventType !== "TRAINING") {
    return true;
  }

  return otherEvents.some((candidate) => {
    if (candidate.eventType !== "TRAINING") {
      return true;
    }

    if (!event.fieldLabel || !candidate.fieldLabel) {
      return true;
    }

    return candidate.fieldLabel === event.fieldLabel;
  });
}

function hasCellPitchConflict(cellEvents: WochenplanBoardEvent[]) {
  if (cellEvents.length <= 1) {
    return false;
  }

  return cellEvents.some((event) => hasPitchConflictForEvent(event, cellEvents));
}

function getCellRoomConflictCount(
  cellEvents: WochenplanBoardEvent[],
  allEventsForDay: WochenplanBoardEvent[],
) {
  return cellEvents.filter((event) => hasRoomConflictForEvent(event, allEventsForDay)).length;
}

export default function WochenplanDayGrid({
  dayLabel,
  dayKey,
  pitchRows,
  timeSlots,
  events,
  roomConflictCount,
  onOpenDayPlanner,
  onDropEvent,
  selectedEventId,
  onSelectEvent,
  onDragStart,
  onDragEnd,
  draggingEventId,
}: WochenplanDayGridProps) {
  const [dropTarget, setDropTarget] = useState<DropTarget>(null);
  const dayEvents = events.filter((event) => event.boardDayKey === dayKey);

  return (
    <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-4 bg-[#0f1b3d] px-5 py-4 text-white">
        <p className="text-sm font-semibold">{dayLabel}</p>

        <button
          type="button"
          onClick={() => onOpenDayPlanner(dayKey, dayLabel)}
          className="inline-flex items-center gap-2.5 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
        >
          <span>Garderobe Tagesplaner</span>
          <WochenplanRoomConflictBadge count={roomConflictCount} />
        </button>
      </div>

      <div className="grid grid-cols-[150px_repeat(4,minmax(0,1fr))] border-t border-slate-200">
        <div className="border-r border-slate-200 bg-slate-50 px-4 py-3 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
          Ort
        </div>

        {timeSlots.map((slot) => (
          <div
            key={slot}
            className="border-r border-slate-200 bg-slate-50 px-4 py-3 text-center text-[0.72rem] font-semibold text-slate-600 last:border-r-0"
          >
            {slot}
          </div>
        ))}

        {pitchRows.map((pitchRow) => (
          <div key={pitchRow.key} className="contents">
            <div className="border-r border-t border-slate-200 px-4 py-4 text-sm font-semibold text-slate-700">
              {pitchRow.label}
            </div>

            {timeSlots.map((slot) => {
              const cellEvents = dayEvents.filter(
                (event) =>
                  event.pitchRowKey === pitchRow.key &&
                  event.slotKey === slot,
              );

              const hasCellPitchIssue = hasCellPitchConflict(cellEvents);
              const roomConflictCountInCell = getCellRoomConflictCount(cellEvents, dayEvents);
              const hasCellConflict = hasCellPitchIssue || roomConflictCountInCell > 0;

              const isDropTarget =
                dropTarget?.pitchRowKey === pitchRow.key &&
                dropTarget.slotKey === slot;

              return (
                <div
                  key={pitchRow.key + "-" + slot}
                  onDragEnter={(dragEvent) => {
                    dragEvent.preventDefault();

                    if (!draggingEventId) {
                      return;
                    }

                    setDropTarget({
                      pitchRowKey: pitchRow.key,
                      slotKey: slot,
                    });
                  }}
                  onDragOver={(dragEvent) => {
                    dragEvent.preventDefault();
                    dragEvent.dataTransfer.dropEffect = "move";
                  }}
                  onDragLeave={(dragEvent) => {
                    if (dragEvent.currentTarget.contains(dragEvent.relatedTarget as Node | null)) {
                      return;
                    }

                    setDropTarget(null);
                  }}
                  onDrop={(dragEvent) => {
                    dragEvent.preventDefault();

                    if (!draggingEventId) {
                      return;
                    }

                    const draggedEvent = events.find(
                      (event) => event.id === draggingEventId,
                    );

                    setDropTarget(null);

                    if (
                      draggedEvent &&
                      draggedEvent.boardDayKey === dayKey &&
                      draggedEvent.pitchRowKey === pitchRow.key &&
                      draggedEvent.slotKey === slot
                    ) {
                      return;
                    }

                    onDropEvent(draggingEventId, dayKey, pitchRow.key, slot);
                  }}
                  className={[
                    "min-h-[118px] border-r border-t border-slate-200 p-2 transition-colors duration-150 last:border-r-0",
                    isDropTarget
                      ? "bg-sky-50/80"
                      : "bg-white",
                  ].join(" ")}
                >
                  <div
                    className={[
                      "relative h-full min-h-[100px] overflow-hidden rounded-xl border border-dashed p-1.5 transition-all duration-150",
                      isDropTarget
                        ? "border-sky-400 bg-sky-50 ring-2 ring-sky-300/30"
                        : hasCellConflict
                          ? "border-red-200 bg-red-50/20"
                          : "border-slate-200/80 bg-slate-50/35 hover:bg-slate-50/60",
                    ].join(" ")}
                  >
                    {hasCellConflict ? (
                      <div className="absolute right-2 top-2 z-10 h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_0_4px_rgba(239,68,68,0.12)]" />
                    ) : null}

                    {isDropTarget ? (
                      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                        <span className="rounded-full border border-sky-200 bg-white/95 px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-sky-700 shadow-sm">
                          Hier platzieren
                        </span>
                      </div>
                    ) : null}

                    <div className="grid gap-1.5">
                      {cellEvents.map((event) => (
                        <WochenplanEventCard
                          key={event.id}
                          event={event}
                          hasPitchConflict={hasPitchConflictForEvent(event, cellEvents)}
                          hasRoomConflict={hasRoomConflictForEvent(event, dayEvents)}
                          isSelected={selectedEventId === event.id}
                          onSelect={onSelectEvent}
                          onDragStart={onDragStart}
                          onDragEnd={() => {
                            setDropTarget(null);
                            onDragEnd();
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
