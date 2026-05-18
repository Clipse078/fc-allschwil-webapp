"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, Loader2, Check } from "lucide-react";
import { INITIATIVE_STUBS, MEETING_STUBS } from "@/lib/linking/stubs";
import { toggleEntityRef, isLinked } from "@/lib/linking/helpers";
import type { EntityRef } from "@/lib/linking/types";

type TargetLinkEditorProps = {
  targetId: string;
  initialInitiativeRefs: EntityRef[];
  initialMeetingRefs: EntityRef[];
};

export default function TargetLinkEditor({
  targetId,
  initialInitiativeRefs,
  initialMeetingRefs,
}: TargetLinkEditorProps) {
  const router = useRouter();
  const [initiativeRefs, setInitiativeRefs] = useState<EntityRef[]>(initialInitiativeRefs);
  const [meetingRefs, setMeetingRefs] = useState<EntityRef[]>(initialMeetingRefs);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleInitiative(stub: EntityRef) {
    setSaved(false);
    setInitiativeRefs((prev) => toggleEntityRef(prev, stub));
  }

  function toggleMeeting(stub: EntityRef) {
    setSaved(false);
    setMeetingRefs((prev) => toggleEntityRef(prev, stub));
  }

  async function handleSave() {
    setError(null);
    setSaved(false);
    setLoading(true);

    try {
      const res = await fetch(`/api/targets/${targetId}/links`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initiativeRefs, meetingRefs }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Fehler beim Speichern.");
        return;
      }

      setSaved(true);
      router.refresh();
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setLoading(false);
    }
  }

  const chipBase =
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition cursor-pointer select-none";
  const chipActive =
    "border-[#0b4aa2] bg-[#0b4aa2]/8 text-[#0b4aa2]";
  const chipInactive =
    "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50";

  return (
    <section
      id="links"
      className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]"
    >
      <div className="mb-5 flex items-center gap-2">
        <Link2 className="h-5 w-5 text-[#0b4aa2]" />
        <h3 className="text-[1.05rem] font-semibold text-slate-900">
          Verknüpfungen
        </h3>
      </div>

      {error ? (
        <div className="mb-4 rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] font-medium text-rose-700">
          {error}
        </div>
      ) : null}

      {saved ? (
        <div className="mb-4 rounded-[16px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12px] font-medium text-emerald-700">
          ✓ Verknüpfungen gespeichert.
        </div>
      ) : null}

      <div className="space-y-5">
        <div>
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.1em] text-slate-500">
            Initiativen
          </p>
          <p className="mb-3 text-[11px] text-slate-400">
            Wähle Initiativen aus, die dieses Ziel operationalisieren.
          </p>
          <div className="flex flex-wrap gap-2">
            {INITIATIVE_STUBS.map((stub) => {
              const active = isLinked(initiativeRefs, stub.slug);
              return (
                <button
                  key={stub.slug}
                  type="button"
                  onClick={() => toggleInitiative(stub)}
                  className={`${chipBase} ${active ? chipActive : chipInactive}`}
                >
                  {active ? <Check className="h-3 w-3" /> : null}
                  {stub.title}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.1em] text-slate-500">
            Meetings
          </p>
          <p className="mb-3 text-[11px] text-slate-400">
            Verknüpfe relevante Meetings, in denen dieses Ziel besprochen wurde.
          </p>
          <div className="flex flex-wrap gap-2">
            {MEETING_STUBS.map((stub) => {
              const active = isLinked(meetingRefs, stub.slug);
              return (
                <button
                  key={stub.slug}
                  type="button"
                  onClick={() => toggleMeeting(stub)}
                  className={`${chipBase} ${active ? chipActive : chipInactive}`}
                >
                  {active ? <Check className="h-3 w-3" /> : null}
                  {stub.title}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
        <p className="text-[11px] text-slate-400">
          {initiativeRefs.length + meetingRefs.length} Verknüpfung
          {initiativeRefs.length + meetingRefs.length !== 1 ? "en" : ""} gewählt
        </p>
        <button
          type="button"
          onClick={handleSave}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full bg-[#0b4aa2] px-5 py-2 text-[12px] font-semibold text-white disabled:opacity-60 hover:bg-[#08357a]"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Speichern
        </button>
      </div>
    </section>
  );
}
