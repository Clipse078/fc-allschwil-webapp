"use client";

import {
  AlertTriangle,
  GripVertical,
  MapPinned,
  ShieldHalf,
  Shirt,
} from "lucide-react";
import type { WochenplanBoardEvent } from "@/lib/wochenplan/types";
import { cn } from "@/lib/cn";
import Link from "next/link";

type WochenplanEventCardProps = {
  event: WochenplanBoardEvent;
  hasPitchConflict?: boolean;
  hasRoomConflict?: boolean;
  onOpenRooms: (eventId: string) => void;
  onDragStart: (eventId: string) => void;
  onDragEnd: () => void;
};

function getCategoryClasses(categoryKey: WochenplanBoardEvent["categoryKey"]) {
  switch (categoryKey) {
    case "KINDERFUSSBALL":
      return "border-amber-300 bg-amber-50 text-amber-800";
    case "JUNIOREN":
      return "border-blue-300 bg-blue-50 text-blue-800";
    case "AKTIVE":
      return "border-red-300 bg-red-50 text-red-800";
    case "FRAUEN":
      return "border-pink-300 bg-pink-50 text-pink-800";
    case "SENIOREN":
      return "border-slate-300 bg-slate-50 text-slate-800";
    case "TRAINER":
      return "border-neutral-300 bg-neutral-50 text-neutral-800";
    default:
      return "border-slate-300 bg-slate-50 text-slate-800";
  }
}

function getTypeDotClass(eventType: string) {
  switch (eventType) {
    case "MATCH":
      return "bg-red-500";
    case "TOURNAMENT":
      return "bg-amber-500";
    case "TRAINING":
      return "bg-blue-500";
    default:
      return "bg-slate-500";
  }
}

/**
 * PLANNING-RESOURCE-UX-01-C2 — derives missing operational allocation items
 * for a Wochenplan board event from existing canonical allocation data.
 *
 * Rules:
 *   - MATCH: pitch, home dressing room, away dressing room all required
 *   - TOURNAMENT: pitch required (room allocation tracked per-participant, not here)
 *   - TRAINING: pitch required; dressing rooms optional for training
 */
function getMissingAllocations(event: WochenplanBoardEvent): string[] {
  const missing: string[] = [];

  if (!event.allocation.pitchCode) {
    missing.push("Platz fehlt");
  }

  if (event.eventType === "MATCH") {
    if (!event.allocation.homeDressingRoomCode) {
      missing.push("Heimkabine fehlt");
    }
    if (!event.allocation.awayDressingRoomCode) {
      missing.push("Gastkabine fehlt");
    }
  }

  return missing;
}

/**
 * Derives an "edit planning" href for this event so the urgency indicator
 * naturally leads to the canonical planning editor — no new workflow.
 */
function getPlanningEditHref(event: WochenplanBoardEvent): string | null {
  if (event.eventType === "MATCH" || event.eventType === "TOURNAMENT") {
    const basePath =
      event.eventType === "MATCH" ? "/dashboard/matchcenter" : "/dashboard/tournamentcenter";
    return `${basePath}/${event.id}`;
  }
  // Training — no single-event edit path on this board; null means no link
  return null;
}

export default function WochenplanEventCard({
  event,
  hasPitchConflict = false,
  hasRoomConflict = false,
  onOpenRooms,
  onDragStart,
  onDragEnd,
}: WochenplanEventCardProps) {
  const categoryClasses = getCategoryClasses(event.categoryKey);
  const hasConflict = hasPitchConflict || hasRoomConflict;
  const missingAllocations = getMissingAllocations(event);
  const hasIncomplete = !hasConflict && missingAllocations.length > 0;
  const planningHref = getPlanningEditHref(event);

  return (
    <button
      type="button"
      draggable
      onDragStart={() => onDragStart(event.id)}
      onDragEnd={onDragEnd}
      onClick={() => onOpenRooms(event.id)}
      className={cn(
        "group relative block w-full max-w-full overflow-hidden rounded-2xl border p-3 text-left shadow-sm transition hover:-translate-y-[1px] hover:shadow-md",
        categoryClasses,
        hasConflict
          ? "ring-2 ring-red-300/60 shadow-[0_10px_24px_rgba(239,68,68,0.10)]"
          : hasIncomplete
            ? "ring-1 ring-amber-300/60 border-amber-300 bg-amber-50/80"
            : "",
      )}
      title="Karte ziehen oder klicken für Garderoben"
    >
      {/* Conflict badge */}
      {hasConflict ? (
        <div className="absolute right-2 top-2 flex items-center gap-1">
          {hasPitchConflict ? (
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-red-200 bg-white/90 text-red-700 shadow-sm">
              <MapPinned className="h-3.5 w-3.5" />
            </span>
          ) : null}
          {hasRoomConflict ? (
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-red-200 bg-white/90 text-red-700 shadow-sm">
              <Shirt className="h-3.5 w-3.5" />
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-2 pr-10">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={"h-2.5 w-2.5 shrink-0 rounded-full " + getTypeDotClass(event.eventType)} />
            <p className="truncate text-xs font-bold">{event.title}</p>
          </div>
        </div>

        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 opacity-50 transition group-hover:opacity-100" />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-medium opacity-80">
        <span className="shrink-0">{event.slotKey}</span>
        {event.fieldLabel ? <span className="truncate">• Feld {event.fieldLabel}</span> : null}
      </div>

      <div className="mt-3 space-y-1.5 text-[11px] opacity-85">
        <div className="flex min-w-0 items-center gap-1.5">
          <MapPinned className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {event.pitchRowKey === "KUNSTRASEN_2"
              ? "KR 2"
              : event.pitchRowKey === "KUNSTRASEN_3"
                ? "KR 3"
                : "Stadion"}
          </span>
        </div>

        <div className="flex min-w-0 items-center gap-1.5">
          <ShieldHalf className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {event.homeLabel ?? event.opponentName ?? event.organizerName ?? "—"}
          </span>
        </div>

        <div className="flex min-w-0 items-center gap-1.5">
          <Shirt className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {event.allocation.homeDressingRoomCode
              ? "Garderobe " + event.allocation.homeDressingRoomCode
              : "Garderobe offen"}
            {event.allocation.awayDressingRoomCode
              ? " / " + event.allocation.awayDressingRoomCode
              : ""}
          </span>
        </div>

        {event.coachLabel ? (
          <div className="truncate text-[11px] opacity-75">{event.coachLabel}</div>
        ) : null}
      </div>

      {/* Conflict indicator — danger state */}
      {hasConflict ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-red-700">
          <span className="inline-flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" />
            Doppelbelegung
          </span>
          {hasPitchConflict ? <span>Platz</span> : null}
          {hasPitchConflict && hasRoomConflict ? <span>•</span> : null}
          {hasRoomConflict ? <span>Garderobe</span> : null}
        </div>
      ) : null}

      {/* Incomplete planning indicator — amber attention state */}
      {hasIncomplete ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-white/70 px-2 py-1.5">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-700">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            <span>
              {missingAllocations.length === 1
                ? "Planung unvollständig"
                : `${missingAllocations.length} Aufgaben offen`}
            </span>
          </div>
          <ul className="mt-1 space-y-0.5">
            {missingAllocations.map((item) => (
              <li key={item} className="text-[10px] text-amber-600 flex items-center gap-1">
                <span className="inline-block h-1 w-1 rounded-full bg-amber-400" />
                {item}
              </li>
            ))}
          </ul>
          {planningHref ? (
            <Link
              href={planningHref}
              onClick={(e) => e.stopPropagation()}
              className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 underline underline-offset-2 hover:text-amber-900"
            >
              Planung bearbeiten →
            </Link>
          ) : null}
        </div>
      ) : null}
    </button>
  );
}
