import { MapPinned, PackageX, Shirt } from "lucide-react";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";

export default function WochenplanLegend() {
  const categoryItems = [
    { label: "Kinderfussball (G / F / E)", className: "border-amber-300 bg-amber-50 text-amber-800" },
    { label: "Junioren (D / C / B / A)", className: "border-blue-300 bg-blue-50 text-blue-800" },
    { label: "Aktive (1. / 2. Mannschaft)", className: "border-red-300 bg-red-50 text-red-800" },
    { label: "Frauen / Juniorinnen", className: "border-pink-300 bg-pink-50 text-pink-800" },
    { label: "Senioren (30+, 40+, 50+)", className: "border-slate-300 bg-slate-50 text-slate-800" },
    { label: "Torwarttraining", className: "border-neutral-300 bg-neutral-50 text-neutral-800" },
  ];

  const conflictItems = [
    {
      Icon: MapPinned,
      label: "Platzkonflikt",
      description: "Zwei oder mehr Events belegen denselben Platz gleichzeitig.",
    },
    {
      Icon: PackageX,
      label: "Kapazität überschritten",
      description: "Zu viele Events auf demselben Platz im gleichen Zeitslot.",
    },
    {
      Icon: Shirt,
      label: "Garderobenkonflikt",
      description: "Dieselbe Garderobe ist für mehrere Events gleichzeitig vergeben.",
    },
  ];

  return (
    <AdminSurfaceCard className="p-5">
      <p className="fca-eyebrow">Legende</p>

      <div className="mt-4 grid gap-3 xl:grid-cols-3">
        {categoryItems.map((item) => (
          <div
            key={item.label}
            className={"rounded-2xl border px-4 py-3 text-sm font-semibold " + item.className}
          >
            {item.label}
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {conflictItems.map(({ Icon, label, description }) => (
          <div
            key={label}
            className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50/60 px-4 py-3"
          >
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-red-200 bg-white/80 text-red-700">
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div>
              <p className="text-[0.72rem] font-semibold text-red-800">{label}</p>
              <p className="mt-0.5 text-[0.68rem] leading-4 text-red-700">{description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-4 text-sm text-slate-600 md:grid-cols-4">
        <div>
          <p className="font-semibold text-slate-900">Stadion</p>
          <p>Hauptspielfeld</p>
        </div>
        <div>
          <p className="font-semibold text-slate-900">KR 2</p>
          <p>Kleinfeld / Kunstrasen 2</p>
        </div>
        <div>
          <p className="font-semibold text-slate-900">KR 3</p>
          <p>Kleinfeld / Kunstrasen 3</p>
        </div>
        <div>
          <p className="font-semibold text-slate-900">Hinweis</p>
          <p>Kurzfristige Änderungen bitte zeitnah abstimmen.</p>
        </div>
      </div>
    </AdminSurfaceCard>
  );
}
