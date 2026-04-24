"use client";

import { CalendarDays, MapPinned, Shirt, ShieldHalf } from "lucide-react";
import type {
  WochenplanBoardDayKey,
  WochenplanBoardEvent,
} from "@/lib/wochenplan/types";

type WochenplanLiveOverviewProps = {
  days: Array<{ key: WochenplanBoardDayKey; label: string }>;
  events: WochenplanBoardEvent[];
  onOpenRooms: (eventId: string) => void;
};

function getPitchLabel(event: WochenplanBoardEvent) {
  const pitch =
    event.pitchRowKey === "KUNSTRASEN_2"
      ? "KR 2"
      : event.pitchRowKey === "KUNSTRASEN_3"
        ? "KR 3"
        : "Stadion";

  return event.fieldLabel ? `${pitch} · Feld ${event.fieldLabel}` : pitch;
}

function getCategoryClasses(categoryKey: WochenplanBoardEvent["categoryKey"]) {
  switch (categoryKey) {
    case "KINDERFUSSBALL":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "JUNIOREN":
      return "border-blue-200 bg-blue-50 text-blue-800";
    case "AKTIVE":
      return "border-red-200 bg-red-50 text-red-800";
    case "FRAUEN":
      return "border-pink-200 bg-pink-50 text-pink-800";
    case "SENIOREN":
      return "border-slate-200 bg-slate-50 text-slate-800";
    case "TRAININGSGRUPPE":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    default:
      return "border-slate-200 bg-white text-slate-800";
  }
}

function getTypeLabel(eventType: string) {
  if (eventType === "MATCH") return "Match";
  if (eventType === "TOURNAMENT") return "Turnier";
  if (eventType === "TRAINING") return "Training";
  return "Event";
}

export default function WochenplanLiveOverview({
  days,
  events,
  onOpenRooms,
}: WochenplanLiveOverviewProps) {
  const daysWithEvents = days
    .map((day) => ({
      ...day,
      events: events
        .filter((event) => event.boardDayKey === day.key)
        .sort((a, b) => a.slotKey.localeCompare(b.slotKey)),
    }))
    .filter((day) => day.events.length > 0);

  if (daysWithEvents.length === 0) {
    return (
      <section className="rounded-[32px] border border-dashed border-slate-200 bg-white p-8 text-center shadow-sm">
        <CalendarDays className="mx-auto h-8 w-8 text-slate-300" />
        <h3 className="mt-4 text-lg font-black uppercase tracking-tight text-[#0b4aa2]">
          Keine Buchungen in dieser Woche
        </h3>
        <p className="mt-2 text-sm font-medium text-slate-500">
          Wechsle in den Buchungsmodus, um freie Plätze und Zeiten zu sehen.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      {daysWithEvents.map((day) => (
        <article
          key={day.key}
          className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4">
            <div>
              <p className="fca-eyebrow">Live Übersicht</p>
              <h3 className="mt-1 text-xl font-black uppercase tracking-tight text-[#0b4aa2]">
                {day.label}
              </h3>
            </div>

            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[#0b4aa2]">
              {day.events.length} Buchungen
            </span>
          </div>

          <div className="grid gap-3 p-5 xl:grid-cols-2">
            {day.events.map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => onOpenRooms(event.id)}
                className={[
                  "group w-full rounded-[26px] border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
                  getCategoryClasses(event.categoryKey),
                ].join(" ")}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-current/20 bg-white/60 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em]">
                        {getTypeLabel(event.eventType)}
                      </span>
                      <span className="rounded-full border border-current/20 bg-white/60 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em]">
                        {event.slotKey}
                      </span>
                    </div>

                    <h4 className="mt-3 truncate text-lg font-black tracking-tight">
                      {event.title}
                    </h4>

                    <div className="mt-3 grid gap-2 text-sm font-semibold opacity-85 md:grid-cols-3">
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        <MapPinned className="h-4 w-4 shrink-0" />
                        <span className="truncate">{getPitchLabel(event)}</span>
                      </span>

                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        <Shirt className="h-4 w-4 shrink-0" />
                        <span className="truncate">
                          {event.allocation.homeDressingRoomCode
                            ? `Garderobe ${event.allocation.homeDressingRoomCode}`
                            : "Garderobe offen"}
                          {event.allocation.awayDressingRoomCode
                            ? ` / ${event.allocation.awayDressingRoomCode}`
                            : ""}
                        </span>
                      </span>

                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        <ShieldHalf className="h-4 w-4 shrink-0" />
                        <span className="truncate">
                          {event.coachLabel ?? event.homeLabel ?? event.teamName ?? "—"}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </article>
      ))}
    </section>
  );
}
