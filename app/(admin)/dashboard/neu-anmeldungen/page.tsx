import Link from "next/link";
import { prisma } from "@/lib/db/prisma";

const statusLabels: Record<string, string> = {
  NEW: "Neu",
  IN_REVIEW: "In Prüfung",
  APPROVED: "Freigegeben",
  REJECTED: "Abgelehnt",
};

const typeLabels: Record<string, string> = {
  PLAYER: "Spieler",
  TRAINER: "Trainer",
  STAFF: "Mitarbeiter",
  EXTERNAL: "Extern",
};

function getDisplayName(data: unknown) {
  if (!data || typeof data !== "object") return "Neue Anmeldung";
  const record = data as Record<string, unknown>;
  const firstName = typeof record.firstName === "string" ? record.firstName : "";
  const lastName = typeof record.lastName === "string" ? record.lastName : "";
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || "Neue Anmeldung";
}

export default async function NeueAnmeldungenPage() {
  const registrations = await prisma.registration.findMany({
    orderBy: { submittedAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="fca-eyebrow">Neue Anmeldungen</p>
        <h1 className="text-2xl font-black">Eingänge</h1>
      </div>

      <div className="grid gap-3">
        {registrations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm font-semibold text-slate-500">
            Aktuell sind keine neuen Anmeldungen vorhanden.
          </div>
        ) : (
          registrations.map((registration) => (
            <Link
              key={registration.id}
              href={`/dashboard/neu-anmeldungen/${registration.id}`}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:bg-slate-50"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-black text-slate-900">{(registration.displayName || (registration.firstName + " " + registration.lastName))}</p>
                  <p className="text-sm font-semibold text-slate-500">{typeLabels[registration.type] ?? registration.type}</p>
                </div>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black text-slate-600">
                  {statusLabels[registration.status] ?? registration.status}
                </span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

