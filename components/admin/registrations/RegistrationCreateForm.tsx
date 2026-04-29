"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const registrationTypes = [
  ["PLAYER", "Spieler"],
  ["TRAINER", "Trainer"],
  ["STAFF", "Staff"],
  ["EXTERNAL", "Extern"],
];

export default function RegistrationCreateForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setPending(true);
    setError(null);

    try {
      const firstName = String(formData.get("firstName") ?? "").trim();
      const lastName = String(formData.get("lastName") ?? "").trim();

      const response = await fetch("/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: String(formData.get("type") ?? "PLAYER"),
          firstName,
          lastName,
          displayName: `${firstName} ${lastName}`.trim(),
          email: String(formData.get("email") ?? "").trim() || null,
          phone: String(formData.get("phone") ?? "").trim() || null,
          dateOfBirth: String(formData.get("dateOfBirth") ?? "").trim() || null,
          gender: String(formData.get("gender") ?? "").trim() || null,
          notes: String(formData.get("notes") ?? "").trim() || null,
          source: "WEBAPP_MANUAL",
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error ?? "Anmeldung konnte nicht erstellt werden.");
      }

      if (payload?.registration?.id) {
        router.push(`/dashboard/neu-anmeldungen/${payload.registration.id}`);
        return;
      }

      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Anmeldung konnte nicht erstellt werden.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="fca-eyebrow">Manuell erfassen</p>
          <h2 className="text-lg font-black text-slate-950">Neue Anmeldung erstellen</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Für Telefon, E-Mail oder interne Meldungen direkt im WebApp erfassen.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded-full bg-[#0b4aa2] px-5 py-2 text-sm font-black text-white shadow-sm transition hover:bg-[#073a7f]"
        >
          {open ? "Schliessen" : "Neue Anmeldung erstellen"}
        </button>
      </div>

      {open ? (
        <form action={submit} className="mt-5 grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4 lg:grid-cols-2">
          <select name="type" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-blue-300">
            {registrationTypes.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          <input name="dateOfBirth" type="date" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-blue-300" />

          <input name="firstName" required placeholder="Vorname" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-blue-300" />
          <input name="lastName" required placeholder="Nachname" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-blue-300" />

          <input name="email" type="email" placeholder="E-Mail" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-blue-300" />
          <input name="phone" placeholder="Telefon" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-blue-300" />

          <input name="gender" placeholder="Geschlecht optional" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-blue-300" />

          <textarea name="notes" placeholder="Notizen" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-blue-300 lg:col-span-2" />

          {error ? <p className="text-sm font-bold text-red-600 lg:col-span-2">{error}</p> : null}

          <div className="lg:col-span-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-red-600 px-5 py-2 text-sm font-black text-white shadow-sm transition hover:bg-red-700 disabled:opacity-40"
            >
              {pending ? "Erstellen..." : "Anmeldung speichern"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
