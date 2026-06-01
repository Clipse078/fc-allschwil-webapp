"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

type PersonFormProps = {
  mode: "create" | "edit";
  personId?: string;
  defaultValues?: {
    firstName?: string;
    lastName?: string;
    displayName?: string;
    email?: string;
    phone?: string;
    dateOfBirth?: string;
    notes?: string;
    isActive?: boolean;
    isPlayer?: boolean;
    isTrainer?: boolean;
  };
};

export default function PersonForm({ mode, personId, defaultValues }: PersonFormProps) {
  const router = useRouter();

  const [firstName, setFirstName] = useState(defaultValues?.firstName ?? "");
  const [lastName, setLastName] = useState(defaultValues?.lastName ?? "");
  const [displayName, setDisplayName] = useState(defaultValues?.displayName ?? "");
  const [email, setEmail] = useState(defaultValues?.email ?? "");
  const [phone, setPhone] = useState(defaultValues?.phone ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(defaultValues?.dateOfBirth ?? "");
  const [notes, setNotes] = useState(defaultValues?.notes ?? "");
  const [isActive, setIsActive] = useState(defaultValues?.isActive ?? true);
  const [isPlayer, setIsPlayer] = useState(defaultValues?.isPlayer ?? false);
  const [isTrainer, setIsTrainer] = useState(defaultValues?.isTrainer ?? false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fieldClass =
    "w-full rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0b4aa2]/30";
  const labelClass =
    "block text-[12px] font-semibold uppercase tracking-[0.1em] text-slate-500 mb-1.5";

  function validate(): string | null {
    if (!firstName.trim()) return "Vorname ist erforderlich.";
    if (firstName.trim().length > 100) return "Vorname darf maximal 100 Zeichen lang sein.";
    if (!lastName.trim()) return "Nachname ist erforderlich.";
    if (lastName.trim().length > 100) return "Nachname darf maximal 100 Zeichen lang sein.";
    if (displayName.trim().length > 150) return "Anzeigename darf maximal 150 Zeichen lang sein.";
    if (email.trim() && (!email.includes("@") || !email.includes("."))) {
      return "Ungültige E-Mail-Adresse.";
    }
    if (phone.trim().length > 50) return "Telefonnummer darf maximal 50 Zeichen lang sein.";
    if (dateOfBirth) {
      const dob = new Date(dateOfBirth);
      if (Number.isNaN(dob.getTime())) return "Ungültiges Geburtsdatum.";
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dobNorm = new Date(dateOfBirth);
      dobNorm.setHours(0, 0, 0, 0);
      if (dobNorm > today) return "Geburtsdatum darf nicht in der Zukunft liegen.";
    }
    if (notes.trim().length > 1000) return "Notizen dürfen maximal 1000 Zeichen lang sein.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const url =
        mode === "edit" && personId ? `/api/people/${personId}` : "/api/people";
      const method = mode === "edit" ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          displayName: displayName.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
          dateOfBirth: dateOfBirth || null,
          notes: notes.trim() || null,
          isActive,
          isPlayer,
          isTrainer,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Fehler beim Speichern.");
        return;
      }

      router.push("/dashboard/persons");
      router.refresh();
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? (
        <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700">
          {error}
        </div>
      ) : null}

      {/* Stammdaten */}
      <section className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <h3 className="mb-5 text-[1.05rem] font-semibold text-slate-900">Stammdaten</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={labelClass}>Vorname *</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Vorname"
              maxLength={100}
              className={fieldClass}
              required
            />
          </div>
          <div>
            <label className={labelClass}>Nachname *</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Nachname"
              maxLength={100}
              className={fieldClass}
              required
            />
          </div>
          <div>
            <label className={labelClass}>Anzeigename</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="z.B. Spitzname oder bevorzugter Name"
              maxLength={150}
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass}>Geburtsdatum</label>
            <input
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              className={fieldClass}
            />
          </div>
        </div>
      </section>

      {/* Kontakt */}
      <section className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <h3 className="mb-5 text-[1.05rem] font-semibold text-slate-900">Kontakt</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={labelClass}>E-Mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              maxLength={200}
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass}>Telefon</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+41 79 000 00 00"
              maxLength={50}
              className={fieldClass}
            />
          </div>
        </div>
      </section>

      {/* Rollen & Status */}
      <section className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <h3 className="mb-5 text-[1.05rem] font-semibold text-slate-900">Rollen & Status</h3>
        <div className="space-y-3">
          <Toggle
            id="isActive"
            label="Person ist aktiv"
            checked={isActive}
            onChange={setIsActive}
          />
          <Toggle
            id="isPlayer"
            label="Spieler"
            checked={isPlayer}
            onChange={setIsPlayer}
          />
          <Toggle
            id="isTrainer"
            label="Trainer"
            checked={isTrainer}
            onChange={setIsTrainer}
          />
        </div>
      </section>

      {/* Notizen */}
      <section className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <h3 className="mb-5 text-[1.05rem] font-semibold text-slate-900">Notizen</h3>
        <div>
          <label className={labelClass}>Interne Notizen</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Optionale interne Notizen…"
            maxLength={1000}
            className={`${fieldClass} resize-none`}
          />
          <p className="mt-1 text-right text-[11px] text-slate-400">
            {notes.length}/1000
          </p>
        </div>
      </section>

      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Abbrechen
        </button>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full bg-[#0b4aa2] px-6 py-2.5 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60 hover:bg-[#08357a]"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {mode === "create" ? "Person erstellen" : "Änderungen speichern"}
        </button>
      </div>
    </form>
  );
}

function Toggle({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center justify-between rounded-[14px] border border-slate-100 bg-slate-50 px-4 py-3"
    >
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-300 accent-[#0b4aa2]"
      />
    </label>
  );
}
