"use client";

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
  onOpenRooms: (eventId: string) => void;
  onDragStart: (eventId: string) => void;
  onDragEnd: () => void;
  draggingEventId: string | null;
  isToday?: boolean;
};

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
  onOpenRooms,
  onDragStart,
  onDragEnd,
  draggingEventId,
  isToday = false,
}: WochenplanDayGridProps) {
  const dayEvents = events.filter((event) => event.boardDayKey === dayKey);

  return (
    <div className={["overflow-hidden rounded-[28px] border bg-white shadow-sm transition", isToday ? "border-blue-300 shadow-[0_0_0_4px_rgba(59,130,246,0.10),0_18px_45px_rgba(15,23,42,0.08)]" : "border-slate-200"].join(" ")}>
      <div className={["flex items-center justify-between gap-4 px-5 py-4 text-white", isToday ? "bg-[#0b4aa2]" : "bg-[#0f1b3d]"].join(" ")}>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold">{dayLabel}</p>
          {isToday ? (
            <span className="rounded-full border border-white/30 bg-white/15 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-white">
              Heute
            </span>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => onOpenDayPlanner(dayKey, dayLabel)}
          className="inline-flex items-center gap-3 rounded-2xl border border-sky-300 bg-sky-500/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500/30"
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

              return (
                <div
                  key={pitchRow.key + "-" + slot}
                  onDragOver={(dragEvent) => dragEvent.preventDefault()}
                  onDrop={() => {
                    if (!draggingEventId) {
                      return;
                    }

                    onDropEvent(draggingEventId, dayKey, pitchRow.key, slot);
                  }}
                  className="min-h-[110px] border-r border-t border-slate-200 bg-white p-2 last:border-r-0"
                >
                  <div
                    className={[
                      "relative h-full overflow-hidden rounded-2xl border border-dashed p-1.5 transition",
                      hasCellConflict
                        ? "border-red-200 bg-red-50/20"
                        : "border-slate-200 bg-slate-50/50",
                    ].join(" ")}
                  >
                    {hasCellConflict ? (
                      <div className="absolute right-2 top-2 z-10 h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_0_4px_rgba(239,68,68,0.12)]" />
                    ) : null}

                    <div className="grid gap-2">
                      {cellEvents.map((event) => (
                        <WochenplanEventCard
                          key={event.id}
                          event={event}
                          hasPitchConflict={hasPitchConflictForEvent(event, cellEvents)}
                          hasRoomConflict={hasRoomConflictForEvent(event, dayEvents)}
                          onOpenRooms={onOpenRooms}
                          onDragStart={onDragStart}
                          onDragEnd={onDragEnd}
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

