import { AlertTriangle, CheckCircle2, MapPinned, PackageX, Shirt } from "lucide-react";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";
import type { WochenplanConflict } from "@/lib/wochenplan/types";

type WochenplanConflictPanelProps = {
  conflicts: WochenplanConflict[];
};

function getConflictLabel(conflict: WochenplanConflict) {
  switch (conflict.type) {
    case "DRESSING_ROOM_CONFLICT":
      return "Garderobe";
    case "PITCH_CONFLICT":
      return "Platz";
    case "PITCH_CAPACITY_EXCEEDED":
      return "Kapazität";
    case "INVALID_PITCH_MODE":
      return "Platzmodus";
    case "MISSING_PITCH":
      return "Fehlend";
    case "MISSING_DRESSING_ROOM":
      return "Fehlend";
    default:
      return "Konflikt";
  }
}

function getConflictIcon(conflict: WochenplanConflict) {
  switch (conflict.type) {
    case "DRESSING_ROOM_CONFLICT":
      return Shirt;
    case "PITCH_CONFLICT":
      return MapPinned;
    case "PITCH_CAPACITY_EXCEEDED":
      return PackageX;
    default:
      return AlertTriangle;
  }
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
  const errors = conflicts.filter((c) => c.severity === "error");
  const warnings = conflicts.filter((c) => c.severity === "warning");

  const totalPitch = conflicts.filter(
    (c) => c.type === "PITCH_CONFLICT" || c.type === "PITCH_CAPACITY_EXCEEDED",
  ).length;
  const totalRooms = conflicts.filter(
    (c) => c.type === "DRESSING_ROOM_CONFLICT",
  ).length;
  const totalMissing = conflicts.filter(
    (c) => c.type === "MISSING_PITCH" || c.type === "MISSING_DRESSING_ROOM",
  ).length;

  return (
    <AdminSurfaceCard className="overflow-hidden p-0">
      <div className="border-b border-slate-200 px-5 py-5">
        <p className="fca-eyebrow">Konfliktprüfung</p>
        <h3 className="fca-subheading mt-2">Konflikte & Hinweise</h3>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Fehler
            </p>
            <p
              className={
                "mt-2 text-[2rem] font-bold leading-none tracking-tight " +
                (errors.length > 0 ? "text-red-600" : "text-slate-900")
              }
            >
              {errors.length}
            </p>
          </div>

          <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Hinweise
            </p>
            <p
              className={
                "mt-2 text-[2rem] font-bold leading-none tracking-tight " +
                (warnings.length > 0 ? "text-amber-600" : "text-slate-900")
              }
            >
              {warnings.length}
            </p>
          </div>

          <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Platzkonflikte
            </p>
            <p
              className={
                "mt-2 text-[2rem] font-bold leading-none tracking-tight " +
                (totalPitch > 0 ? "text-red-600" : "text-slate-900")
              }
            >
              {totalPitch}
            </p>
          </div>

          <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Garderobenkonflikte
            </p>
            <p
              className={
                "mt-2 text-[2rem] font-bold leading-none tracking-tight " +
                (totalRooms > 0 ? "text-red-600" : "text-slate-900")
              }
            >
              {totalRooms}
            </p>
          </div>
        </div>

        {totalMissing > 0 ? (
          <div className="mt-3 flex items-center gap-2 rounded-[16px] border border-amber-200 bg-amber-50 px-3 py-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-[0.72rem] font-semibold text-amber-700">
              {totalMissing} fehlende Zuteilung{totalMissing !== 1 ? "en" : ""}
            </p>
          </div>
        ) : null}
      </div>

      <div className="px-5 py-5">
        {conflicts.length === 0 ? (
          <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
              </div>

              <div>
                <p className="text-sm font-semibold text-emerald-800">Keine Konflikte erkannt</p>
                <p className="mt-1 text-[0.75rem] text-emerald-700">
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
                  key={conflict.eventId + "-" + (conflict.relatedEventId ?? "null") + "-" + conflict.type + "-" + index}
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

                        <span className={"text-[0.72rem] font-semibold " + tone.text}>
                          {conflict.severity === "error" ? "Sofort prüfen" : "Hinweis"}
                        </span>
                      </div>

                      <p className="mt-2.5 text-sm leading-6 text-slate-700">
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
