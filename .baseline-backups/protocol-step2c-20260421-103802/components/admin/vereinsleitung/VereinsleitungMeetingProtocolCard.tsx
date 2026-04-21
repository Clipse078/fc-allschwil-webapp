"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Loader2, Plus } from "lucide-react";
import {
  type MeetingAgendaItem,
  type MeetingProtocolEntryItem,
} from "@/lib/vereinsleitung/meeting-utils";

type VereinsleitungMeetingProtocolCardProps = {
  meetingId: string;
  notes: string | null;
  protocolEntries: MeetingProtocolEntryItem[];
  agendaItems: MeetingAgendaItem[];
};

export default function VereinsleitungMeetingProtocolCard({
  meetingId,
  notes,
  protocolEntries,
  agendaItems,
}: VereinsleitungMeetingProtocolCardProps) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [agendaItemId, setAgendaItemId] = useState("");
  const [entryNotes, setEntryNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const selectedAgendaItemTitle =
    agendaItems.find((item) => item.id === agendaItemId)?.title ?? null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!entryNotes.trim()) {
      setFormError("Bitte erfasse einen Protokolleintrag.");
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);
      setFormSuccess(null);

      const response = await fetch(
        "/api/vereinsleitung/meetings/" + meetingId + "/protocol",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            agendaItemId: agendaItemId || null,
            agendaItemTitle: selectedAgendaItemTitle,
            notes: entryNotes.trim(),
          }),
        },
      );

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Protokolleintrag konnte nicht gespeichert werden.");
      }

      setAgendaItemId("");
      setEntryNotes("");
      setFormSuccess("Protokolleintrag wurde gespeichert.");
      setIsExpanded(false);
      router.refresh();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Technischer Fehler beim Speichern.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-[30px] border border-slate-200/80 bg-white p-7 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4.5 w-4.5 text-[#0b4aa2]" />
          <h3 className="text-[1.08rem] font-semibold text-slate-900">Protokoll</h3>
        </div>

        <button
          type="button"
          onClick={() => {
            setIsExpanded((current) => !current);
            setFormError(null);
            setFormSuccess(null);
          }}
          className="inline-flex items-center gap-2 rounded-full bg-[#0b4aa2] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#083a80]"
        >
          <Plus className="h-4 w-4" />
          Protokolleintrag erfassen
        </button>
      </div>

      {isExpanded ? (
        <form onSubmit={handleSubmit} className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 p-5">
          <div className="grid gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-800">
                Traktandum
              </label>
              <select
                value={agendaItemId}
                onChange={(event) => setAgendaItemId(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
              >
                <option value="">Kein direktes Traktandum</option>
                {agendaItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-800">
                Protokolleintrag
              </label>
              <textarea
                value={entryNotes}
                onChange={(event) => setEntryNotes(event.target.value)}
                rows={5}
                placeholder="Was wurde besprochen, festgehalten oder beobachtet?"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
              />
            </div>
          </div>

          {formError ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {formError}
            </div>
          ) : null}

          {formSuccess ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {formSuccess}
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setIsExpanded(false);
                setFormError(null);
                setFormSuccess(null);
              }}
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Abbrechen
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-full bg-[#0b4aa2] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#083a80] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Protokolleintrag speichern
            </button>
          </div>
        </form>
      ) : null}

      {protocolEntries.length > 0 ? (
        <div className="mt-6 space-y-4">
          {protocolEntries.map((entry) => (
            <article
              key={entry.id}
              className="rounded-[24px] border border-slate-200/80 bg-slate-50 px-5 py-4"
            >
              {entry.agendaItemTitle ? (
                <div className="mb-3 inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                  {entry.agendaItemTitle}
                </div>
              ) : null}

              <p className="text-sm leading-6 text-slate-700">{entry.notes}</p>
            </article>
          ))}
        </div>
      ) : notes ? (
        <div className="mt-6 rounded-[24px] border border-slate-200/80 bg-slate-50 px-5 py-4 text-sm leading-6 text-slate-700">
          {notes}
        </div>
      ) : (
        <div className="mt-6 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 py-6">
          <p className="text-sm font-medium text-slate-700">
            Fuer dieses Meeting ist noch kein Protokoll hinterlegt.
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Dieser Bereich ist jetzt an echte Traktanden gekoppelt und bereit fuer den
            naechsten Ausbauschritt der Meeting-Ausfuehrung.
          </p>
        </div>
      )}
    </section>
  );
}
