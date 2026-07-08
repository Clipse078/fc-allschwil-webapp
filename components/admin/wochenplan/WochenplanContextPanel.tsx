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

function getEventTypeDescription(eventType: string) {
  switch (eventType) {
    case "MATCH":
      return "Spieltermin";
    case "TOURNAMENT":
      return "Turniertermin";
    case "TRAINING":
      return "Trainingseinheit";
    default:
      return "Planungstermin";
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

        <p className="mt-1 break-words text-sm font-medium text-slate-800">
          {value}
        </p>
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
          Wähle eine Karte im Wochenplan aus, um die wichtigsten Angaben zum
          Termin hier kompakt zu prüfen.
        </p>

        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-5">
          <p className="text-sm font-medium text-slate-700">
            Kein Termin ausgewählt
          </p>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            Die Auswahl bleibt bewusst im Planungskontext und öffnet keine
            zusätzliche Seite.
          </p>
        </div>
      </aside>
    );
  }

  const roomParts = [
    event.allocation.homeDressingRoomCode
      ? `Heim ${event.allocation.homeDressingRoomCode}`
      : null,
    event.allocation.awayDressingRoomCode
      ? `Gast ${event.allocation.awayDressingRoomCode}`
      : null,
  ].filter(Boolean);

  const roomLabel =
    roomParts.length > 0 ? roomParts.join(" · ") : "Noch nicht zugeteilt";

  const opponentLabel = event.opponentName
    ? `Gegner: ${event.opponentName}`
    : null;

  return (
    <aside className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-sky-700">
                {getEventTypeLabel(event.eventType)}
              </span>

              <span className="text-xs text-slate-400">
                {getEventTypeDescription(event.eventType)}
              </span>
            </div>

            <h2 className="mt-3 break-words text-xl font-semibold tracking-tight text-slate-950">
              {event.title}
            </h2>

            {opponentLabel ? (
              <p className="mt-1.5 text-sm text-slate-500">
                {opponentLabel}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Kontext schliessen"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-3 p-5">
        <ContextRow
          icon={<UserRound className="h-4 w-4" />}
          label="Team"
          value={event.teamName ?? "Kein Team zugeordnet"}
        />

        <ContextRow
          icon={<CalendarDays className="h-4 w-4" />}
          label="Tag"
          value={event.boardDayKey}
        />

        <ContextRow
          icon={<Clock3 className="h-4 w-4" />}
          label="Zeit"
          value={event.slotKey}
        />

        <ContextRow
          icon={<MapPinned className="h-4 w-4" />}
          label="Platz"
          value={`${pitchLabel ?? event.pitchRowKey}${
            event.fieldLabel ? ` · Feld ${event.fieldLabel}` : ""
          }`}
        />

        <ContextRow
          icon={<Shirt className="h-4 w-4" />}
          label="Garderoben"
          value={roomLabel}
        />

        <ContextRow
          icon={<ShieldHalf className="h-4 w-4" />}
          label="Planungsstatus"
          value="Im Wochenplan eingeplant"
        />
      </div>

      <div className="border-t border-slate-100 bg-slate-50/60 p-5">
        <button
          type="button"
          onClick={() => onOpenRooms(event.id)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
        >
          <Shirt className="h-4 w-4 text-slate-500" />
          Garderoben bearbeiten
        </button>

        <p className="mt-3 text-center text-[0.7rem] leading-5 text-slate-400">
          Weitere Terminaktionen werden in einem späteren Planungsschritt
          ergänzt.
        </p>
      </div>
    </aside>
  );
}
