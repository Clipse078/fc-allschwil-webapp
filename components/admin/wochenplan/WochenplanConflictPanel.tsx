import { AlertTriangle, MapPinned, Shirt } from "lucide-react";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";
import type { WochenplanConflict } from "@/lib/wochenplan/types";

type WochenplanConflictPanelProps = {
  conflicts: WochenplanConflict[];
};

function getConflictLabel(conflict: WochenplanConflict) {
  if (conflict.type === "DRESSING_ROOM_CONFLICT") {
    return "Garderobe";
  }

  if (conflict.type === "PITCH_CONFLICT") {
    return "Platz";
  }

  return "Konflikt";
}

function getConflictIcon(conflict: WochenplanConflict) {
  if (conflict.type === "DRESSING_ROOM_CONFLICT") {
    return Shirt;
  }

  if (conflict.type === "PITCH_CONFLICT") {
    return MapPinned;
  }

  return AlertTriangle;
}

function getConflictTone(conflict: WochenplanConflict) {
  if (conflict.severity === "error") {
    return {
      card: "border-red-200 bg-red-50/70",
      pill: "border-red-200 bg-white text-red-700",
      iconWrap: "bg-red-100 text-red-700",
      text: "text-red-700",
    };
  }

  return {
    card: "border-amber-200 bg-amber-50/70",
    pill: "border-amber-200 bg-white text-amber-700",
    iconWrap: "bg-amber-100 text-amber-700",
    text: "text-amber-700",
  };
}

export default function WochenplanConflictPanel({
  conflicts,
}: WochenplanConflictPanelProps) {
  const totalPitch = conflicts.filter((conflict) => conflict.type === "PITCH_CONFLICT").length;
  const totalRooms = conflicts.filter(
    (conflict) => conflict.type === "DRESSING_ROOM_CONFLICT",
  ).length;

  return (
    <AdminSurfaceCard className="overflow-hidden p-0">
      <div className="border-b border-slate-200 px-5 py-5">
        <p className="fca-eyebrow">Konfliktprüfung</p>
        <h3 className="fca-subheading mt-2">Konflikte</h3>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-[20px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Gesamt
            </p>
            <p className="mt-3 text-[2.4rem] font-bold leading-none tracking-tight text-slate-900">
              {conflicts.length}
            </p>
          </div>

          <div className="rounded-[20px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Platz
            </p>
            <p className="mt-3 text-[2.4rem] font-bold leading-none tracking-tight text-slate-900">
              {totalPitch}
            </p>
          </div>

          <div className="rounded-[20px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Garderobe
            </p>
            <p className="mt-3 text-[2.4rem] font-bold leading-none tracking-tight text-slate-900">
              {totalRooms}
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 py-5">
        {conflicts.length === 0 ? (
          <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <AlertTriangle className="h-4 w-4" />
              </div>

              <div>
                <p className="text-sm font-semibold text-emerald-800">Keine Konflikte erkannt</p>
                <p className="mt-1 text-sm text-emerald-700">
                  Platz- und Garderobenzuteilungen sind aktuell sauber geplant.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {conflicts.map((conflict, index) => {
              const Icon = getConflictIcon(conflict);
              const tone = getConflictTone(conflict);

              return (
                <div
                  key={conflict.eventId + "-" + conflict.relatedEventId + "-" + index}
                  className={"rounded-[24px] border px-4 py-4 shadow-sm " + tone.card}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full " +
                        tone.iconWrap
                      }
                    >
                      <Icon className="h-4 w-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={
                            "rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] " +
                            tone.pill
                          }
                        >
                          {getConflictLabel(conflict)}
                        </span>

                        <span className={"text-sm font-semibold " + tone.text}>
                          {conflict.severity === "error" ? "Sofort prüfen" : "Hinweis"}
                        </span>
                      </div>

                      <p className="mt-3 text-sm leading-6 text-slate-700">
                        {conflict.message}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminSurfaceCard>
  );
}
