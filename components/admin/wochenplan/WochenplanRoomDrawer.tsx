"use client";

import { X } from "lucide-react";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";
import { FCA_DRESSING_ROOMS } from "@/lib/facilities/dressing-rooms";
import type { WochenplanBoardEvent } from "@/lib/wochenplan/types";

type WochenplanRoomDrawerProps = {
  event: WochenplanBoardEvent | null;
  occupiedRooms: string[];
  onClose: () => void;
  onChangeHomeRoom: (roomCode: string | null) => void;
  onChangeAwayRoom: (roomCode: string | null) => void;
};

function RoomBadge({
  roomCode,
  occupied,
  selected,
  onSelect,
}: {
  roomCode: string;
  occupied: boolean;
  selected: boolean;
  onSelect: (roomCode: string) => void;
}) {
  return (
    <button
      type="button"
      disabled={occupied}
      onClick={() => onSelect(roomCode)}
      className={[
        "rounded-xl border px-3 py-2 text-left text-sm font-semibold transition",
        selected
          ? "border-sky-300 bg-sky-50 text-sky-800 ring-2 ring-sky-300/60"
          : occupied
            ? "cursor-not-allowed border-red-200 bg-red-50 text-red-700 opacity-70"
            : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100",
      ].join(" ")}
      title={
        occupied
          ? `${roomCode} ist belegt`
          : `${roomCode} als Heim / Team Garderobe wählen`
      }
    >
      {roomCode} {selected ? "ausgewählt" : occupied ? "belegt" : "frei"}
    </button>
  );
}

export default function WochenplanRoomDrawer({
  event,
  occupiedRooms,
  onClose,
  onChangeHomeRoom,
  onChangeAwayRoom,
}: WochenplanRoomDrawerProps) {
  if (!event) {
    return null;
  }

  const selectedHomeRoom = event.allocation.homeDressingRoomCode;
  const selectedAwayRoom = event.allocation.awayDressingRoomCode;

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-[420px] border-l border-slate-200 bg-white/95 p-4 backdrop-blur-xl">
      <AdminSurfaceCard className="flex h-full flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="fca-eyebrow">Garderoben</p>
            <h3 className="fca-subheading mt-2">{event.title}</h3>
            <p className="mt-2 text-sm text-slate-600">
              {event.boardDayKey} • {event.slotKey} • {event.pitchRowKey}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid gap-4">
          <label className="block space-y-2">
            <span className="fca-label">Heim / Team Garderobe</span>
            <select
              value={selectedHomeRoom ?? ""}
              onChange={(e) => onChangeHomeRoom(e.target.value || null)}
              className="fca-select"
            >
              <option value="">Bitte wählen</option>
              {FCA_DRESSING_ROOMS.map((room) => (
                <option key={room.code} value={room.code}>
                  {room.code}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="fca-label">Gäste Garderobe</span>
            <select
              value={selectedAwayRoom ?? ""}
              onChange={(e) => onChangeAwayRoom(e.target.value || null)}
              className="fca-select"
            >
              <option value="">Bitte wählen</option>
              {FCA_DRESSING_ROOMS.map((room) => (
                <option key={room.code} value={room.code}>
                  {room.code}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-6">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Verfügbarkeit in diesem Slot
          </p>

          <p className="mt-2 text-xs leading-5 text-slate-500">
            Freie Garderobe anklicken, um sie direkt als Heim / Team Garderobe zu übernehmen.
          </p>

          <div className="mt-3 grid grid-cols-2 gap-3">
            {FCA_DRESSING_ROOMS.map((room) => (
              <RoomBadge
                key={room.code}
                roomCode={room.code}
                occupied={occupiedRooms.includes(room.code)}
                selected={selectedHomeRoom === room.code || selectedAwayRoom === room.code}
                onSelect={onChangeHomeRoom}
              />
            ))}
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
          Sandra soll hier später die Garderoben sehr schnell zuteilen können.
          Diese Drawer-Version ist die UX-Grundlage dafür.
        </div>
      </AdminSurfaceCard>
    </div>
  );
}
