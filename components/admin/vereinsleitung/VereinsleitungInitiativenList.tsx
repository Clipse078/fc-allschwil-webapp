import Link from "next/link";
import { ChevronRight, Flag, Users } from "lucide-react";

const INITIATIVEN = [
  {
    title: "Website Relaunch",
    slug: "website-relaunch",
    status: "In Arbeit",
    owner: "Michael Weber",
    progress: 65,
    age: "Neueste",
  },
  {
    title: "Neues Clubhaus Konzept",
    slug: "neues-clubhaus-konzept",
    status: "Geplant",
    owner: "Sarah Meier",
    progress: 10,
    age: "Älter",
  },
  {
    title: "Sponsorenlauf 2025",
    slug: "sponsorenlauf-2025",
    status: "On Track",
    owner: "Thomas Schmid",
    progress: 80,
    age: "Älter",
  },
];

function getStatusClass(status: string) {
  switch (status) {
    case "In Arbeit":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "Geplant":
      return "border-slate-200 bg-slate-50 text-slate-600";
    case "On Track":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

export default function VereinsleitungInitiativenList() {
  return (
    <div className="space-y-4">
      {INITIATIVEN.map((initiative) => (
        <Link
          key={initiative.slug}
          href={`/vereinsleitung/initiativen/${initiative.slug}`}
          className="block rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)] transition hover:-translate-y-[1px] hover:shadow-[0_16px_34px_rgba(15,23,42,0.06)]"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[1.05rem] font-semibold text-slate-900">
                  {initiative.title}
                </h3>
                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusClass(initiative.status)}`}>
                  {initiative.status}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-500">
                <span className="inline-flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {initiative.owner}
                </span>

                <span className="inline-flex items-center gap-2">
                  <Flag className="h-4 w-4" />
                  {initiative.progress}% Fortschritt
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                {initiative.age}
              </span>

              <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#0b4aa2]">
                Öffnen
                <ChevronRight className="h-4 w-4" />
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
