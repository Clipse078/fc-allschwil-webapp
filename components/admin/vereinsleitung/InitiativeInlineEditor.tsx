"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import PeoplePicker, {
  type PeoplePickerPerson,
} from "@/components/admin/shared/people-picker/PeoplePicker";

type InitiativeStatus = "PLANNED" | "IN_PROGRESS" | "DONE";

type InitiativeInlineEditorProps = {
  initiative: {
    id: string;
    title: string;
    subtitle: string | null;
    description: string | null;
    status: InitiativeStatus;
    startDate: string | null;
    targetDate: string | null;
    ownerPerson: PeoplePickerPerson | null;
    ownerRoleLabel: string | null;
  };
};

type FormState = {
  title: string;
  subtitle: string;
  description: string;
  status: InitiativeStatus;
  startDate: string;
  targetDate: string;
};

function toDateInputValue(value: string | null) {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
}

export default function InitiativeInlineEditor({
  initiative,
}: InitiativeInlineEditorProps) {
  const router = useRouter();

  const initialState = useMemo<FormState>(
    () => ({
      title: initiative.title,
      subtitle: initiative.subtitle ?? "",
      description: initiative.description ?? "",
      status: initiative.status,
      startDate: toDateInputValue(initiative.startDate),
      targetDate: toDateInputValue(initiative.targetDate),
    }),
    [initiative],
  );

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<FormState>(initialState);
  const [ownerPerson, setOwnerPerson] = useState<PeoplePickerPerson | null>(
    initiative.ownerPerson,
  );

  function updateField<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function resetForm() {
    setForm(initialState);
    setOwnerPerson(initiative.ownerPerson);
    setError("");
    setIsEditing(false);
  }

  async function save() {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const response = await fetch(
        "/api/vereinsleitung/initiatives/" + initiative.id,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: form.title,
            subtitle: form.subtitle,
            description: form.description,
            status: form.status,
            startDate: form.startDate || null,
            targetDate: form.targetDate || null,
            ownerPersonId: ownerPerson?.id ?? null,
            ownerRoleLabel: ownerPerson?.functionLabel ?? null,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          typeof data?.error === "string"
            ? data.error
            : "Initiative konnte nicht gespeichert werden.",
        );
        return;
      }

      setIsEditing(false);
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? "Technischer Fehler: " + saveError.message
          : "Initiative konnte nicht gespeichert werden.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={() => {
          setForm(initialState);
          setOwnerPerson(initiative.ownerPerson);
          setError("");
          setIsEditing(true);
        }}
        className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        Bearbeiten
      </button>
    );
  }

  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-slate-900">
            Titel
          </label>
          <input
            value={form.title}
            onChange={(event) => updateField("title", event.target.value)}
            className="mt-2 w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-slate-900">
            Kurzbeschreibung
          </label>
          <input
            value={form.subtitle}
            onChange={(event) => updateField("subtitle", event.target.value)}
            className="mt-2 w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-slate-900">
            Verantwortliche Person
          </label>
          <div className="mt-2">
            <PeoplePicker
              mode="single"
              searchMode="vereinsleitung"
              selected={ownerPerson}
              onSelect={setOwnerPerson}
              placeholder="Person suchen und zuweisen"
              emptyText="Keine passende Person gefunden."
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Die Rollenbezeichnung wird automatisch aus der gewählten Person übernommen.
          </p>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-slate-900">
            Beschreibung
          </label>
          <textarea
            value={form.description}
            onChange={(event) => updateField("description", event.target.value)}
            rows={5}
            className="mt-2 w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-900">
            Status
          </label>
          <select
            value={form.status}
            onChange={(event) =>
              updateField("status", event.target.value as InitiativeStatus)
            }
            className="mt-2 w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
          >
            <option value="PLANNED">Geplant</option>
            <option value="IN_PROGRESS">In Arbeit</option>
            <option value="DONE">Abgeschlossen</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-900">
            Startdatum
          </label>
          <input
            type="date"
            value={form.startDate}
            onChange={(event) => updateField("startDate", event.target.value)}
            className="mt-2 w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-900">
            Zieldatum
          </label>
          <input
            type="date"
            value={form.targetDate}
            onChange={(event) => updateField("targetDate", event.target.value)}
            className="mt-2 w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
          />
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={isSaving}
          className="inline-flex items-center justify-center rounded-full border border-[#0b4aa2] bg-[#0b4aa2] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#08397c] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Speichert..." : "Speichern"}
        </button>

        <button
          type="button"
          onClick={resetForm}
          disabled={isSaving}
          className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Abbrechen
        </button>
      </div>
    </section>
  );
}