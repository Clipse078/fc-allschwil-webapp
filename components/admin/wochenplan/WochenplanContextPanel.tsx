"use client";

import {
  CalendarDays,
  Clock3,
  MapPinned,
  ShieldHalf,
  Shirt,
  UserRound,
  X,
} from "lucide-react";
import type { WochenplanBoardEvent } from "@/lib/wochenplan/types";

type WochenplanContextPanelProps = {
  event: WochenplanBoardEvent | null;
  pitchLabel: string | null;
  onClose: () => void;
  onOpenRooms: (eventId: string) => void;
};

function getEventTypeLabel(eventType: string) {
  switch (eventType) {
    case "MATCH":
      return "Spiel";
    case "TOURNAMENT":
      return "Turnier";
    case "TRAINING":
      return "Training";
    default:
      return eventType;
  }
}

function ContextRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-3.5 py-3">
      <div className="mt-0.5 text-slate-400">{icon}</div>
      <div className="min-w-0">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-400">
          {label}
        </p>
        <p className="mt-1 break-words text-sm font-medium text-slate-800">{value}</p>
      </div>
    </div>
  );
}

export default function WochenplanContextPanel({
  event,
  pitchLabel,
  onClose,
  onOpenRooms,
}: WochenplanContextPanelProps) {
  if (!event) {
    return (
      <aside className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-slate-400">
          Kontext
        </p>
        <h2 className="mt-3 text-lg font-semibold text-slate-950">
          Planung im Fokus
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Wähle eine Karte im Wochenplan aus, um die wichtigsten Angaben zum Termin
          hier kompakt zu prüfen.
        </p>

        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-5">
          <p className="text-sm font-medium text-slate-700">Kein Termin ausgewählt</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Der Plan bleibt die zentrale Arbeitsfläche. Details erscheinen nur bei Bedarf.
          </p>
        </div>
      </aside>
    );
  }

  const counterpart =
    event.opponentName ??
    event.organizerName ??
    event.homeLabel ??
    "Keine Angabe";

  const rooms = [
    event.allocation.homeDressingRoomCode
      ? `Heim ${event.allocation.homeDressingRoomCode}`
      : null,
    event.allocation.awayDressingRoomCode
      ? `Gast ${event.allocation.awayDressingRoomCode}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <aside className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-sky-600">
              Ausgewählter Termin
            </p>
            <h2 className="mt-2 break-words text-lg font-semibold text-slate-950">
              {event.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
            aria-label="Auswahl schliessen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white">
            {getEventTypeLabel(event.eventType)}
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
            {event.categoryKey}
          </span>
        </div>
      </div>

      <div className="space-y-3 p-5">
        <ContextRow
          icon={<Clock3 className="h-4 w-4" />}
          label="Zeit"
          value={event.slotKey}
        />

        <ContextRow
          icon={<MapPinned className="h-4 w-4" />}
          label="Platz"
          value={`${pitchLabel ?? event.pitchRowKey}${event.fieldLabel ? ` · Feld ${event.fieldLabel}` : ""}`}
        />

        <ContextRow
          icon={<ShieldHalf className="h-4 w-4" />}
          label="Gegner / Organisation"
          value={counterpart}
        />

        <ContextRow
          icon={<Shirt className="h-4 w-4" />}
          label="Garderoben"
          value={rooms || "Noch nicht zugeteilt"}
        />

        {event.coachLabel ? (
          <ContextRow
            icon={<UserRound className="h-4 w-4" />}
            label="Trainer"
            value={event.coachLabel}
          />
        ) : null}

        {event.competitionLabel ? (
          <ContextRow
            icon={<CalendarDays className="h-4 w-4" />}
            label="Wettbewerb"
            value={event.competitionLabel}
          />
        ) : null}

        <button
          type="button"
          onClick={() => onOpenRooms(event.id)}
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0f1b3d] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#162752]"
        >
          <Shirt className="h-4 w-4" />
          Garderoben bearbeiten
        </button>
      </div>
    </aside>
  );
}
