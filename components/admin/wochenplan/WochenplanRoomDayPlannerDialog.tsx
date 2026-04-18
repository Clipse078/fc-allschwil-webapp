"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  GripVertical,
  MapPinned,
  Shirt,
  Sparkles,
} from "lucide-react";
import type {
  WochenplanBoardDayKey,
  WochenplanBoardEvent,
} from "@/lib/wochenplan/types";

const DRESSING_ROOMS = ["E1", "E2", "E3", "E4", "O1", "O2", "O3", "O4"] as const;
const TIMELINE_HOURS = ["15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00"];
const DAY_START_MINUTES = 15 * 60;
const DAY_END_MINUTES = 22 * 60;
const DAY_TOTAL_MINUTES = DAY_END_MINUTES - DAY_START_MINUTES;

export type WochenplanRoomConflictPair = {
  roomCode: string;
  eventId: string;
  otherEventId: string;
};

type RoomAssignmentType = "home" | "away";

type WochenplanRoomDayPlannerDialogProps = {
  isOpen: boolean;
  dayKey: WochenplanBoardDayKey | null;
  dayLabel: string | null;
  events: WochenplanBoardEvent[];
  roomConflicts: WochenplanRoomConflictPair[];
  onClose: () => void;
  onChangeRoom: (
    eventId: string,
    roomType: RoomAssignmentType,
    roomCode: string | null,
  ) => void;
};

type TimelineItem = {
  eventId: string;
  title: string;
  subtitle: string;
  roomCode: string;
  roomType: RoomAssignmentType;
  leftPercent: number;
  widthPercent: number;
  hasConflict: boolean;
  toneClassName: string;
  glowClassName: string;
  pillClassName: string;
  accentDotClassName: string;
  timeLabel: string;
  sourceLabel: string;
  metaLabel: string;
};

type DragPayload = {
  eventId: string;
  roomType: RoomAssignmentType;
  sourceRoomCode: string;
};

type RoomTone = {
  rowBorderClass: string;
  rowBackgroundClass: string;
  roomBadgeClass: string;
  roomCodeClass: string;
  roomTextClass: string;
};

function getRoomTone(roomCode: string): RoomTone {
  switch (roomCode) {
    case "E1":
      return {
        rowBorderClass: "border-amber-200",
        rowBackgroundClass: "bg-amber-50/55",
        roomBadgeClass: "border-amber-200 bg-white text-amber-700",
        roomCodeClass: "text-amber-700",
        roomTextClass: "text-amber-700/80",
      };
    case "E2":
      return {
        rowBorderClass: "border-orange-200",
        rowBackgroundClass: "bg-orange-50/55",
        roomBadgeClass: "border-orange-200 bg-white text-orange-700",
        roomCodeClass: "text-orange-700",
        roomTextClass: "text-orange-700/80",
      };
    case "E3":
      return {
        rowBorderClass: "border-lime-200",
        rowBackgroundClass: "bg-lime-50/55",
        roomBadgeClass: "border-lime-200 bg-white text-lime-700",
        roomCodeClass: "text-lime-700",
        roomTextClass: "text-lime-700/80",
      };
    case "E4":
      return {
        rowBorderClass: "border-yellow-200",
        rowBackgroundClass: "bg-yellow-50/55",
        roomBadgeClass: "border-yellow-200 bg-white text-yellow-700",
        roomCodeClass: "text-yellow-700",
        roomTextClass: "text-yellow-700/80",
      };
    case "O1":
      return {
        rowBorderClass: "border-sky-200",
        rowBackgroundClass: "bg-sky-50/55",
        roomBadgeClass: "border-sky-200 bg-white text-sky-700",
        roomCodeClass: "text-sky-700",
        roomTextClass: "text-sky-700/80",
      };
    case "O2":
      return {
        rowBorderClass: "border-blue-200",
        rowBackgroundClass: "bg-blue-50/55",
        roomBadgeClass: "border-blue-200 bg-white text-blue-700",
        roomCodeClass: "text-blue-700",
        roomTextClass: "text-blue-700/80",
      };
    case "O3":
      return {
        rowBorderClass: "border-violet-200",
        rowBackgroundClass: "bg-violet-50/55",
        roomBadgeClass: "border-violet-200 bg-white text-violet-700",
        roomCodeClass: "text-violet-700",
        roomTextClass: "text-violet-700/80",
      };
    default:
      return {
        rowBorderClass: "border-pink-200",
        rowBackgroundClass: "bg-pink-50/55",
        roomBadgeClass: "border-pink-200 bg-white text-pink-700",
        roomCodeClass: "text-pink-700",
        roomTextClass: "text-pink-700/80",
      };
  }
}

function getMinutesFromValue(value: string | Date | null | undefined) {
  if (!value) {
    return 0;
  }

  const date = value instanceof Date ? value : new Date(value);
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getLeftPercent(startMinutes: number) {
  return ((startMinutes - DAY_START_MINUTES) / DAY_TOTAL_MINUTES) * 100;
}

function getWidthPercent(startMinutes: number, endMinutes: number) {
  return Math.max(((endMinutes - startMinutes) / DAY_TOTAL_MINUTES) * 100, 10);
}

function formatTimeLabel(event: WochenplanBoardEvent) {
  const startValue = event.startAt instanceof Date ? event.startAt : new Date(event.startAt);
  const endValue =
    event.endAt instanceof Date
      ? event.endAt
      : new Date(event.endAt ?? event.startAt);

  const startLabel =
    String(startValue.getUTCHours()).padStart(2, "0") +
    ":" +
    String(startValue.getUTCMinutes()).padStart(2, "0");

  const endLabel =
    String(endValue.getUTCHours()).padStart(2, "0") +
    ":" +
    String(endValue.getUTCMinutes()).padStart(2, "0");

  return startLabel + "–" + endLabel;
}

function getEventSubtitle(event: WochenplanBoardEvent, roomType: RoomAssignmentType) {
  if (event.eventType === "MATCH") {
    if (roomType === "home") {
      return event.opponentName ? "Heim vs. " + event.opponentName : "Heim";
    }

    return event.opponentName ? "Gast – " + event.opponentName : "Gast";
  }

  if (event.eventType === "TOURNAMENT") {
    return event.organizerName ? "Turnier – " + event.organizerName : "Turnier";
  }

  return "Training";
}

function getEventMetaLabel(event: WochenplanBoardEvent) {
  if (event.pitchRowKey === "KUNSTRASEN_2") {
    return "KR 2";
  }

  if (event.pitchRowKey === "KUNSTRASEN_3") {
    return "KR 3";
  }

  return "Stadion";
}

function getEventTone(event: WochenplanBoardEvent, hasConflict: boolean) {
  if (hasConflict) {
    return {
      toneClassName: "border-red-300 bg-red-50/95 text-red-900",
      glowClassName: "shadow-[0_12px_28px_rgba(239,68,68,0.12)] ring-1 ring-red-200/80",
      pillClassName: "border-red-200 bg-white text-red-700",
      accentDotClassName: "bg-red-500",
    };
  }

  switch (event.categoryKey) {
    case "KINDERFUSSBALL":
      return {
        toneClassName: "border-amber-200 bg-amber-50/95 text-amber-950",
        glowClassName: "shadow-[0_10px_24px_rgba(245,158,11,0.10)]",
        pillClassName: "border-amber-200 bg-white text-amber-700",
        accentDotClassName: "bg-amber-500",
      };
    case "JUNIOREN":
      return {
        toneClassName: "border-blue-200 bg-blue-50/95 text-blue-950",
        glowClassName: "shadow-[0_10px_24px_rgba(59,130,246,0.10)]",
        pillClassName: "border-blue-200 bg-white text-blue-700",
        accentDotClassName: "bg-blue-500",
      };
    case "AKTIVE":
      return {
        toneClassName: "border-red-200 bg-red-50/95 text-red-950",
        glowClassName: "shadow-[0_10px_24px_rgba(239,68,68,0.10)]",
        pillClassName: "border-red-200 bg-white text-red-700",
        accentDotClassName: "bg-red-500",
      };
    case "FRAUEN":
      return {
        toneClassName: "border-pink-200 bg-pink-50/95 text-pink-950",
        glowClassName: "shadow-[0_10px_24px_rgba(236,72,153,0.10)]",
        pillClassName: "border-pink-200 bg-white text-pink-700",
        accentDotClassName: "bg-pink-500",
      };
    case "SENIOREN":
      return {
        toneClassName: "border-slate-200 bg-slate-50/95 text-slate-900",
        glowClassName: "shadow-[0_10px_24px_rgba(100,116,139,0.08)]",
        pillClassName: "border-slate-200 bg-white text-slate-700",
        accentDotClassName: "bg-slate-500",
      };
    default:
      return {
        toneClassName: "border-neutral-200 bg-neutral-50/95 text-neutral-900",
        glowClassName: "shadow-[0_10px_24px_rgba(115,115,115,0.08)]",
        pillClassName: "border-neutral-200 bg-white text-neutral-700",
        accentDotClassName: "bg-neutral-500",
      };
  }
}

export default function WochenplanRoomDayPlannerDialog({
  isOpen,
  dayKey,
  dayLabel,
  events,
  roomConflicts,
  onClose,
  onChangeRoom,
}: WochenplanRoomDayPlannerDialogProps) {
  const [draggingItem, setDraggingItem] = useState<DragPayload | null>(null);
  const [dropRoomCode, setDropRoomCode] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDraggingItem(null);
        setDropRoomCode(null);
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const eventsForDay = useMemo(() => {
    if (!dayKey) {
      return [];
    }

    return events
      .filter((event) => event.boardDayKey === dayKey)
      .sort(
        (a, b) =>
          getMinutesFromValue(a.startAt) - getMinutesFromValue(b.startAt),
      );
  }, [dayKey, events]);

  const conflictLookup = useMemo(() => {
    return new Set(
      roomConflicts.flatMap((conflict) => [
        conflict.eventId + ":" + conflict.roomCode,
        conflict.otherEventId + ":" + conflict.roomCode,
      ]),
    );
  }, [roomConflicts]);

  const timelineItemsByRoom = useMemo(() => {
    const map = new Map<string, TimelineItem[]>();

    for (const roomCode of DRESSING_ROOMS) {
      map.set(roomCode, []);
    }

    for (const event of eventsForDay) {
      const startMinutes = clamp(
        getMinutesFromValue(event.startAt),
        DAY_START_MINUTES,
        DAY_END_MINUTES,
      );

      const endMinutes = clamp(
        getMinutesFromValue(event.endAt ?? event.startAt),
        DAY_START_MINUTES,
        DAY_END_MINUTES,
      );

      const assignments: Array<{
        roomType: RoomAssignmentType;
        roomCode: string | null;
      }> = [
        { roomType: "home", roomCode: event.allocation.homeDressingRoomCode },
        { roomType: "away", roomCode: event.allocation.awayDressingRoomCode },
      ];

      for (const assignment of assignments) {
        if (!assignment.roomCode) {
          continue;
        }

        if (!map.has(assignment.roomCode)) {
          continue;
        }

        const hasConflict = conflictLookup.has(
          event.id + ":" + assignment.roomCode,
        );

        const tone = getEventTone(event, hasConflict);

        map.get(assignment.roomCode)?.push({
          eventId: event.id,
          title: event.title,
          subtitle: getEventSubtitle(event, assignment.roomType),
          roomCode: assignment.roomCode,
          roomType: assignment.roomType,
          leftPercent: getLeftPercent(startMinutes),
          widthPercent: getWidthPercent(startMinutes, endMinutes),
          hasConflict,
          toneClassName: tone.toneClassName,
          glowClassName: tone.glowClassName,
          pillClassName: tone.pillClassName,
          accentDotClassName: tone.accentDotClassName,
          timeLabel: formatTimeLabel(event),
          sourceLabel: event.source === "CLUBCORNER_FVNWS" ? "Importiert" : "Manuell",
          metaLabel: getEventMetaLabel(event),
        });
      }
    }

    return map;
  }, [eventsForDay, conflictLookup]);

  function handleDragStart(item: DragPayload) {
    setDraggingItem(item);
  }

  function handleDragEnd() {
    setDraggingItem(null);
    setDropRoomCode(null);
  }

  function handleRoomDragOver(
    dragEvent: React.DragEvent<HTMLDivElement>,
    roomCode: string,
  ) {
    if (!draggingItem) {
      return;
    }

    dragEvent.preventDefault();
    setDropRoomCode(roomCode);
  }

  function handleRoomDrop(roomCode: string) {
    if (!draggingItem) {
      return;
    }

    onChangeRoom(draggingItem.eventId, draggingItem.roomType, roomCode);
    setDraggingItem(null);
    setDropRoomCode(null);
  }

  if (!isOpen || !dayKey || !dayLabel) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]">
      <div className="flex max-h-[92vh] w-full max-w-[1320px] flex-col overflow-hidden rounded-[34px] border border-slate-200 bg-white shadow-[0_35px_120px_rgba(15,23,42,0.32)]">
        <div className="border-b border-slate-200 bg-gradient-to-r from-white via-slate-50 to-white px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="fca-eyebrow">Garderobe</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                Garderobe Tagesplaner – {dayLabel}
              </h2>
              <p className="mt-2 max-w-4xl text-sm text-slate-600">
                Sandra kann hier alle Garderobenzuteilungen pro Tag sehen, Konflikte erkennen und Räume lokal anpassen, bevor später gespeichert und publiziert wird.
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                  <GripVertical className="h-3.5 w-3.5" />
                  Drag & Drop aktiv
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                  <Sparkles className="h-3.5 w-3.5" />
                  Farbcode nach Kategorie
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setDraggingItem(null);
                setDropRoomCode(null);
                onClose();
              }}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Schliessen
            </button>
          </div>
        </div>

        <div className="border-b border-slate-200 px-6 py-4">
          <div className="grid grid-cols-[220px_repeat(8,minmax(0,1fr))] overflow-hidden rounded-[24px] border border-slate-200 bg-white">
            <div className="border-r border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
              Garderobe
            </div>

            {TIMELINE_HOURS.map((hour) => (
              <div
                key={hour}
                className="border-r border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600 last:border-r-0"
              >
                {hour}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-4">
            {DRESSING_ROOMS.map((roomCode) => {
              const roomItems = timelineItemsByRoom.get(roomCode) ?? [];
              const roomHasConflict = roomItems.some((item) => item.hasConflict);
              const isActiveDropZone = draggingItem !== null && dropRoomCode === roomCode;
              const roomTone = getRoomTone(roomCode);

              return (
                <div
                  key={roomCode}
                  onDragOver={(dragEvent) => handleRoomDragOver(dragEvent, roomCode)}
                  onDragLeave={() => {
                    if (dropRoomCode === roomCode) {
                      setDropRoomCode(null);
                    }
                  }}
                  onDrop={() => handleRoomDrop(roomCode)}
                  className={[
                    "grid grid-cols-[220px_minmax(0,1fr)] overflow-hidden rounded-[26px] border transition",
                    isActiveDropZone
                      ? "border-[#0b4aa2] bg-blue-50/40 shadow-[0_0_0_4px_rgba(11,74,162,0.08)]"
                      : roomTone.rowBorderClass + " bg-white",
                  ].join(" ")}
                >
                  <div className={"border-r border-slate-200 px-4 py-4 " + roomTone.rowBackgroundClass}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className={"inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] " + roomTone.roomBadgeClass}>
                          Garderobe
                        </span>

                        <p className={"mt-3 font-[var(--font-display)] text-[2rem] font-bold uppercase leading-none tracking-[-0.04em] " + roomTone.roomCodeClass}>
                          {roomCode}
                        </p>
                      </div>
                    </div>

                    <p className={"mt-3 text-sm font-medium " + roomTone.roomTextClass}>
                      {roomHasConflict ? "Konflikt vorhanden" : "Keine Konflikte"}
                    </p>

                    {isActiveDropZone ? (
                      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#0b4aa2]">
                        Hier ablegen
                      </p>
                    ) : null}
                  </div>

                  <div className="relative min-h-[132px] bg-white">
                    <div className="absolute inset-0 grid grid-cols-8">
                      {TIMELINE_HOURS.map((hour) => (
                        <div
                          key={roomCode + "-" + hour}
                          className="border-r border-slate-200/90 last:border-r-0"
                        />
                      ))}
                    </div>

                    <div className="relative h-full min-h-[132px] p-3">
                      {roomItems.length === 0 ? (
                        <div className="flex h-full items-center text-sm text-slate-400">
                          Keine Belegung
                        </div>
                      ) : (
                        roomItems.map((item, index) => {
                          const isDraggingThisItem =
                            draggingItem?.eventId === item.eventId &&
                            draggingItem?.roomType === item.roomType &&
                            draggingItem?.sourceRoomCode === item.roomCode;

                          return (
                            <div
                              key={item.eventId + "-" + item.roomType + "-" + item.roomCode}
                              draggable
                              onDragStart={() =>
                                handleDragStart({
                                  eventId: item.eventId,
                                  roomType: item.roomType,
                                  sourceRoomCode: item.roomCode,
                                })
                              }
                              onDragEnd={handleDragEnd}
                              className={[
                                "absolute cursor-grab overflow-hidden rounded-[22px] border px-3 py-3 transition active:cursor-grabbing",
                                "min-h-[84px] max-h-[92px]",
                                item.toneClassName,
                                item.glowClassName,
                                isDraggingThisItem ? "opacity-45 ring-2 ring-[#0b4aa2]/20" : "",
                              ].join(" ")}
                              style={{
                                left: item.leftPercent + "%",
                                width: item.widthPercent + "%",
                                top: 14 + index * 10,
                                zIndex: item.hasConflict ? 20 : 10,
                              }}
                              title="Per Drag & Drop in andere Garderobe verschieben"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className={"h-2.5 w-2.5 shrink-0 rounded-full " + item.accentDotClassName} />
                                    <p className="truncate text-[14px] font-bold leading-tight">{item.title}</p>
                                  </div>
                                  <p className="mt-1 truncate text-[12px] opacity-80">{item.subtitle}</p>
                                </div>

                                <span className={"shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] " + item.pillClassName}>
                                  {item.timeLabel}
                                </span>
                              </div>

                              <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] opacity-80">
                                <span className={"rounded-full border px-2 py-1 " + item.pillClassName}>
                                  {item.sourceLabel}
                                </span>
                                <span className={"rounded-full border px-2 py-1 " + item.pillClassName}>
                                  {item.roomType === "home" ? "Home" : "Away"}
                                </span>
                              </div>

                              <div className="mt-2 flex items-center gap-3 text-[11px] opacity-80">
                                <div className="flex items-center gap-1">
                                  <MapPinned className="h-3.5 w-3.5" />
                                  <span className="truncate">{item.metaLabel}</span>
                                </div>

                                <div className="flex items-center gap-1">
                                  <CalendarClock className="h-3.5 w-3.5" />
                                  <span className="truncate">{item.timeLabel}</span>
                                </div>
                              </div>

                              {item.hasConflict ? (
                                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-white/85 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-red-700">
                                  <Shirt className="h-3.5 w-3.5" />
                                  Konflikt
                                </div>
                              ) : null}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 rounded-[30px] border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5">
            <p className="fca-eyebrow">Schnellkorrektur</p>
            <h3 className="mt-2 text-lg font-bold text-slate-900">
              Garderoben direkt neu zuweisen
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Alternativ zum Drag & Drop können Garderoben weiterhin direkt per Auswahl geändert werden.
            </p>

            <div className="mt-4 space-y-3">
              {eventsForDay.map((event) => (
                <div
                  key={event.id}
                  className="grid gap-3 rounded-[24px] border border-slate-200 bg-white p-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,0.9fr)]"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatTimeLabel(event)} • {getEventMetaLabel(event)}
                    </p>
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                      {event.source === "CLUBCORNER_FVNWS" ? "Importiert" : "Manuell"}
                    </p>
                  </div>

                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Home Garderobe
                    </span>
                    <select
                      value={event.allocation.homeDressingRoomCode ?? ""}
                      onChange={(selectEvent) =>
                        onChangeRoom(
                          event.id,
                          "home",
                          selectEvent.target.value === "" ? null : selectEvent.target.value,
                        )
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#0b4aa2]"
                    >
                      <option value="">Keine</option>
                      {DRESSING_ROOMS.map((roomCode) => (
                        <option key={roomCode} value={roomCode}>
                          {roomCode}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Away Garderobe
                    </span>
                    <select
                      value={event.allocation.awayDressingRoomCode ?? ""}
                      onChange={(selectEvent) =>
                        onChangeRoom(
                          event.id,
                          "away",
                          selectEvent.target.value === "" ? null : selectEvent.target.value,
                        )
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#0b4aa2]"
                    >
                      <option value="">Keine</option>
                      {DRESSING_ROOMS.map((roomCode) => (
                        <option key={roomCode} value={roomCode}>
                          {roomCode}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
